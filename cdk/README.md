# Portfolio Infrastructure with AWS CDK

This directory contains the AWS CDK infrastructure code for deploying your portfolio website with S3, CloudFront, and GitHub Actions OIDC authentication.

## 🏗️ Infrastructure Components

- **S3 Bucket** - Static website hosting with public read access
- **CloudFront Distribution** - CDN for better performance and HTTPS (optional)
- **IAM Role** - For GitHub Actions OIDC authentication
- **OIDC Provider** - GitHub Actions identity provider
- **Route 53** - DNS management (if custom domain is provided)
- **ACM Certificate** - SSL certificate (if custom domain is provided)

## 📋 Prerequisites

- AWS CLI installed and configured
- Node.js (v18 or later)
- npm or yarn
- AWS CDK CLI (`npm install -g aws-cdk`)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd cdk
npm install
```

### 2. Deploy Infrastructure

#### Option A: Using the deployment script (Recommended)

```bash
# Basic deployment
./deploy.sh

# With custom configuration
./deploy.sh --bucket-name my-portfolio --github-username myuser --github-repo myrepo

# With CloudFront and custom domain
./deploy.sh --domain-name mydomain.com --enable-cloudfront
```

#### Option B: Using CDK directly

```bash
# Build the project
npm run build

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy
cdk deploy
```

### 3. Configure GitHub Secrets

After deployment, add these secrets to your GitHub repository:

- `AWS_ROLE_ARN`: The IAM role ARN (from CDK outputs)
- `S3_BUCKET_NAME`: The S3 bucket name (from CDK outputs)
- `CLOUDFRONT_DISTRIBUTION_ID`: CloudFront distribution ID (if using CloudFront)

## ⚙️ Configuration Options

### Environment Variables

You can configure the deployment using environment variables:

```bash
export BUCKET_NAME="my-portfolio"
export GITHUB_USERNAME="myuser"
export GITHUB_REPO_NAME="myrepo"
export DOMAIN_NAME="mydomain.com"
export ENABLE_CLOUDFRONT="true"
```

### Command Line Options

```bash
./deploy.sh --help
```

Available options:
- `-b, --bucket-name`: S3 bucket name
- `-u, --github-username`: GitHub username
- `-r, --github-repo`: GitHub repository name
- `-d, --domain-name`: Custom domain name
- `-c, --enable-cloudfront`: Enable CloudFront distribution
- `--destroy`: Destroy the infrastructure

## 📁 Project Structure

```
cdk/
├── bin/
│   └── portfolio-infrastructure.ts    # CDK app entry point
├── lib/
│   └── portfolio-infrastructure-stack.ts  # Main infrastructure stack
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript configuration
├── cdk.json                          # CDK configuration
├── deploy.sh                         # Deployment script
└── README.md                         # This file
```

## 🔧 Infrastructure Details

### S3 Bucket

- Configured for static website hosting
- Public read access for website files
- CORS enabled for cross-origin requests
- Versioning enabled for file history
- Bucket policy for public access

### IAM Role & OIDC

- OIDC provider for GitHub Actions
- IAM role with least-privilege permissions
- Trust policy for specific repository
- S3 deployment permissions
- CloudFront invalidation permissions (if enabled)

### CloudFront Distribution (Optional)

- Optimized for static content
- HTTPS redirect enabled
- Custom error pages for SPA routing
- Logging enabled
- Price class optimized for cost

### Route 53 & SSL (Optional)

- Automatic DNS record creation
- SSL certificate via ACM
- Domain validation via DNS

## 🔒 Security Features

- **OIDC Authentication**: No long-term AWS credentials
- **Least Privilege**: Minimal required permissions
- **Repository-Specific**: Role only works for your repository
- **HTTPS Enforcement**: When CloudFront is enabled
- **Public Access Control**: Proper S3 bucket policies

## 📊 CDK Outputs

After deployment, CDK provides these outputs:

- `BucketName`: S3 bucket name
- `BucketWebsiteUrl`: S3 website URL
- `DeploymentRoleArn`: IAM role ARN for GitHub Actions
- `DistributionId`: CloudFront distribution ID (if enabled)
- `DistributionDomainName`: CloudFront domain (if enabled)
- `WebsiteUrl`: Custom domain URL (if provided)

## 🧹 Cleanup

To destroy the infrastructure:

```bash
# Using the script
./deploy.sh --destroy

# Using CDK directly
cdk destroy
```

## 🚨 Troubleshooting

### Common Issues

1. **CDK Not Bootstrapped**
   ```bash
   cdk bootstrap aws://ACCOUNT-ID/REGION
   ```

2. **Bucket Name Already Exists**
   - Choose a different bucket name
   - Bucket names must be globally unique

3. **Domain Not Found in Route 53**
   - Ensure the domain is registered in Route 53
   - Or use a different domain

4. **Permission Denied**
   - Check AWS CLI configuration
   - Ensure you have necessary permissions

### Debug Commands

```bash
# Check CDK synth output
cdk synth

# View CloudFormation template
cdk synth --json

# Check deployment status
aws cloudformation describe-stacks --stack-name PortfolioInfrastructureStack

# View stack outputs
aws cloudformation describe-stacks --stack-name PortfolioInfrastructureStack --query 'Stacks[0].Outputs'
```

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [CloudFront Distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-overview.html)

## 🤝 Contributing

To modify the infrastructure:

1. Edit the TypeScript files in `lib/`
2. Test changes with `cdk synth`
3. Deploy with `cdk deploy`
4. Update documentation if needed
