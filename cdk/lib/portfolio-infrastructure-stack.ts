import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

export interface PortfolioInfrastructureStackProps extends cdk.StackProps {
  bucketName: string;
  githubUsername: string;
  githubRepoName: string;
  domainName?: string;
  enableCloudFront?: boolean;
}

export class PortfolioInfrastructureStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution?: cloudfront.Distribution;
  public readonly deploymentRole: iam.Role;

  constructor(scope: Construct, id: string, props: PortfolioInfrastructureStackProps) {
    super(scope, id, props);

    const { bucketName, githubUsername, githubRepoName, domainName, enableCloudFront = false } = props;

    // Create S3 bucket for static website hosting
    this.bucket = new s3.Bucket(this, 'PortfolioBucket', {
      bucketName,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      versioned: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Create bucket policy for public read access
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:GetObject'],
        resources: [this.bucket.arnForObjects('*')],
      })
    );

    // Create OIDC provider for GitHub Actions
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOIDCProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
    });

    // Create IAM role for GitHub Actions deployment
    this.deploymentRole = new iam.Role(this, 'GitHubActionsDeploymentRole', {
      roleName: 'GitHubActionsPortfolioDeploy',
      assumedBy: new iam.WebIdentityPrincipal(oidcProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${githubUsername}/${githubRepoName}:*`,
        },
      }),
      description: 'Role for GitHub Actions to deploy portfolio to S3',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Create IAM policy for S3 deployment
    const s3DeploymentPolicy = new iam.Policy(this, 'S3DeploymentPolicy', {
      policyName: 'PortfolioS3DeploymentPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
          ],
          resources: [
            this.bucket.bucketArn,
            this.bucket.arnForObjects('*'),
          ],
        }),
      ],
    });

    // Attach S3 deployment policy to role
    this.deploymentRole.attachInlinePolicy(s3DeploymentPolicy);

    // CloudFront distribution (optional)
    if (enableCloudFront) {
      let certificate: acm.ICertificate | undefined;
      let hostedZone: route53.IHostedZone | undefined;

      // If domain name is provided, create certificate and hosted zone
      if (domainName) {
        hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
          domainName: domainName.split('.').slice(-2).join('.'),
        });

        certificate = new acm.Certificate(this, 'Certificate', {
          domainName,
          subjectAlternativeNames: [`*.${domainName}`],
          validation: acm.CertificateValidation.fromDns(hostedZone),
        });
      }

      // Create CloudFront distribution
      this.distribution = new cloudfront.Distribution(this, 'PortfolioDistribution', {
        defaultBehavior: {
          origin: new origins.S3Origin(this.bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          compress: true,
        },
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
        ],
        domainNames: domainName ? [domainName] : undefined,
        certificate,
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        enableLogging: true,
        logBucket: new s3.Bucket(this, 'CloudFrontLogBucket', {
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          autoDeleteObjects: true,
          lifecycleRules: [
            {
              expiration: cdk.Duration.days(90),
            },
          ],
        }),
      });

      // Create Route 53 record if domain is provided
      if (domainName && hostedZone) {
        new route53.ARecord(this, 'PortfolioARecord', {
          zone: hostedZone,
          recordName: domainName,
          target: route53.RecordTarget.fromAlias(
            new targets.CloudFrontTarget(this.distribution)
          ),
        });
      }

      // Create IAM policy for CloudFront invalidation
      const cloudFrontInvalidationPolicy = new iam.Policy(this, 'CloudFrontInvalidationPolicy', {
        policyName: 'PortfolioCloudFrontInvalidationPolicy',
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'cloudfront:CreateInvalidation',
              'cloudfront:GetInvalidation',
              'cloudfront:ListInvalidations',
            ],
            resources: [this.distribution.distributionArn],
          }),
        ],
      });

      // Attach CloudFront invalidation policy to role
      this.deploymentRole.attachInlinePolicy(cloudFrontInvalidationPolicy);
    }

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name for portfolio hosting',
      exportName: `${this.stackName}-BucketName`,
    });

    new cdk.CfnOutput(this, 'BucketWebsiteUrl', {
      value: this.bucket.bucketWebsiteUrl,
      description: 'S3 bucket website URL',
      exportName: `${this.stackName}-BucketWebsiteUrl`,
    });

    new cdk.CfnOutput(this, 'DeploymentRoleArn', {
      value: this.deploymentRole.roleArn,
      description: 'IAM role ARN for GitHub Actions deployment',
      exportName: `${this.stackName}-DeploymentRoleArn`,
    });

    if (this.distribution) {
      new cdk.CfnOutput(this, 'DistributionId', {
        value: this.distribution.distributionId,
        description: 'CloudFront distribution ID',
        exportName: `${this.stackName}-DistributionId`,
      });

      new cdk.CfnOutput(this, 'DistributionDomainName', {
        value: this.distribution.distributionDomainName,
        description: 'CloudFront distribution domain name',
        exportName: `${this.stackName}-DistributionDomainName`,
      });

      if (domainName) {
        new cdk.CfnOutput(this, 'WebsiteUrl', {
          value: `https://${domainName}`,
          description: 'Portfolio website URL',
          exportName: `${this.stackName}-WebsiteUrl`,
        });
      }
    }

    // Add tags
    cdk.Tags.of(this).add('Service', 'Portfolio');
    cdk.Tags.of(this).add('Component', 'Infrastructure');
  }
}
