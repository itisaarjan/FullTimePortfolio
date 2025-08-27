"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioInfrastructureStack = void 0;
const cdk = require("aws-cdk-lib");
const s3 = require("aws-cdk-lib/aws-s3");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const iam = require("aws-cdk-lib/aws-iam");
const route53 = require("aws-cdk-lib/aws-route53");
const targets = require("aws-cdk-lib/aws-route53-targets");
const acm = require("aws-cdk-lib/aws-certificatemanager");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const logs = require("aws-cdk-lib/aws-logs");
class PortfolioInfrastructureStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { bucketName, githubUsername, githubRepoName, domainName, enableCloudFront = false } = props;
        // Import existing S3 bucket for static website hosting
        this.bucket = s3.Bucket.fromBucketName(this, 'PortfolioBucket', bucketName);
        // Create bucket policy for public read access
        this.bucket.addToResourcePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['s3:GetObject'],
            resources: [this.bucket.arnForObjects('*')],
        }));
        // Import existing OIDC provider for GitHub Actions
        const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'GitHubOIDCProvider', `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`);
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
            let certificate;
            let hostedZone;
            // If domain name is provided, create certificate and hosted zone
            if (domainName) {
                // Look up the existing hosted zone
                hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
                    domainName: domainName.split('.').slice(-2).join('.'),
                });
                // Create SSL certificate
                certificate = new acm.Certificate(this, 'Certificate', {
                    domainName,
                    subjectAlternativeNames: [`*.${domainName}`],
                    validation: acm.CertificateValidation.fromDns(hostedZone),
                });
            }
            // Create CloudFront distribution
            this.distribution = new cloudfront.Distribution(this, 'PortfolioDistribution', {
                defaultBehavior: {
                    origin: new origins.HttpOrigin(`${bucketName}.s3-website-${this.region}.amazonaws.com`, {
                        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
                    }),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.USER_AGENT_REFERER_HEADERS,
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
                enableLogging: false,
                // Additional settings for better performance
                defaultRootObject: 'index.html',
                enabled: true,
            });
            // Create Route 53 records if domain is provided
            if (domainName && hostedZone) {
                // A record for the root domain
                new route53.ARecord(this, 'PortfolioARecord', {
                    zone: hostedZone,
                    recordName: domainName,
                    target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
                });
                // AAAA record for IPv6 support
                new route53.AaaaRecord(this, 'PortfolioAaaaRecord', {
                    zone: hostedZone,
                    recordName: domainName,
                    target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
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
                        resources: [`arn:aws:cloudfront::${this.account}:distribution/*`],
                    }),
                ],
            });
            // Attach CloudFront invalidation policy to role
            this.deploymentRole.attachInlinePolicy(cloudFrontInvalidationPolicy);
            // Create Lambda function for contact form
            const contactFunction = new lambda.Function(this, 'ContactFunction', {
                runtime: lambda.Runtime.NODEJS_18_X,
                handler: 'contact.handler',
                code: lambda.Code.fromAsset('../lambda'),
                timeout: cdk.Duration.seconds(30),
                memorySize: 256,
                environment: {
                    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
                    SMTP_PORT: process.env.SMTP_PORT || '587',
                    SMTP_USER: process.env.SMTP_USER || '',
                    SMTP_PASS: process.env.SMTP_PASS || '',
                    CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL || 'arjansubedi2021@gmail.com',
                    FROM_EMAIL: process.env.FROM_EMAIL || 'Portfolio <no-reply@arjansubedi.com>',
                    ALLOWED_ORIGIN: 'https://arjansubedi.com',
                },
                logRetention: logs.RetentionDays.ONE_WEEK,
            });
            // Create API Gateway
            this.contactApi = new apigateway.RestApi(this, 'ContactApi', {
                restApiName: 'Portfolio Contact API',
                description: 'API for portfolio contact form',
                defaultCorsPreflightOptions: {
                    allowOrigins: ['https://arjansubedi.com'],
                    allowMethods: ['POST', 'OPTIONS'],
                    allowHeaders: ['Content-Type'],
                    allowCredentials: true,
                },
            });
            // Create contact resource and method
            const contactResource = this.contactApi.root.addResource('contact');
            contactResource.addMethod('POST', new apigateway.LambdaIntegration(contactFunction));
            // Add API Gateway permissions to deployment role
            const apiGatewayPolicy = new iam.Policy(this, 'ApiGatewayPolicy', {
                policyName: 'PortfolioApiGatewayPolicy',
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: [
                            'apigateway:GET',
                            'apigateway:POST',
                        ],
                        resources: [this.contactApi.arnForExecuteApi()],
                    }),
                ],
            });
            this.deploymentRole.attachInlinePolicy(apiGatewayPolicy);
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
            if (this.contactApi) {
                new cdk.CfnOutput(this, 'ContactApiUrl', {
                    value: this.contactApi.url,
                    description: 'Contact API Gateway URL',
                    exportName: `${this.stackName}-ContactApiUrl`,
                });
            }
        }
    }
}
exports.PortfolioInfrastructureStack = PortfolioInfrastructureStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9ydGZvbGlvLWluZnJhc3RydWN0dXJlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicG9ydGZvbGlvLWluZnJhc3RydWN0dXJlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUVuQyx5Q0FBeUM7QUFDekMseURBQXlEO0FBQ3pELDhEQUE4RDtBQUM5RCwyQ0FBMkM7QUFDM0MsbURBQW1EO0FBQ25ELDJEQUEyRDtBQUMzRCwwREFBMEQ7QUFDMUQsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCw2Q0FBNkM7QUFVN0MsTUFBYSw0QkFBNkIsU0FBUSxHQUFHLENBQUMsS0FBSztJQU16RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXdDO1FBQ2hGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEdBQUcsS0FBSyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRW5HLHVEQUF1RDtRQUN2RCxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUU1RSw4Q0FBOEM7UUFDOUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FDN0IsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsVUFBVSxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEMsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUFDO1lBQ3pCLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzVDLENBQUMsQ0FDSCxDQUFD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Q3JCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7b0JBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWM7b0JBQ3ZDLFdBQVcsRUFBRSw0QkFBNEI7b0JBQ3pDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLGlCQUFpQjtpQkFDL0MsQ0FBQyxDQUFDO2dCQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7b0JBQ2hELEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLHNCQUFzQjtvQkFDL0MsV0FBVyxFQUFFLHFDQUFxQztvQkFDbEQsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMseUJBQXlCO2lCQUN2RCxDQUFDLENBQUM7Z0JBRUgsSUFBSSxVQUFVLEVBQUU7b0JBQ2QsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7d0JBQ3BDLEtBQUssRUFBRSxXQUFXLFVBQVUsRUFBRTt3QkFDOUIsV0FBVyxFQUFFLHVCQUF1Qjt3QkFDcEMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsYUFBYTtxQkFDM0MsQ0FBQyxDQUFDO2lCQUNKO2FBQ0Y7WUFFRCxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7Z0JBQ25CLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO29CQUN2QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHO29CQUMxQixXQUFXLEVBQUUseUJBQXlCO29CQUN0QyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxnQkFBZ0I7aUJBQzlDLENBQUMsQ0FBQzthQUNKO1NBQ0Y7SUFDSCxDQUFDO0NBQ0Y7QUF2UUQsb0VBdVFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1My10YXJnZXRzJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9ydGZvbGlvSW5mcmFzdHJ1Y3R1cmVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBidWNrZXROYW1lOiBzdHJpbmc7XG4gIGdpdGh1YlVzZXJuYW1lOiBzdHJpbmc7XG4gIGdpdGh1YlJlcG9OYW1lOiBzdHJpbmc7XG4gIGRvbWFpbk5hbWU/OiBzdHJpbmc7XG4gIGVuYWJsZUNsb3VkRnJvbnQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgUG9ydGZvbGlvSW5mcmFzdHJ1Y3R1cmVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBidWNrZXQ6IHMzLklCdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb24/OiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGRlcGxveW1lbnRSb2xlOiBpYW0uUm9sZTtcbiAgcHVibGljIHJlYWRvbmx5IGNvbnRhY3RBcGk/OiBhcGlnYXRld2F5LlJlc3RBcGk7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFBvcnRmb2xpb0luZnJhc3RydWN0dXJlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBidWNrZXROYW1lLCBnaXRodWJVc2VybmFtZSwgZ2l0aHViUmVwb05hbWUsIGRvbWFpbk5hbWUsIGVuYWJsZUNsb3VkRnJvbnQgPSBmYWxzZSB9ID0gcHJvcHM7XG5cbiAgICAvLyBJbXBvcnQgZXhpc3RpbmcgUzMgYnVja2V0IGZvciBzdGF0aWMgd2Vic2l0ZSBob3N0aW5nXG4gICAgdGhpcy5idWNrZXQgPSBzMy5CdWNrZXQuZnJvbUJ1Y2tldE5hbWUodGhpcywgJ1BvcnRmb2xpb0J1Y2tldCcsIGJ1Y2tldE5hbWUpO1xuXG4gICAgLy8gQ3JlYXRlIGJ1Y2tldCBwb2xpY3kgZm9yIHB1YmxpYyByZWFkIGFjY2Vzc1xuICAgIHRoaXMuYnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFt0aGlzLmJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyldLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gSW1wb3J0IGV4aXN0aW5nIE9JREMgcHJvdmlkZXIgZm9yIEdpdEh1YiBBY3Rpb25zXG4gICAgY29uc3Qgb2lkY1Byb3ZpZGVyID0gaWFtLk9wZW5JZENvbm5lY3RQcm92aWRlci5mcm9tT3BlbklkQ29ubmVjdFByb3ZpZGVyQXJuKFxuICAgICAgdGhpcyxcbiAgICAgICdHaXRIdWJPSURDUHJvdmlkZXInLFxuICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06b2lkYy1wcm92aWRlci90b2tlbi5hY3Rpb25zLmdpdGh1YnVzZXJjb250ZW50LmNvbWBcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIElBTSByb2xlIGZvciBHaXRIdWIgQWN0aW9ucyBkZXBsb3ltZW50XG4gICAgdGhpcy5kZXBsb3ltZW50Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnR2l0SHViQWN0aW9uc0RlcGxveW1lbnRSb2xlJywge1xuICAgICAgcm9sZU5hbWU6ICdHaXRIdWJBY3Rpb25zUG9ydGZvbGlvRGVwbG95JyxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5XZWJJZGVudGl0eVByaW5jaXBhbChvaWRjUHJvdmlkZXIub3BlbklkQ29ubmVjdFByb3ZpZGVyQXJuLCB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICd0b2tlbi5hY3Rpb25zLmdpdGh1YnVzZXJjb250ZW50LmNvbTphdWQnOiAnc3RzLmFtYXpvbmF3cy5jb20nLFxuICAgICAgICB9LFxuICAgICAgICBTdHJpbmdMaWtlOiB7XG4gICAgICAgICAgJ3Rva2VuLmFjdGlvbnMuZ2l0aHVidXNlcmNvbnRlbnQuY29tOnN1Yic6IGByZXBvOiR7Z2l0aHViVXNlcm5hbWV9LyR7Z2l0aHViUmVwb05hbWV9OipgLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogJ1JvbGUgZm9yIEdpdEh1YiBBY3Rpb25zIHRvIGRlcGxveSBwb3J0Zm9saW8gdG8gUzMnLFxuICAgICAgbWF4U2Vzc2lvbkR1cmF0aW9uOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIElBTSBwb2xpY3kgZm9yIFMzIGRlcGxveW1lbnRcbiAgICAgICAgICAgICAgICBjb25zdCBzM0RlcGxveW1lbnRQb2xpY3kgPSBuZXcgaWFtLlBvbGljeSh0aGlzLCAnUzNEZXBsb3ltZW50UG9saWN5Jywge1xuICAgICAgICAgICAgICAgICAgcG9saWN5TmFtZTogJ1BvcnRmb2xpb1MzRGVwbG95bWVudFBvbGljeScsXG4gICAgICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3MzOkxpc3RCdWNrZXQnLFxuICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyksXG4gICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gQXR0YWNoIFMzIGRlcGxveW1lbnQgcG9saWN5IHRvIHJvbGVcbiAgICAgICAgICAgICAgICB0aGlzLmRlcGxveW1lbnRSb2xlLmF0dGFjaElubGluZVBvbGljeShzM0RlcGxveW1lbnRQb2xpY3kpO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gKG9wdGlvbmFsKVxuICAgIGlmIChlbmFibGVDbG91ZEZyb250KSB7XG4gICAgICBsZXQgY2VydGlmaWNhdGU6IGFjbS5JQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgaG9zdGVkWm9uZTogcm91dGU1My5JSG9zdGVkWm9uZSB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gSWYgZG9tYWluIG5hbWUgaXMgcHJvdmlkZWQsIGNyZWF0ZSBjZXJ0aWZpY2F0ZSBhbmQgaG9zdGVkIHpvbmVcbiAgICAgIGlmIChkb21haW5OYW1lKSB7XG4gICAgICAgIC8vIExvb2sgdXAgdGhlIGV4aXN0aW5nIGhvc3RlZCB6b25lXG4gICAgICAgIGhvc3RlZFpvbmUgPSByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUxvb2t1cCh0aGlzLCAnSG9zdGVkWm9uZScsIHtcbiAgICAgICAgICBkb21haW5OYW1lOiBkb21haW5OYW1lLnNwbGl0KCcuJykuc2xpY2UoLTIpLmpvaW4oJy4nKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQ3JlYXRlIFNTTCBjZXJ0aWZpY2F0ZVxuICAgICAgICBjZXJ0aWZpY2F0ZSA9IG5ldyBhY20uQ2VydGlmaWNhdGUodGhpcywgJ0NlcnRpZmljYXRlJywge1xuICAgICAgICAgIGRvbWFpbk5hbWUsXG4gICAgICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXM6IFtgKi4ke2RvbWFpbk5hbWV9YF0sXG4gICAgICAgICAgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKGhvc3RlZFpvbmUpLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uXG4gICAgICB0aGlzLmRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnUG9ydGZvbGlvRGlzdHJpYnV0aW9uJywge1xuICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYCR7YnVja2V0TmFtZX0uczMtd2Vic2l0ZS0ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tYCwge1xuICAgICAgICAgICAgcHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUHJvdG9jb2xQb2xpY3kuSFRUUF9PTkxZLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5VU0VSX0FHRU5UX1JFRkVSRVJfSEVBREVSUyxcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgZG9tYWluTmFtZXM6IGRvbWFpbk5hbWUgPyBbZG9tYWluTmFtZV0gOiB1bmRlZmluZWQsXG4gICAgICAgIGNlcnRpZmljYXRlLFxuICAgICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMTAwLFxuICAgICAgICBlbmFibGVMb2dnaW5nOiBmYWxzZSxcbiAgICAgICAgLy8gQWRkaXRpb25hbCBzZXR0aW5ncyBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JlYXRlIFJvdXRlIDUzIHJlY29yZHMgaWYgZG9tYWluIGlzIHByb3ZpZGVkXG4gICAgICBpZiAoZG9tYWluTmFtZSAmJiBob3N0ZWRab25lKSB7XG4gICAgICAgIC8vIEEgcmVjb3JkIGZvciB0aGUgcm9vdCBkb21haW5cbiAgICAgICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnUG9ydGZvbGlvQVJlY29yZCcsIHtcbiAgICAgICAgICB6b25lOiBob3N0ZWRab25lLFxuICAgICAgICAgIHJlY29yZE5hbWU6IGRvbWFpbk5hbWUsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMoXG4gICAgICAgICAgICBuZXcgdGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHRoaXMuZGlzdHJpYnV0aW9uKVxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFBQUEgcmVjb3JkIGZvciBJUHY2IHN1cHBvcnRcbiAgICAgICAgbmV3IHJvdXRlNTMuQWFhYVJlY29yZCh0aGlzLCAnUG9ydGZvbGlvQWFhYVJlY29yZCcsIHtcbiAgICAgICAgICB6b25lOiBob3N0ZWRab25lLFxuICAgICAgICAgIHJlY29yZE5hbWU6IGRvbWFpbk5hbWUsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMoXG4gICAgICAgICAgICBuZXcgdGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHRoaXMuZGlzdHJpYnV0aW9uKVxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgSUFNIHBvbGljeSBmb3IgQ2xvdWRGcm9udCBpbnZhbGlkYXRpb25cbiAgICAgIGNvbnN0IGNsb3VkRnJvbnRJbnZhbGlkYXRpb25Qb2xpY3kgPSBuZXcgaWFtLlBvbGljeSh0aGlzLCAnQ2xvdWRGcm9udEludmFsaWRhdGlvblBvbGljeScsIHtcbiAgICAgICAgcG9saWN5TmFtZTogJ1BvcnRmb2xpb0Nsb3VkRnJvbnRJbnZhbGlkYXRpb25Qb2xpY3knLFxuICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpDcmVhdGVJbnZhbGlkYXRpb24nLFxuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpHZXRJbnZhbGlkYXRpb24nLFxuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpMaXN0SW52YWxpZGF0aW9ucycsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6Y2xvdWRmcm9udDo6JHt0aGlzLmFjY291bnR9OmRpc3RyaWJ1dGlvbi8qYF0sXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICB9KTtcblxuICAgICAgLy8gQXR0YWNoIENsb3VkRnJvbnQgaW52YWxpZGF0aW9uIHBvbGljeSB0byByb2xlXG4gICAgICB0aGlzLmRlcGxveW1lbnRSb2xlLmF0dGFjaElubGluZVBvbGljeShjbG91ZEZyb250SW52YWxpZGF0aW9uUG9saWN5KTtcblxuICAgICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiBmb3IgY29udGFjdCBmb3JtXG4gICAgICBjb25zdCBjb250YWN0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDb250YWN0RnVuY3Rpb24nLCB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgICBoYW5kbGVyOiAnY29udGFjdC5oYW5kbGVyJyxcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9sYW1iZGEnKSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgU01UUF9IT1NUOiBwcm9jZXNzLmVudi5TTVRQX0hPU1QgfHwgJ3NtdHAuZ21haWwuY29tJyxcbiAgICAgICAgICBTTVRQX1BPUlQ6IHByb2Nlc3MuZW52LlNNVFBfUE9SVCB8fCAnNTg3JyxcbiAgICAgICAgICBTTVRQX1VTRVI6IHByb2Nlc3MuZW52LlNNVFBfVVNFUiB8fCAnJyxcbiAgICAgICAgICBTTVRQX1BBU1M6IHByb2Nlc3MuZW52LlNNVFBfUEFTUyB8fCAnJyxcbiAgICAgICAgICBDT05UQUNUX1RPX0VNQUlMOiBwcm9jZXNzLmVudi5DT05UQUNUX1RPX0VNQUlMIHx8ICdhcmphbnN1YmVkaTIwMjFAZ21haWwuY29tJyxcbiAgICAgICAgICBGUk9NX0VNQUlMOiBwcm9jZXNzLmVudi5GUk9NX0VNQUlMIHx8ICdQb3J0Zm9saW8gPG5vLXJlcGx5QGFyamFuc3ViZWRpLmNvbT4nLFxuICAgICAgICAgIEFMTE9XRURfT1JJR0lOOiAnaHR0cHM6Ly9hcmphbnN1YmVkaS5jb20nLFxuICAgICAgICB9LFxuICAgICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXlcbiAgICAgIHRoaXMuY29udGFjdEFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0NvbnRhY3RBcGknLCB7XG4gICAgICAgIHJlc3RBcGlOYW1lOiAnUG9ydGZvbGlvIENvbnRhY3QgQVBJJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIHBvcnRmb2xpbyBjb250YWN0IGZvcm0nLFxuICAgICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgICBhbGxvd09yaWdpbnM6IFsnaHR0cHM6Ly9hcmphbnN1YmVkaS5jb20nXSxcbiAgICAgICAgICBhbGxvd01ldGhvZHM6IFsnUE9TVCcsICdPUFRJT05TJ10sXG4gICAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZSddLFxuICAgICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JlYXRlIGNvbnRhY3QgcmVzb3VyY2UgYW5kIG1ldGhvZFxuICAgICAgY29uc3QgY29udGFjdFJlc291cmNlID0gdGhpcy5jb250YWN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2NvbnRhY3QnKTtcbiAgICAgIGNvbnRhY3RSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjb250YWN0RnVuY3Rpb24pKTtcblxuICAgICAgLy8gQWRkIEFQSSBHYXRld2F5IHBlcm1pc3Npb25zIHRvIGRlcGxveW1lbnQgcm9sZVxuICAgICAgY29uc3QgYXBpR2F0ZXdheVBvbGljeSA9IG5ldyBpYW0uUG9saWN5KHRoaXMsICdBcGlHYXRld2F5UG9saWN5Jywge1xuICAgICAgICBwb2xpY3lOYW1lOiAnUG9ydGZvbGlvQXBpR2F0ZXdheVBvbGljeScsXG4gICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICdhcGlnYXRld2F5OkdFVCcsXG4gICAgICAgICAgICAgICdhcGlnYXRld2F5OlBPU1QnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW3RoaXMuY29udGFjdEFwaS5hcm5Gb3JFeGVjdXRlQXBpKCldLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuZGVwbG95bWVudFJvbGUuYXR0YWNoSW5saW5lUG9saWN5KGFwaUdhdGV3YXlQb2xpY3kpO1xuXG4gICAgICAvLyBPdXRwdXRzXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQnVja2V0TmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IG5hbWUgZm9yIHBvcnRmb2xpbyBob3N0aW5nJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUJ1Y2tldE5hbWVgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCdWNrZXRXZWJzaXRlVXJsJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5idWNrZXQuYnVja2V0V2Vic2l0ZVVybCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTMyBidWNrZXQgd2Vic2l0ZSBVUkwnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQnVja2V0V2Vic2l0ZVVybGAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RlcGxveW1lbnRSb2xlQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kZXBsb3ltZW50Um9sZS5yb2xlQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0lBTSByb2xlIEFSTiBmb3IgR2l0SHViIEFjdGlvbnMgZGVwbG95bWVudCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1EZXBsb3ltZW50Um9sZUFybmAsXG4gICAgICB9KTtcblxuICAgICAgaWYgKHRoaXMuZGlzdHJpYnV0aW9uKSB7XG4gICAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEaXN0cmlidXRpb25JZCcsIHtcbiAgICAgICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBJRCcsXG4gICAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURpc3RyaWJ1dGlvbklkYCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rpc3RyaWJ1dGlvbkRvbWFpbk5hbWUnLCB7XG4gICAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBkb21haW4gbmFtZScsXG4gICAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURpc3RyaWJ1dGlvbkRvbWFpbk5hbWVgLFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoZG9tYWluTmFtZSkge1xuICAgICAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJzaXRlVXJsJywge1xuICAgICAgICAgICAgdmFsdWU6IGBodHRwczovLyR7ZG9tYWluTmFtZX1gLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQb3J0Zm9saW8gd2Vic2l0ZSBVUkwnLFxuICAgICAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVdlYnNpdGVVcmxgLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLmNvbnRhY3RBcGkpIHtcbiAgICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbnRhY3RBcGlVcmwnLCB7XG4gICAgICAgICAgdmFsdWU6IHRoaXMuY29udGFjdEFwaS51cmwsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdDb250YWN0IEFQSSBHYXRld2F5IFVSTCcsXG4gICAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUNvbnRhY3RBcGlVcmxgLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==