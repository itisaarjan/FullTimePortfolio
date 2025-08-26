#!/bin/bash

# AWS Infrastructure Setup Script for Portfolio Deployment
# This script sets up S3 bucket, IAM role, and OIDC provider for GitHub Actions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUCKET_NAME=""
AWS_REGION="us-east-1"
GITHUB_USERNAME=""
GITHUB_REPO_NAME=""
AWS_ACCOUNT_ID=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get user input
get_input() {
    local prompt="$1"
    local default="$2"
    local input
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        echo "${input:-$default}"
    else
        read -p "$prompt: " input
        echo "$input"
    fi
}

# Function to check if AWS CLI is configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
    print_success "AWS CLI is configured. Account ID: $AWS_ACCOUNT_ID"
}

# Function to create S3 bucket
create_s3_bucket() {
    print_status "Creating S3 bucket: $BUCKET_NAME"
    
    # Create bucket
    aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION"
    
    # Enable static website hosting
    aws s3 website "s3://$BUCKET_NAME" \
        --index-document index.html \
        --error-document index.html
    
    # Create bucket policy
    cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF
    
    # Apply bucket policy
    aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy file://bucket-policy.json
    
    print_success "S3 bucket created and configured for static website hosting"
    print_status "Website URL: http://$BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"
}

# Function to create OIDC provider
create_oidc_provider() {
    print_status "Creating OIDC provider for GitHub Actions"
    
    # Check if OIDC provider already exists
    if aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')]" --output text | grep -q "token.actions.githubusercontent.com"; then
        print_warning "OIDC provider already exists"
    else
        # Create OIDC provider
        aws iam create-open-id-connect-provider \
            --url https://token.actions.githubusercontent.com \
            --client-id-list sts.amazonaws.com \
            --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
        print_success "OIDC provider created"
    fi
}

# Function to create IAM role
create_iam_role() {
    print_status "Creating IAM role for GitHub Actions"
    
    # Create trust policy
    cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::$AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:$GITHUB_USERNAME/$GITHUB_REPO_NAME:*"
        }
      }
    }
  ]
}
EOF
    
    # Create IAM policy
    cat > iam-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Deployment",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::$BUCKET_NAME",
        "arn:aws:s3:::$BUCKET_NAME/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "arn:aws:cloudfront::$AWS_ACCOUNT_ID:distribution/*"
    }
  ]
}
EOF
    
    # Create role
    aws iam create-role \
        --role-name "GitHubActionsPortfolioDeploy" \
        --assume-role-policy-document file://trust-policy.json
    
    # Create and attach policy
    aws iam create-policy \
        --policy-name "PortfolioDeployPolicy" \
        --policy-document file://iam-policy.json
    
    aws iam attach-role-policy \
        --role-name "GitHubActionsPortfolioDeploy" \
        --policy-arn "arn:aws:iam::$AWS_ACCOUNT_ID:policy/PortfolioDeployPolicy"
    
    # Get role ARN
    ROLE_ARN=$(aws iam get-role --role-name "GitHubActionsPortfolioDeploy" --query 'Role.Arn' --output text)
    
    print_success "IAM role created: $ROLE_ARN"
}

# Function to update workflow file
update_workflow() {
    print_status "Updating GitHub Actions workflow file"
    
    # Create workflow directory if it doesn't exist
    mkdir -p ../../.github/workflows
    
    # Update the workflow file with correct values
    cat > ../../.github/workflows/deploy.yml << EOF
name: Deploy to S3

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  AWS_REGION: $AWS_REGION
  S3_BUCKET: $BUCKET_NAME

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Build project
      run: npm run build

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
        aws-region: \${{ env.AWS_REGION }}

    - name: Deploy to S3
      run: |
        aws s3 sync dist/ s3://\${{ env.S3_BUCKET }} --delete

    - name: Invalidate CloudFront cache (optional)
      if: \${{ env.CLOUDFRONT_DISTRIBUTION_ID != '' }}
      run: |
        aws cloudfront create-invalidation \\
          --distribution-id \${{ env.CLOUDFRONT_DISTRIBUTION_ID }} \\
          --paths "/*"
      env:
        CLOUDFRONT_DISTRIBUTION_ID: \${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}

    - name: Deploy status
      run: |
        echo "✅ Deployment completed successfully!"
        echo "🌐 Your portfolio is now live at: https://\${{ env.S3_BUCKET }}.s3-website-\${{ env.AWS_REGION }}.amazonaws.com"
        echo "📦 S3 Bucket: \${{ env.S3_BUCKET }}"
        echo "🌍 Region: \${{ env.AWS_REGION }}"
EOF
    
    print_success "Workflow file updated"
}

# Function to display next steps
display_next_steps() {
    print_success "🎉 AWS infrastructure setup completed!"
    echo
    echo "📋 Next steps:"
    echo "1. Add the following secrets to your GitHub repository:"
    echo "   - AWS_ROLE_ARN: $ROLE_ARN"
    echo "   - CLOUDFRONT_DISTRIBUTION_ID: (optional, if using CloudFront)"
    echo
    echo "2. Push the updated workflow file to your repository:"
    echo "   git add .github/workflows/deploy.yml"
    echo "   git commit -m 'Add S3 deployment workflow'"
    echo "   git push origin main"
    echo
    echo "3. Your portfolio will be automatically deployed to:"
    echo "   http://$BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"
    echo
    echo "🔧 Optional: Set up CloudFront for HTTPS and better performance"
}

# Main execution
main() {
    echo "🚀 AWS Infrastructure Setup for Portfolio Deployment"
    echo "=================================================="
    echo
    
    # Check AWS CLI
    check_aws_cli
    
    # Get user input
    BUCKET_NAME=$(get_input "Enter S3 bucket name" "arjan-subedi-portfolio")
    AWS_REGION=$(get_input "Enter AWS region" "$AWS_REGION")
    GITHUB_USERNAME=$(get_input "Enter your GitHub username" "")
    GITHUB_REPO_NAME=$(get_input "Enter your GitHub repository name" "FullTimePortfolio")
    
    # Validate inputs
    if [ -z "$BUCKET_NAME" ] || [ -z "$GITHUB_USERNAME" ] || [ -z "$GITHUB_REPO_NAME" ]; then
        print_error "All fields are required"
        exit 1
    fi
    
    echo
    print_status "Configuration:"
    echo "  S3 Bucket: $BUCKET_NAME"
    echo "  AWS Region: $AWS_REGION"
    echo "  GitHub Repo: $GITHUB_USERNAME/$GITHUB_REPO_NAME"
    echo "  AWS Account: $AWS_ACCOUNT_ID"
    echo
    
    # Confirm before proceeding
    read -p "Proceed with setup? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_warning "Setup cancelled"
        exit 0
    fi
    
    # Execute setup steps
    create_s3_bucket
    create_oidc_provider
    create_iam_role
    update_workflow
    display_next_steps
    
    # Cleanup temporary files
    rm -f bucket-policy.json trust-policy.json iam-policy.json
}

# Run main function
main "$@"
