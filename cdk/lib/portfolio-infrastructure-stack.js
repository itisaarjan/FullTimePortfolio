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
exports.PortfolioInfrastructureStack = PortfolioInfrastructureStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9ydGZvbGlvLWluZnJhc3RydWN0dXJlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicG9ydGZvbGlvLWluZnJhc3RydWN0dXJlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUVuQyx5Q0FBeUM7QUFDekMseURBQXlEO0FBQ3pELDhEQUE4RDtBQUM5RCwyQ0FBMkM7QUFDM0MsbURBQW1EO0FBQ25ELDJEQUEyRDtBQUMzRCwwREFBMEQ7QUFVMUQsTUFBYSw0QkFBNkIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUt6RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXdDO1FBQ2hGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEdBQUcsS0FBSyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRW5HLHVEQUF1RDtRQUN2RCxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUU1RSw4Q0FBOEM7UUFDOUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FDN0IsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsVUFBVSxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEMsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUFDO1lBQ3pCLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzVDLENBQUMsQ0FDSCxDQUFDO1FBRUYsbURBQW1EO1FBQ25ELE1BQU0sWUFBWSxHQUFHLEdBQUcs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QkFBZ0IsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7Q0FDRjtBQTlNRCxvRUE4TUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgcm91dGU1MyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1Myc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yb3V0ZTUzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgYWNtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBvcnRmb2xpb0luZnJhc3RydWN0dXJlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgYnVja2V0TmFtZTogc3RyaW5nO1xuICBnaXRodWJVc2VybmFtZTogc3RyaW5nO1xuICBnaXRodWJSZXBvTmFtZTogc3RyaW5nO1xuICBkb21haW5OYW1lPzogc3RyaW5nO1xuICBlbmFibGVDbG91ZEZyb250PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIFBvcnRmb2xpb0luZnJhc3RydWN0dXJlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYnVja2V0OiBzMy5JQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZGlzdHJpYnV0aW9uPzogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyByZWFkb25seSBkZXBsb3ltZW50Um9sZTogaWFtLlJvbGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFBvcnRmb2xpb0luZnJhc3RydWN0dXJlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBidWNrZXROYW1lLCBnaXRodWJVc2VybmFtZSwgZ2l0aHViUmVwb05hbWUsIGRvbWFpbk5hbWUsIGVuYWJsZUNsb3VkRnJvbnQgPSBmYWxzZSB9ID0gcHJvcHM7XG5cbiAgICAvLyBJbXBvcnQgZXhpc3RpbmcgUzMgYnVja2V0IGZvciBzdGF0aWMgd2Vic2l0ZSBob3N0aW5nXG4gICAgdGhpcy5idWNrZXQgPSBzMy5CdWNrZXQuZnJvbUJ1Y2tldE5hbWUodGhpcywgJ1BvcnRmb2xpb0J1Y2tldCcsIGJ1Y2tldE5hbWUpO1xuXG4gICAgLy8gQ3JlYXRlIGJ1Y2tldCBwb2xpY3kgZm9yIHB1YmxpYyByZWFkIGFjY2Vzc1xuICAgIHRoaXMuYnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgICByZXNvdXJjZXM6IFt0aGlzLmJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyldLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gSW1wb3J0IGV4aXN0aW5nIE9JREMgcHJvdmlkZXIgZm9yIEdpdEh1YiBBY3Rpb25zXG4gICAgY29uc3Qgb2lkY1Byb3ZpZGVyID0gaWFtLk9wZW5JZENvbm5lY3RQcm92aWRlci5mcm9tT3BlbklkQ29ubmVjdFByb3ZpZGVyQXJuKFxuICAgICAgdGhpcyxcbiAgICAgICdHaXRIdWJPSURDUHJvdmlkZXInLFxuICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06b2lkYy1wcm92aWRlci90b2tlbi5hY3Rpb25zLmdpdGh1YnVzZXJjb250ZW50LmNvbWBcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIElBTSByb2xlIGZvciBHaXRIdWIgQWN0aW9ucyBkZXBsb3ltZW50XG4gICAgdGhpcy5kZXBsb3ltZW50Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnR2l0SHViQWN0aW9uc0RlcGxveW1lbnRSb2xlJywge1xuICAgICAgcm9sZU5hbWU6ICdHaXRIdWJBY3Rpb25zUG9ydGZvbGlvRGVwbG95JyxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5XZWJJZGVudGl0eVByaW5jaXBhbChvaWRjUHJvdmlkZXIub3BlbklkQ29ubmVjdFByb3ZpZGVyQXJuLCB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICd0b2tlbi5hY3Rpb25zLmdpdGh1YnVzZXJjb250ZW50LmNvbTphdWQnOiAnc3RzLmFtYXpvbmF3cy5jb20nLFxuICAgICAgICB9LFxuICAgICAgICBTdHJpbmdMaWtlOiB7XG4gICAgICAgICAgJ3Rva2VuLmFjdGlvbnMuZ2l0aHVidXNlcmNvbnRlbnQuY29tOnN1Yic6IGByZXBvOiR7Z2l0aHViVXNlcm5hbWV9LyR7Z2l0aHViUmVwb05hbWV9OipgLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogJ1JvbGUgZm9yIEdpdEh1YiBBY3Rpb25zIHRvIGRlcGxveSBwb3J0Zm9saW8gdG8gUzMnLFxuICAgICAgbWF4U2Vzc2lvbkR1cmF0aW9uOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIElBTSBwb2xpY3kgZm9yIFMzIGRlcGxveW1lbnRcbiAgICAgICAgICAgICAgICBjb25zdCBzM0RlcGxveW1lbnRQb2xpY3kgPSBuZXcgaWFtLlBvbGljeSh0aGlzLCAnUzNEZXBsb3ltZW50UG9saWN5Jywge1xuICAgICAgICAgICAgICAgICAgcG9saWN5TmFtZTogJ1BvcnRmb2xpb1MzRGVwbG95bWVudFBvbGljeScsXG4gICAgICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3MzOkxpc3RCdWNrZXQnLFxuICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyksXG4gICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gQXR0YWNoIFMzIGRlcGxveW1lbnQgcG9saWN5IHRvIHJvbGVcbiAgICAgICAgICAgICAgICB0aGlzLmRlcGxveW1lbnRSb2xlLmF0dGFjaElubGluZVBvbGljeShzM0RlcGxveW1lbnRQb2xpY3kpO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gKG9wdGlvbmFsKVxuICAgIGlmIChlbmFibGVDbG91ZEZyb250KSB7XG4gICAgICBsZXQgY2VydGlmaWNhdGU6IGFjbS5JQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgaG9zdGVkWm9uZTogcm91dGU1My5JSG9zdGVkWm9uZSB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gSWYgZG9tYWluIG5hbWUgaXMgcHJvdmlkZWQsIGNyZWF0ZSBjZXJ0aWZpY2F0ZSBhbmQgaG9zdGVkIHpvbmVcbiAgICAgIGlmIChkb21haW5OYW1lKSB7XG4gICAgICAgIC8vIExvb2sgdXAgdGhlIGV4aXN0aW5nIGhvc3RlZCB6b25lXG4gICAgICAgIGhvc3RlZFpvbmUgPSByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUxvb2t1cCh0aGlzLCAnSG9zdGVkWm9uZScsIHtcbiAgICAgICAgICBkb21haW5OYW1lOiBkb21haW5OYW1lLnNwbGl0KCcuJykuc2xpY2UoLTIpLmpvaW4oJy4nKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQ3JlYXRlIFNTTCBjZXJ0aWZpY2F0ZVxuICAgICAgICBjZXJ0aWZpY2F0ZSA9IG5ldyBhY20uQ2VydGlmaWNhdGUodGhpcywgJ0NlcnRpZmljYXRlJywge1xuICAgICAgICAgIGRvbWFpbk5hbWUsXG4gICAgICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXM6IFtgKi4ke2RvbWFpbk5hbWV9YF0sXG4gICAgICAgICAgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKGhvc3RlZFpvbmUpLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uXG4gICAgICB0aGlzLmRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnUG9ydGZvbGlvRGlzdHJpYnV0aW9uJywge1xuICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYCR7YnVja2V0TmFtZX0uczMtd2Vic2l0ZS0ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tYCwge1xuICAgICAgICAgICAgcHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUHJvdG9jb2xQb2xpY3kuSFRUUF9PTkxZLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5VU0VSX0FHRU5UX1JFRkVSRVJfSEVBREVSUyxcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgZG9tYWluTmFtZXM6IGRvbWFpbk5hbWUgPyBbZG9tYWluTmFtZV0gOiB1bmRlZmluZWQsXG4gICAgICAgIGNlcnRpZmljYXRlLFxuICAgICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMTAwLFxuICAgICAgICBlbmFibGVMb2dnaW5nOiBmYWxzZSxcbiAgICAgICAgLy8gQWRkaXRpb25hbCBzZXR0aW5ncyBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JlYXRlIFJvdXRlIDUzIHJlY29yZHMgaWYgZG9tYWluIGlzIHByb3ZpZGVkXG4gICAgICBpZiAoZG9tYWluTmFtZSAmJiBob3N0ZWRab25lKSB7XG4gICAgICAgIC8vIEEgcmVjb3JkIGZvciB0aGUgcm9vdCBkb21haW5cbiAgICAgICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnUG9ydGZvbGlvQVJlY29yZCcsIHtcbiAgICAgICAgICB6b25lOiBob3N0ZWRab25lLFxuICAgICAgICAgIHJlY29yZE5hbWU6IGRvbWFpbk5hbWUsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMoXG4gICAgICAgICAgICBuZXcgdGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHRoaXMuZGlzdHJpYnV0aW9uKVxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFBQUEgcmVjb3JkIGZvciBJUHY2IHN1cHBvcnRcbiAgICAgICAgbmV3IHJvdXRlNTMuQWFhYVJlY29yZCh0aGlzLCAnUG9ydGZvbGlvQWFhYVJlY29yZCcsIHtcbiAgICAgICAgICB6b25lOiBob3N0ZWRab25lLFxuICAgICAgICAgIHJlY29yZE5hbWU6IGRvbWFpbk5hbWUsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMoXG4gICAgICAgICAgICBuZXcgdGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHRoaXMuZGlzdHJpYnV0aW9uKVxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgSUFNIHBvbGljeSBmb3IgQ2xvdWRGcm9udCBpbnZhbGlkYXRpb25cbiAgICAgIGNvbnN0IGNsb3VkRnJvbnRJbnZhbGlkYXRpb25Qb2xpY3kgPSBuZXcgaWFtLlBvbGljeSh0aGlzLCAnQ2xvdWRGcm9udEludmFsaWRhdGlvblBvbGljeScsIHtcbiAgICAgICAgcG9saWN5TmFtZTogJ1BvcnRmb2xpb0Nsb3VkRnJvbnRJbnZhbGlkYXRpb25Qb2xpY3knLFxuICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpDcmVhdGVJbnZhbGlkYXRpb24nLFxuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpHZXRJbnZhbGlkYXRpb24nLFxuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpMaXN0SW52YWxpZGF0aW9ucycsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6Y2xvdWRmcm9udDo6JHt0aGlzLmFjY291bnR9OmRpc3RyaWJ1dGlvbi8qYF0sXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICB9KTtcblxuICAgICAgLy8gQXR0YWNoIENsb3VkRnJvbnQgaW52YWxpZGF0aW9uIHBvbGljeSB0byByb2xlXG4gICAgICB0aGlzLmRlcGxveW1lbnRSb2xlLmF0dGFjaElubGluZVBvbGljeShjbG91ZEZyb250SW52YWxpZGF0aW9uUG9saWN5KTtcbiAgICB9XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5idWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IG5hbWUgZm9yIHBvcnRmb2xpbyBob3N0aW5nJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CdWNrZXROYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCdWNrZXRXZWJzaXRlVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuYnVja2V0LmJ1Y2tldFdlYnNpdGVVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCB3ZWJzaXRlIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQnVja2V0V2Vic2l0ZVVybGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwbG95bWVudFJvbGVBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kZXBsb3ltZW50Um9sZS5yb2xlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdJQU0gcm9sZSBBUk4gZm9yIEdpdEh1YiBBY3Rpb25zIGRlcGxveW1lbnQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURlcGxveW1lbnRSb2xlQXJuYCxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmRpc3RyaWJ1dGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rpc3RyaWJ1dGlvbklkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRGlzdHJpYnV0aW9uSWRgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEaXN0cmlidXRpb25Eb21haW5OYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBkb21haW4gbmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1EaXN0cmlidXRpb25Eb21haW5OYW1lYCxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoZG9tYWluTmFtZSkge1xuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2Vic2l0ZVVybCcsIHtcbiAgICAgICAgICB2YWx1ZTogYGh0dHBzOi8vJHtkb21haW5OYW1lfWAsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdQb3J0Zm9saW8gd2Vic2l0ZSBVUkwnLFxuICAgICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1XZWJzaXRlVXJsYCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQWRkIHRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1NlcnZpY2UnLCAnUG9ydGZvbGlvJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb21wb25lbnQnLCAnSW5mcmFzdHJ1Y3R1cmUnKTtcbiAgfVxufVxuIl19