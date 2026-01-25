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

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 18+
3. CDK bootstrapped: `cdk bootstrap aws://{account}/{region}`
4. Docker image in ECR (built by backend repo CI/CD)

### Deploy

```bash
# Full deployment with specific image tag (CI/CD)
cdk deploy --all --context imageTag=abc123def

# Deploy with 'latest' tag (local development)
cdk deploy --all
```

### Post-Deployment Setup

Set the chatbot API key manually (not auto-generated):

```bash
aws secretsmanager put-secret-value \
  --secret-id /thoughtful-python/chatbot-api-key \
  --secret-string "YOUR_GEMINI_API_KEY"
```

## CI/CD

The GitHub Actions workflow triggers automatically when:
- **Backend repo pushes** to main → Triggers this repo with `IMAGE_TAG`
- **Direct pushes** to this repo's main → Uses `prod` tag

Pipeline stages: lint → test → deploy

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
