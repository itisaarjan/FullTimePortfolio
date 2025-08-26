#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PortfolioInfrastructureStack } from '../lib/portfolio-infrastructure-stack';

const app = new cdk.App();

// Get configuration from context or environment variables
const bucketName = app.node.tryGetContext('bucketName') || process.env.BUCKET_NAME || 'arjan-subedi-portfolio';
const githubUsername = app.node.tryGetContext('githubUsername') || process.env.GITHUB_USERNAME || 'itisaarjan';
const githubRepoName = app.node.tryGetContext('githubRepoName') || process.env.GITHUB_REPO_NAME || 'FullTimePortfolio';
const domainName = app.node.tryGetContext('domainName') || process.env.DOMAIN_NAME;
const enableCloudFront = app.node.tryGetContext('enableCloudFront') || process.env.ENABLE_CLOUDFRONT === 'true';

new PortfolioInfrastructureStack(app, 'PortfolioInfrastructureStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1' 
  },
  bucketName,
  githubUsername,
  githubRepoName,
  domainName,
  enableCloudFront,
  description: 'Portfolio infrastructure with S3, CloudFront, and GitHub Actions OIDC',
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'Portfolio');
cdk.Tags.of(app).add('Environment', 'Production');
cdk.Tags.of(app).add('Owner', 'Arjan Subedi');
