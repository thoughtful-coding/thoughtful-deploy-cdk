import * as cdk from 'aws-cdk-lib';
import { CdkConfig } from '../lib/utils/config';
import { FoundationalResourcesStack } from '../lib/stacks/foundational-resources-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { OverviewStack } from '../lib/stacks/overview-stack';
import { APIGatewayStack } from '../lib/stacks/api-gateway-stack';

const app = new cdk.App();
const envProps = CdkConfig.getEnvironment();

const imageTag = app.node.tryGetContext('imageTag') as string | undefined;
if (!imageTag && process.env.CI) {
  throw new Error("Context variable 'imageTag' must be passed to the CDK process in CI.");
} else if (!imageTag) {
  console.warn(
    "Warning: Context variable 'imageTag' was not provided. Using 'latest' as fallback for Lambda image tag."
  );
}

const foundationalStack = new FoundationalResourcesStack(app, 'ThtflCodeFoundationalResourcesStack', {
  envProps: envProps,
});

const storageStack = new StorageStack(app, 'ThtflCodeStorageStack', {
  envProps: envProps,
});

const lambdaComputeStack = new ComputeStack(app, 'ThtflCodeLambdaComputeStack', {
  envProps: envProps,
  dockerRepository: foundationalStack.dockerRepository,
  imageTag: imageTag || 'latest', // Ensure this fallback is acceptable or handle error
  userProgressTable: storageStack.userProgressTable,
  learningEntriesTable: storageStack.learningEntriesTable,
  primmSubmissionsTable: storageStack.primmSubmissionsTable,
  throttleTable: storageStack.throttleTable,
  refreshTokenTable: storageStack.refreshTokenTable,
  userPermissionsTable: storageStack.userPermissionsTable,
  firstSolutionsTable: storageStack.firstSolutionsTable,
  userProfileTable: storageStack.userProfileTable,
  chatbotApiKeySecret: foundationalStack.chatbotApiKeySecret,
  jwtSecret: foundationalStack.jwtSecret,
  secretsTable: storageStack.secretsTable,
});

const apiRoutesStack = new APIGatewayStack(app, 'ThtflCodeApiRoutesStack', {
  userProgressLambda: lambdaComputeStack.userProgressLambda,
  learningEntriesLambda: lambdaComputeStack.learningEntriesLambda,
  primmFeedbackLambda: lambdaComputeStack.primmFeedbackLambda,
  instructorPortalLambda: lambdaComputeStack.instructorPortalLambda,
  authLambda: lambdaComputeStack.authLambda,
  authorizerLambda: lambdaComputeStack.authorizerLambda,
  env: { account: envProps.account, region: envProps.region },
});

const overviewStack = new OverviewStack(app, 'ThtflCodeOverviewStack', {
  authLambda: lambdaComputeStack.authLambda,
  authorizerLambda: lambdaComputeStack.authorizerLambda,
  learningEntriesLambda: lambdaComputeStack.learningEntriesLambda,
  primmFeedbackLambda: lambdaComputeStack.primmFeedbackLambda,
});

// Explicit stack dependencies to ensure correct deployment order
// CDK doesn't automatically infer these when using IFunction interfaces
apiRoutesStack.addDependency(lambdaComputeStack);
overviewStack.addDependency(lambdaComputeStack);
