import * as cdk from 'aws-cdk-lib';
import { CdkConfig } from '../lib/utils/config';
import { FoundationalResourcesStack } from '../lib/stacks/foundational-resources-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { APIGatewayStack } from '../lib/stacks/api-gateway-stack';
import { OverviewStack } from '../lib/stacks/overview-stack';

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

const foundationalStack = new FoundationalResourcesStack(app, 'SampleFoundationalResourcesStack', {
  envProps: envProps,
});

const storageStack = new StorageStack(app, 'SampleStorageStack', {
  envProps: envProps,
});

// const lambdaComputeStack = new ComputeStack(app, 'SampleLambdaComputeStack', {
//   envProps: envProps,
//   dockerRepository: foundationalStack.dockerRepository,
//   imageTag: imageTag || 'latest', // Ensure this fallback is acceptable or handle error
//   outputBucket: storageStack.outputBucket,
//   transformationCounterTable: storageStack.transformationCounterTable,
//   userProgressTable: storageStack.userProgressTable,
//   learningEntriesTable: storageStack.learningEntriesTable,
//   httpApi: storageStack.httpApi,
// });

// const apiGatewayStack = new APIGatewayStack(app, 'SampleApiGatewayStack', {
//   apiTransformationLambda: lambdaComputeStack.apiTransformationLambda,
//   userProgressLambda: lambdaComputeStack.userProgressLambda,
//   learningEntriesLambda: lambdaComputeStack.learningEntriesLambda,
// });

// const overviewStack = new OverviewStack(app, 'SampleOverviewStack', {
//   apiTransformationLambda: lambdaComputeStack.apiTransformationLambda,
// });
