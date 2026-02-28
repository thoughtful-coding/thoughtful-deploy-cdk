# Thoughtful Coding CDK Infrastructure

AWS CDK infrastructure for [Thoughtful Coding](https://thoughtful-coding.github.io/) — an interactive browser-based Python learning environment with AI-powered feedback.

**Live site:** https://thoughtful-coding.github.io/ | **Project:** https://github.com/thoughtful-coding

## Quick Start

```bash
npm install                              # Install dependencies
npm run build                            # Compile TypeScript
cdk diff --all                           # Preview changes
cdk deploy --all                         # Deploy all stacks
cdk deploy --all --context imageTag=abc  # Deploy with specific Docker image
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Thoughtful Coding                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Frontend (GitHub Pages)          Backend (This Repo)                   │
│  ┌───────────────────┐            ┌────────────────────────────────┐    │
│  │ React/Vite        │  ────────► │ API Gateway (HTTP API)         │    │
│  │ Pyodide           │            │   ├─ /auth/*    (public)       │    │
│  │ Google OAuth      │            │   ├─ /progress  (protected)    │    │
│  └───────────────────┘            │   ├─ /primm-feedback           │    │
│                                   │   ├─ /reflections              │    │
│                                   │   └─ /instructor/*             │    │
│                                   ├────────────────────────────────┤    │
│                                   │ Lambda Functions (Docker)      │    │
│                                   │   ├─ AuthLambda                │    │
│                                   │   ├─ AuthorizerLambda          │    │
│                                   │   ├─ UserProgressLambda        │    │
│                                   │   ├─ LearningEntriesLambda     │    │
│                                   │   ├─ PrimmFeedbackLambda       │    │
│                                   │   └─ InstructorPortalLambda    │    │
│                                   ├────────────────────────────────┤    │
│                                   │ DynamoDB Tables                │    │
│                                   │   ├─ UserProgress              │    │
│                                   │   ├─ LearningEntries           │    │
│                                   │   ├─ PrimmSubmissions          │    │
│                                   │   ├─ RefreshTokens             │    │
│                                   │   ├─ UserPermissions           │    │
│                                   │   └─ ThrottlingStore           │    │
│                                   └────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Stack Structure

| Stack | Purpose | Key Resources |
|-------|---------|---------------|
| **FoundationalResourcesStack** | Core infrastructure | ECR repository, JWT secret, Chatbot API key |
| **StorageStack** | Data persistence | 6 DynamoDB tables (pay-per-request) |
| **ComputeStack** | Business logic | 6 Docker-based Lambda functions |
| **APIGatewayStack** | HTTP routing | HTTP API, Lambda authorizer, routes |
| **OverviewStack** | Monitoring | CloudWatch dashboard |

## Deployment Pipeline

### Overview

Backend deployment follows a **beta-first** strategy: every change goes to beta automatically, and production requires manual approval.

```
Backend repo                          CDK repo (this repo)
────────────                          ────────────────────

push to main
    │
    ├─ lint + test
    │
    ▼
build Docker image
    │
    ├─ push to ECR (us-east-1, tag: beta + sha)
    ├─ push to ECR (us-west-1, tag: prod + sha)
    │
    ▼
trigger CDK repo ──────────────────►  deploy to BETA (us-east-1)
  (repository_dispatch:                   │
   beta-deployed)                         ▼
                                      E2E tests run against beta
                                          │
                                          ▼
                                      ┌─────────────────────┐
                                      │  Manual approval     │
                                      │  (GitHub Environment │
                                      │   protection rule)   │
                                      └─────────────────────┘
                                          │
                                          ▼
                                      deploy to PROD (us-west-1)
```

The frontend deploys independently — push to main on `thoughtful-coding.github.io` builds, runs E2E tests, and deploys to GitHub Pages. No beta/prod split since it can be fully tested locally.

### Environments

| | Beta | Production |
|---|---|---|
| **Region** | us-east-1 | us-west-1 |
| **Test auth** | Enabled (for Playwright E2E) | Disabled |
| **Deploys** | Automatically on push to main | After manual approval |
| **Image tag** | `beta` + commit SHA | `prod` + commit SHA |

### What Happens on Push to Main (Backend Repo)

1. **Backend CI** (`thoughtful-backend/.github/workflows/deploy.yml`):
   - Runs lint (Black) and tests (pytest) in parallel
   - Builds Docker image
   - Pushes to ECR in **both** regions (tagged with commit SHA + `beta`/`prod`)
   - Sends `repository_dispatch` event to this CDK repo

2. **CDK deploys beta** (`thoughtful-deploy-cdk/.github/workflows/deploy.yml`):
   - Receives `beta-deployed` event with `imageTag`
   - Runs CDK lint + test
   - Runs `cdk deploy --all --context stage=beta --context imageTag={sha}`
   - Lambda functions in us-east-1 update to the new image

3. **E2E tests** (optional gate):
   - Frontend Playwright tests run against the beta API
   - Beta has test auth enabled, so tests can authenticate without Google OAuth

4. **Manual approval**:
   - Pipeline pauses at the `production` GitHub Environment
   - You review and click "Approve" in the GitHub Actions UI

5. **CDK deploys prod**:
   - Runs `cdk deploy --all --context stage=prod --context imageTag={sha}`
   - Lambda functions in us-west-1 update to the same image that was validated in beta

### Manual Deployment

Both stages can be deployed manually via the GitHub Actions UI: **Actions → Deploy CDK Infrastructure → Run workflow**, then select stage (beta/prod) and optionally provide an image tag.

### Local Deployment

```bash
# Deploy to beta
cdk deploy --all --context stage=beta --context imageTag=abc123

# Deploy to prod
cdk deploy --all --context stage=prod --context imageTag=abc123

# Deploy with default tags (uses 'prod' or 'beta' tag from ECR)
cdk deploy --all --context stage=beta
```

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 18+
3. CDK bootstrapped in both regions:
   - `cdk bootstrap aws://598791268315/us-west-1` (prod)
   - `cdk bootstrap aws://598791268315/us-east-1` (beta)
4. Docker image in ECR (built by backend repo CI/CD)
5. GitHub Environment `production` configured with required reviewers (for approval gate)

### Post-Deployment Setup

Set the chatbot API key in the SecretsTable (must be done per environment):

```bash
# Beta (us-east-1)
aws dynamodb put-item --region us-east-1 --table-name SecretsTable \
  --item '{"secretKey": {"S": "CHATBOT_API_KEY"}, "secretValue": {"S": "your-api-key"}}'

# Prod (us-west-1)
aws dynamodb put-item --region us-west-1 --table-name SecretsTable \
  --item '{"secretKey": {"S": "CHATBOT_API_KEY"}, "secretValue": {"S": "your-api-key"}}'
```

## API Routes

| Route | Method | Auth | Lambda |
|-------|--------|------|--------|
| `/auth/login` | POST | Public | AuthLambda |
| `/auth/refresh` | POST | Public | AuthLambda |
| `/auth/logout` | POST | Public | AuthLambda |
| `/progress` | GET, PUT | JWT | UserProgressLambda |
| `/learning-entries` | GET | JWT | LearningEntriesLambda |
| `/reflections/{lessonId}/sections/{sectionId}` | GET, POST | JWT | LearningEntriesLambda |
| `/primm-feedback` | POST | JWT | PrimmFeedbackLambda |
| `/instructor/*` | GET | JWT | InstructorPortalLambda |

## Development

### Commands

```bash
npm run build     # Compile TypeScript
npm run watch     # Watch mode
npm test          # Run Jest tests
cdk synth         # Generate CloudFormation
cdk diff --all    # Preview changes
```

### Adding a Lambda

1. Create construct in `ComputeStack` using `BasicDockerLambda`
2. Grant DynamoDB/secret permissions
3. Add route in `APIGatewayStack` using `ApiRoute`
4. Implement handler in backend repo

### Adding a DynamoDB Table

1. Create table in `StorageStack` using `StandardTable`
2. Pass to `ComputeStack` and grant permissions
3. Add table class in backend repo

## Related Repositories

| Repository | Description |
|------------|-------------|
| [thoughtful-coding.github.io](https://github.com/thoughtful-coding/thoughtful-coding.github.io) | React frontend (deployed to GitHub Pages) |
| [thoughtful-backend](https://github.com/thoughtful-coding/thoughtful-backend) | Python Lambda handlers |
| [thoughtful-coding](https://github.com/thoughtful-coding) | Organization / project home |

## Key Files

```
bin/sample.ts                          # CDK app entry point
lib/stacks/
  ├── foundational-resources-stack.ts  # ECR, secrets
  ├── storage-stack.ts                 # DynamoDB tables
  ├── compute-stack.ts                 # Lambda functions
  ├── api-gateway-stack.ts             # HTTP API, routes
  └── overview-stack.ts                # CloudWatch dashboard
lib/constructs/
  ├── lambda.ts                        # BasicDockerLambda
  ├── dynamodb-table.ts                # StandardTable
  ├── secret-manager.ts                # ManagedSecret
  └── api-route.ts                     # ApiRoute
lib/utils/config.ts                    # Environment config
```

## Configuration

| Variable | Source | Purpose |
|----------|--------|---------|
| `imageTag` | CDK context | Docker image tag for Lambdas |
| `CDK_DEFAULT_ACCOUNT` | Environment | AWS account ID |
| `CDK_DEFAULT_REGION` | Environment | AWS region (default: us-west-1) |
| `GOOGLE_CLIENT_ID` | Config constant | Google OAuth client ID |

## Security

- JWT authentication (6h access, 60d refresh tokens)
- Secrets in AWS Secrets Manager
- DynamoDB encryption at rest
- CORS restricted to specific origins
- Lambda authorizer for protected routes
- ECR image scanning enabled
