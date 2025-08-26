# AWS Infrastructure Setup for Portfolio Deployment

This guide will help you set up AWS infrastructure to deploy your portfolio using GitHub Actions with OIDC (OpenID Connect).

## 🏗️ Infrastructure Components

1. **S3 Bucket** - Static website hosting
2. **IAM Role** - For GitHub Actions OIDC authentication
3. **CloudFront Distribution** (Optional) - CDN for better performance
4. **Route 53** (Optional) - Custom domain

## 📋 Prerequisites

- AWS CLI installed and configured
- GitHub repository with admin access
- Domain name (optional, for custom domain)

## 🚀 Quick Setup

### 1. Create S3 Bucket

```bash
# Create S3 bucket for static website hosting
aws s3 mb s3://your-portfolio-bucket-name --region us-east-1

# Enable static website hosting
aws s3 website s3://your-portfolio-bucket-name --index-document index.html --error-document index.html

# Configure bucket policy for public read access
aws s3api put-bucket-policy --bucket your-portfolio-bucket-name --policy file://bucket-policy.json
```

### 2. Create IAM Role for GitHub Actions

```bash
# Create trust policy for GitHub Actions OIDC
aws iam create-role \
  --role-name GitHubActionsPortfolioDeploy \
  --assume-role-policy-document file://trust-policy.json

# Attach S3 deployment policy
aws iam attach-role-policy \
  --role-name GitHubActionsPortfolioDeploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Get the role ARN
aws iam get-role --role-name GitHubActionsPortfolioDeploy --query 'Role.Arn' --output text
```

### 3. Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

- `AWS_ROLE_ARN`: The ARN of the IAM role created above
- `CLOUDFRONT_DISTRIBUTION_ID`: (Optional) Your CloudFront distribution ID

### 4. Update Workflow Configuration

Update the environment variables in `.github/workflows/deploy.yml`:

```yaml
env:
  AWS_REGION: us-east-1  # Your preferred region
  S3_BUCKET: your-portfolio-bucket-name  # Your S3 bucket name
```

## 📁 Required Files

### bucket-policy.json
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-portfolio-bucket-name/*"
    }
  ]
}
```

### trust-policy.json
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME:*"
        }
      }
    }
  ]
}
```

## 🔧 Advanced Setup

### CloudFront Distribution (Optional)

For better performance and HTTPS:

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json

# Get distribution ID
aws cloudfront list-distributions --query 'DistributionList.Items[?Aliases.Items[?contains(@, `your-domain.com`)]].[Id]' --output text
```

### Custom Domain with Route 53

1. Create hosted zone in Route 53
2. Update nameservers with your domain registrar
3. Create A record pointing to CloudFront distribution
4. Request SSL certificate in ACM

## 🔒 Security Best Practices

1. **Least Privilege**: Use specific IAM policies instead of full access
2. **OIDC**: Use OIDC instead of long-term AWS credentials
3. **Bucket Policy**: Only allow necessary public access
4. **HTTPS**: Always use HTTPS in production

## 🚨 Troubleshooting

### Common Issues

1. **403 Forbidden**: Check bucket policy and IAM permissions
2. **OIDC Trust Error**: Verify trust policy and GitHub repository name
3. **Build Failures**: Check Node.js version and dependencies

### Debug Commands

```bash
# Test S3 access
aws s3 ls s3://your-portfolio-bucket-name

# Test IAM role assumption
aws sts assume-role-with-web-identity \
  --role-arn arn:aws:iam::YOUR_ACCOUNT:role/GitHubActionsPortfolioDeploy \
  --web-identity-token YOUR_TOKEN

# Check CloudFront distribution
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID
```

## 📚 Additional Resources

- [GitHub Actions OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [CloudFront Distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-overview.html)
