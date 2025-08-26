import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
export interface PortfolioInfrastructureStackProps extends cdk.StackProps {
    bucketName: string;
    githubUsername: string;
    githubRepoName: string;
    domainName?: string;
    enableCloudFront?: boolean;
}
export declare class PortfolioInfrastructureStack extends cdk.Stack {
    readonly bucket: s3.IBucket;
    readonly distribution?: cloudfront.Distribution;
    readonly deploymentRole: iam.Role;
    constructor(scope: Construct, id: string, props: PortfolioInfrastructureStackProps);
}
