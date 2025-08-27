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
                    originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
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
                        resources: [`arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9ydGZvbGlvLWluZnJhc3RydWN0dXJlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicG9ydGZvbGlvLWluZnJhc3RydWN0dXJlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUVuQyx5Q0FBeUM7QUFDekMseURBQXlEO0FBQ3pELDhEQUE4RDtBQUM5RCwyQ0FBMkM7QUFDM0MsbURBQW1EO0FBQ25ELDJEQUEyRDtBQUMzRCwwREFBMEQ7QUFVMUQsTUFBYSw0QkFBNkIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUt6RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXdDO1FBQ2hGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEdBQUcsS0FBSyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRW5HLHVEQUF1RDtRQUN2RCxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUU1RSw4Q0FBOEM7UUFDOUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FDN0IsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsVUFBVSxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEMsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUFDO1lBQ3pCLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzVDLENBQUMsQ0FDSCxDQUFDO1FBRUYsbURBQW1EO1FBQ25ELE1BQU0sWUFBWSxHQUFHLEdBQUcs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QyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUN2RCxDQUFDO0NBQ0Y7QUE5TUQsb0VBOE1DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1My10YXJnZXRzJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcblxuZXhwb3J0IGludGVyZmFjZSBQb3J0Zm9saW9JbmZyYXN0cnVjdHVyZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGJ1Y2tldE5hbWU6IHN0cmluZztcbiAgZ2l0aHViVXNlcm5hbWU6IHN0cmluZztcbiAgZ2l0aHViUmVwb05hbWU6IHN0cmluZztcbiAgZG9tYWluTmFtZT86IHN0cmluZztcbiAgZW5hYmxlQ2xvdWRGcm9udD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBQb3J0Zm9saW9JbmZyYXN0cnVjdHVyZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGJ1Y2tldDogczMuSUJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGRpc3RyaWJ1dGlvbj86IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZGVwbG95bWVudFJvbGU6IGlhbS5Sb2xlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBQb3J0Zm9saW9JbmZyYXN0cnVjdHVyZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgYnVja2V0TmFtZSwgZ2l0aHViVXNlcm5hbWUsIGdpdGh1YlJlcG9OYW1lLCBkb21haW5OYW1lLCBlbmFibGVDbG91ZEZyb250ID0gZmFsc2UgfSA9IHByb3BzO1xuXG4gICAgLy8gSW1wb3J0IGV4aXN0aW5nIFMzIGJ1Y2tldCBmb3Igc3RhdGljIHdlYnNpdGUgaG9zdGluZ1xuICAgIHRoaXMuYnVja2V0ID0gczMuQnVja2V0LmZyb21CdWNrZXROYW1lKHRoaXMsICdQb3J0Zm9saW9CdWNrZXQnLCBidWNrZXROYW1lKTtcblxuICAgIC8vIENyZWF0ZSBidWNrZXQgcG9saWN5IGZvciBwdWJsaWMgcmVhZCBhY2Nlc3NcbiAgICB0aGlzLmJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLkFueVByaW5jaXBhbCgpXSxcbiAgICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbdGhpcy5idWNrZXQuYXJuRm9yT2JqZWN0cygnKicpXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEltcG9ydCBleGlzdGluZyBPSURDIHByb3ZpZGVyIGZvciBHaXRIdWIgQWN0aW9uc1xuICAgIGNvbnN0IG9pZGNQcm92aWRlciA9IGlhbS5PcGVuSWRDb25uZWN0UHJvdmlkZXIuZnJvbU9wZW5JZENvbm5lY3RQcm92aWRlckFybihcbiAgICAgIHRoaXMsXG4gICAgICAnR2l0SHViT0lEQ1Byb3ZpZGVyJyxcbiAgICAgIGBhcm46YXdzOmlhbTo6JHt0aGlzLmFjY291bnR9Om9pZGMtcHJvdmlkZXIvdG9rZW4uYWN0aW9ucy5naXRodWJ1c2VyY29udGVudC5jb21gXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZSBmb3IgR2l0SHViIEFjdGlvbnMgZGVwbG95bWVudFxuICAgIHRoaXMuZGVwbG95bWVudFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0dpdEh1YkFjdGlvbnNEZXBsb3ltZW50Um9sZScsIHtcbiAgICAgIHJvbGVOYW1lOiAnR2l0SHViQWN0aW9uc1BvcnRmb2xpb0RlcGxveScsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uV2ViSWRlbnRpdHlQcmluY2lwYWwob2lkY1Byb3ZpZGVyLm9wZW5JZENvbm5lY3RQcm92aWRlckFybiwge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAndG9rZW4uYWN0aW9ucy5naXRodWJ1c2VyY29udGVudC5jb206YXVkJzogJ3N0cy5hbWF6b25hd3MuY29tJyxcbiAgICAgICAgfSxcbiAgICAgICAgU3RyaW5nTGlrZToge1xuICAgICAgICAgICd0b2tlbi5hY3Rpb25zLmdpdGh1YnVzZXJjb250ZW50LmNvbTpzdWInOiBgcmVwbzoke2dpdGh1YlVzZXJuYW1lfS8ke2dpdGh1YlJlcG9OYW1lfToqYCxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgZGVzY3JpcHRpb246ICdSb2xlIGZvciBHaXRIdWIgQWN0aW9ucyB0byBkZXBsb3kgcG9ydGZvbGlvIHRvIFMzJyxcbiAgICAgIG1heFNlc3Npb25EdXJhdGlvbjogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIElBTSBwb2xpY3kgZm9yIFMzIGRlcGxveW1lbnRcbiAgICBjb25zdCBzM0RlcGxveW1lbnRQb2xpY3kgPSBuZXcgaWFtLlBvbGljeSh0aGlzLCAnUzNEZXBsb3ltZW50UG9saWN5Jywge1xuICAgICAgcG9saWN5TmFtZTogJ1BvcnRmb2xpb1MzRGVwbG95bWVudFBvbGljeScsXG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAgICAgJ3MzOkxpc3RCdWNrZXQnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICB0aGlzLmJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICB0aGlzLmJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQXR0YWNoIFMzIGRlcGxveW1lbnQgcG9saWN5IHRvIHJvbGVcbiAgICB0aGlzLmRlcGxveW1lbnRSb2xlLmF0dGFjaElubGluZVBvbGljeShzM0RlcGxveW1lbnRQb2xpY3kpO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gKG9wdGlvbmFsKVxuICAgIGlmIChlbmFibGVDbG91ZEZyb250KSB7XG4gICAgICBsZXQgY2VydGlmaWNhdGU6IGFjbS5JQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgaG9zdGVkWm9uZTogcm91dGU1My5JSG9zdGVkWm9uZSB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gSWYgZG9tYWluIG5hbWUgaXMgcHJvdmlkZWQsIGNyZWF0ZSBjZXJ0aWZpY2F0ZSBhbmQgaG9zdGVkIHpvbmVcbiAgICAgIGlmIChkb21haW5OYW1lKSB7XG4gICAgICAgIC8vIExvb2sgdXAgdGhlIGV4aXN0aW5nIGhvc3RlZCB6b25lXG4gICAgICAgIGhvc3RlZFpvbmUgPSByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUxvb2t1cCh0aGlzLCAnSG9zdGVkWm9uZScsIHtcbiAgICAgICAgICBkb21haW5OYW1lOiBkb21haW5OYW1lLnNwbGl0KCcuJykuc2xpY2UoLTIpLmpvaW4oJy4nKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQ3JlYXRlIFNTTCBjZXJ0aWZpY2F0ZVxuICAgICAgICBjZXJ0aWZpY2F0ZSA9IG5ldyBhY20uQ2VydGlmaWNhdGUodGhpcywgJ0NlcnRpZmljYXRlJywge1xuICAgICAgICAgIGRvbWFpbk5hbWUsXG4gICAgICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXM6IFtgKi4ke2RvbWFpbk5hbWV9YF0sXG4gICAgICAgICAgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKGhvc3RlZFpvbmUpLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uXG4gICAgICB0aGlzLmRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnUG9ydGZvbGlvRGlzdHJpYnV0aW9uJywge1xuICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oYCR7YnVja2V0TmFtZX0uczMtd2Vic2l0ZS0ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tYCwge1xuICAgICAgICAgICAgcHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUHJvdG9jb2xQb2xpY3kuSFRUUF9PTkxZLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5DT1JTX1MzX09SSUdJTixcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgZG9tYWluTmFtZXM6IGRvbWFpbk5hbWUgPyBbZG9tYWluTmFtZV0gOiB1bmRlZmluZWQsXG4gICAgICAgIGNlcnRpZmljYXRlLFxuICAgICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMTAwLFxuICAgICAgICBlbmFibGVMb2dnaW5nOiBmYWxzZSxcbiAgICAgICAgLy8gQWRkaXRpb25hbCBzZXR0aW5ncyBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JlYXRlIFJvdXRlIDUzIHJlY29yZHMgaWYgZG9tYWluIGlzIHByb3ZpZGVkXG4gICAgICBpZiAoZG9tYWluTmFtZSAmJiBob3N0ZWRab25lKSB7XG4gICAgICAgIC8vIEEgcmVjb3JkIGZvciB0aGUgcm9vdCBkb21haW5cbiAgICAgICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnUG9ydGZvbGlvQVJlY29yZCcsIHtcbiAgICAgICAgICB6b25lOiBob3N0ZWRab25lLFxuICAgICAgICAgIHJlY29yZE5hbWU6IGRvbWFpbk5hbWUsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMoXG4gICAgICAgICAgICBuZXcgdGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHRoaXMuZGlzdHJpYnV0aW9uKVxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFBQUEgcmVjb3JkIGZvciBJUHY2IHN1cHBvcnRcbiAgICAgICAgbmV3IHJvdXRlNTMuQWFhYVJlY29yZCh0aGlzLCAnUG9ydGZvbGlvQWFhYVJlY29yZCcsIHtcbiAgICAgICAgICB6b25lOiBob3N0ZWRab25lLFxuICAgICAgICAgIHJlY29yZE5hbWU6IGRvbWFpbk5hbWUsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMoXG4gICAgICAgICAgICBuZXcgdGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHRoaXMuZGlzdHJpYnV0aW9uKVxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBDcmVhdGUgSUFNIHBvbGljeSBmb3IgQ2xvdWRGcm9udCBpbnZhbGlkYXRpb25cbiAgICAgIGNvbnN0IGNsb3VkRnJvbnRJbnZhbGlkYXRpb25Qb2xpY3kgPSBuZXcgaWFtLlBvbGljeSh0aGlzLCAnQ2xvdWRGcm9udEludmFsaWRhdGlvblBvbGljeScsIHtcbiAgICAgICAgcG9saWN5TmFtZTogJ1BvcnRmb2xpb0Nsb3VkRnJvbnRJbnZhbGlkYXRpb25Qb2xpY3knLFxuICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpDcmVhdGVJbnZhbGlkYXRpb24nLFxuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpHZXRJbnZhbGlkYXRpb24nLFxuICAgICAgICAgICAgICAnY2xvdWRmcm9udDpMaXN0SW52YWxpZGF0aW9ucycsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6Y2xvdWRmcm9udDo6JHt0aGlzLmFjY291bnR9OmRpc3RyaWJ1dGlvbi8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkfWBdLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEF0dGFjaCBDbG91ZEZyb250IGludmFsaWRhdGlvbiBwb2xpY3kgdG8gcm9sZVxuICAgICAgdGhpcy5kZXBsb3ltZW50Um9sZS5hdHRhY2hJbmxpbmVQb2xpY3koY2xvdWRGcm9udEludmFsaWRhdGlvblBvbGljeSk7XG4gICAgfVxuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuYnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBuYW1lIGZvciBwb3J0Zm9saW8gaG9zdGluZycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQnVja2V0TmFtZWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQnVja2V0V2Vic2l0ZVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmJ1Y2tldC5idWNrZXRXZWJzaXRlVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBidWNrZXQgd2Vic2l0ZSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUJ1Y2tldFdlYnNpdGVVcmxgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RlcGxveW1lbnRSb2xlQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGVwbG95bWVudFJvbGUucm9sZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnSUFNIHJvbGUgQVJOIGZvciBHaXRIdWIgQWN0aW9ucyBkZXBsb3ltZW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1EZXBsb3ltZW50Um9sZUFybmAsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5kaXN0cmlidXRpb24pIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEaXN0cmlidXRpb25JZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURpc3RyaWJ1dGlvbklkYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uRG9tYWluTmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZG9tYWluIG5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRGlzdHJpYnV0aW9uRG9tYWluTmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgaWYgKGRvbWFpbk5hbWUpIHtcbiAgICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYnNpdGVVcmwnLCB7XG4gICAgICAgICAgdmFsdWU6IGBodHRwczovLyR7ZG9tYWluTmFtZX1gLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUG9ydGZvbGlvIHdlYnNpdGUgVVJMJyxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tV2Vic2l0ZVVybGAsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFkZCB0YWdzXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZXJ2aWNlJywgJ1BvcnRmb2xpbycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0luZnJhc3RydWN0dXJlJyk7XG4gIH1cbn1cbiJdfQ==