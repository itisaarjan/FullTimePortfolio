#!/bin/bash

# CDK Deployment Script for Portfolio Infrastructure
# This script deploys the AWS infrastructure using CDK

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install it first."
        exit 1
    fi
    
    # Check if CDK is installed
    if ! command -v cdk &> /dev/null; then
        print_warning "CDK CLI is not installed. Installing it now..."
        npm install -g aws-cdk
    fi
    
    print_success "All prerequisites are met"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
}

# Function to build the project
build_project() {
    print_status "Building the project..."
    npm run build
    print_success "Project built successfully"
}

# Function to bootstrap CDK (if needed)
bootstrap_cdk() {
    print_status "Checking if CDK is bootstrapped..."
    
    # Get AWS account ID and region
    ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
    REGION=$(aws configure get region || echo 'us-east-1')
    
    # Check if CDK is already bootstrapped
    if ! aws cloudformation describe-stacks --stack-name "CDKToolkit" --region "$REGION" &> /dev/null; then
        print_warning "CDK is not bootstrapped. Bootstrapping now..."
        cdk bootstrap aws://$ACCOUNT_ID/$REGION
        print_success "CDK bootstrapped successfully"
    else
        print_success "CDK is already bootstrapped"
    fi
}

# Function to deploy the infrastructure
deploy_infrastructure() {
    print_status "Deploying infrastructure..."
    
    # Get configuration from environment variables or use defaults
    BUCKET_NAME=${BUCKET_NAME:-"arjan-subedi-portfolio"}
    GITHUB_USERNAME=${GITHUB_USERNAME:-"itisaarjan"}
    GITHUB_REPO_NAME=${GITHUB_REPO_NAME:-"FullTimePortfolio"}
    DOMAIN_NAME=${DOMAIN_NAME:-""}
    ENABLE_CLOUDFRONT=${ENABLE_CLOUDFRONT:-"false"}
    
    print_status "Configuration:"
    echo "  Bucket Name: $BUCKET_NAME"
    echo "  GitHub Username: $GITHUB_USERNAME"
    echo "  GitHub Repo: $GITHUB_REPO_NAME"
    echo "  Domain Name: $DOMAIN_NAME"
    echo "  Enable CloudFront: $ENABLE_CLOUDFRONT"
    echo
    
    # Deploy the stack
    cdk deploy --require-approval never
    
    print_success "Infrastructure deployed successfully"
}

# Function to display outputs
display_outputs() {
    print_status "Retrieving deployment outputs..."
    
    # Get stack outputs
    OUTPUTS=$(aws cloudformation describe-stacks \
        --stack-name PortfolioInfrastructureStack \
        --query 'Stacks[0].Outputs' \
        --output json)
    
    echo
    print_success "🎉 Deployment completed successfully!"
    echo
    echo "📋 Infrastructure Outputs:"
    echo "$OUTPUTS" | jq -r '.[] | "  \(.OutputKey): \(.OutputValue)"'
    echo
    
    # Extract specific values for easy access
    BUCKET_NAME=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="BucketName") | .OutputValue')
    BUCKET_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="BucketWebsiteUrl") | .OutputValue')
    ROLE_ARN=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="DeploymentRoleArn") | .OutputValue')
    DISTRIBUTION_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="DistributionId") | .OutputValue // "N/A"')
    
    echo "🔧 Next Steps:"
    echo "1. Add the following secrets to your GitHub repository:"
    echo "   - AWS_ROLE_ARN: $ROLE_ARN"
    if [ "$DISTRIBUTION_ID" != "N/A" ]; then
        echo "   - CLOUDFRONT_DISTRIBUTION_ID: $DISTRIBUTION_ID"
    fi
    echo
    echo "2. Update your GitHub Actions workflow with:"
    echo "   - S3_BUCKET: $BUCKET_NAME"
    echo
    echo "3. Your portfolio will be available at:"
    echo "   - S3 Website: $BUCKET_URL"
    if [ "$DISTRIBUTION_ID" != "N/A" ]; then
        DISTRIBUTION_DOMAIN=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="DistributionDomainName") | .OutputValue')
        echo "   - CloudFront: https://$DISTRIBUTION_DOMAIN"
    fi
    echo
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -b, --bucket-name       S3 bucket name (default: arjan-subedi-portfolio)"
    echo "  -u, --github-username   GitHub username (default: itisaarjan)"
    echo "  -r, --github-repo       GitHub repository name (default: FullTimePortfolio)"
    echo "  -d, --domain-name       Custom domain name (optional)"
    echo "  -c, --enable-cloudfront Enable CloudFront distribution (default: false)"
    echo "  --destroy               Destroy the infrastructure instead of deploying"
    echo
    echo "Environment Variables:"
    echo "  BUCKET_NAME             S3 bucket name"
    echo "  GITHUB_USERNAME         GitHub username"
    echo "  GITHUB_REPO_NAME        GitHub repository name"
    echo "  DOMAIN_NAME             Custom domain name"
    echo "  ENABLE_CLOUDFRONT       Enable CloudFront (true/false)"
    echo
    echo "Examples:"
    echo "  $0"
    echo "  $0 --bucket-name my-portfolio --github-username myuser --github-repo myrepo"
    echo "  $0 --domain-name mydomain.com --enable-cloudfront"
    echo "  $0 --destroy"
}

# Parse command line arguments
DESTROY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -b|--bucket-name)
            BUCKET_NAME="$2"
            shift 2
            ;;
        -u|--github-username)
            GITHUB_USERNAME="$2"
            shift 2
            ;;
        -r|--github-repo)
            GITHUB_REPO_NAME="$2"
            shift 2
            ;;
        -d|--domain-name)
            DOMAIN_NAME="$2"
            shift 2
            ;;
        -c|--enable-cloudfront)
            ENABLE_CLOUDFRONT="true"
            shift
            ;;
        --destroy)
            DESTROY=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo "🚀 CDK Infrastructure Deployment for Portfolio"
    echo "============================================="
    echo
    
    # Check prerequisites
    check_prerequisites
    
    # Install dependencies
    install_dependencies
    
    # Build project
    build_project
    
    # Bootstrap CDK if needed
    bootstrap_cdk
    
    if [ "$DESTROY" = true ]; then
        print_status "Destroying infrastructure..."
        cdk destroy --force
        print_success "Infrastructure destroyed successfully"
    else
        # Deploy infrastructure
        deploy_infrastructure
        
        # Display outputs
        display_outputs
    fi
}

# Run main function
main "$@"
