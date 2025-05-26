import { Stack, StackProps, CfnOutput, Fn } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { GOOGLE_CLIENT_ID } from '../utils/config';

export interface ApiRoutesStackProps extends StackProps {
  readonly httpApiId: string;
  readonly region: string;
  readonly apiTransformationLambda: lambda.IFunction;
  readonly userProgressLambda: lambda.IFunction;
  readonly learningEntriesLambda: lambda.IFunction;
}

export class ApiRoutesStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiRoutesStackProps) {
    super(scope, id, props);

    // Helper function to create integration and route using L1 constructs
    const addL1Route = (
      lambdaFunction: lambda.IFunction,
      routePath: string,
      methods: string[], // e.g., ['POST'], ['GET', 'POST', 'PUT']
      authorizerRef?: string, // Pass the CfnAuthorizer.ref if using one
      authorizerType?: string // e.g., 'JWT'
    ) => {
      const functionName = lambdaFunction.functionName;
      // Sanitize path for logical ID generation (basic sanitization)
      const sanitizedPathForId = routePath.replace(/[^a-zA-Z0-9-]/g, '');

      // Create Lambda Integration
      const integration = new apigwv2.CfnIntegration(this, `${functionName}Integration${sanitizedPathForId}`, {
        apiId: props.httpApiId,
        integrationType: 'AWS_PROXY',
        integrationUri: lambdaFunction.functionArn,
        payloadFormatVersion: '2.0',
      });

      methods.forEach((method) => {
        const routeKey = `${method} ${routePath}`;
        const routeLogicalIdSuffix = `${method}${sanitizedPathForId}`;

        new apigwv2.CfnRoute(this, `${functionName}Route${routeLogicalIdSuffix}`, {
          apiId: props.httpApiId,
          routeKey: routeKey,
          target: `integrations/${integration.ref}`, // Use .ref to get the Integration ID
          authorizerId: authorizerRef,
          authorizationType: authorizerRef ? authorizerType : 'NONE',
        });
      });

      // Grant API Gateway permission to invoke the Lambda
      // Construct a unique logical ID for the permission
      const permissionLogicalId = `${functionName}ApiGwInvokePermission${sanitizedPathForId}`;
      new lambda.CfnPermission(this, permissionLogicalId, {
        action: 'lambda:InvokeFunction',
        functionName: lambdaFunction.functionArn,
        principal: 'apigateway.amazonaws.com',
        sourceArn: Fn.join(':', [
          // Using Fn.join
          'arn',
          Stack.of(this).partition,
          'execute-api',
          props.region,
          Stack.of(this).account,
          `${props.httpApiId}/*/*${routePath}`, // This is a common pattern for SourceArn
        ]),
      });
    };

    // --- Define Routes using L1 constructs ---

    // TransformCsvRoute
    addL1Route(props.apiTransformationLambda, '/transform_csv', ['POST']);

    // Google JWT Authorizer - L1 CfnAuthorizer
    const googleJwtAuthorizerL1 = new apigwv2.CfnAuthorizer(this, 'GoogleJwtAuthorizerL1', {
      apiId: props.httpApiId,
      name: 'GoogleJwtAuthorizer', // Physical name for the authorizer
      authorizerType: 'JWT',
      identitySource: ['$request.header.Authorization'], // Common identity source for JWT
      jwtConfiguration: {
        audience: [GOOGLE_CLIENT_ID],
        issuer: 'https://accounts.google.com',
      },
    });

    // UserProgressRoute - using the L1 authorizer's .ref (which is its ID)
    addL1Route(props.userProgressLambda, '/progress', ['GET', 'POST', 'PUT'], googleJwtAuthorizerL1.ref, 'JWT');

    // LearningEntryRoute - using the L1 authorizer's .ref
    addL1Route(
      props.learningEntriesLambda,
      '/learning-entries',
      ['GET', 'POST', 'PUT'],
      googleJwtAuthorizerL1.ref,
      'JWT'
    );
  }
}
