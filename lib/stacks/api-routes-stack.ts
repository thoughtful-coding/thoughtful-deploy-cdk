import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { ApiRoute } from '../constructs/api-route';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { GOOGLE_CLIENT_ID } from '../utils/config';

export interface ApiRoutesStackProps extends StackProps {
  readonly httpApi: apigwv2.HttpApi;
  readonly apiTransformationLambda: lambda.IFunction;
  readonly userProgressLambda: lambda.IFunction;
  readonly learningEntriesLambda: lambda.IFunction;
}

export class ApiRoutesStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiRoutesStackProps) {
    super(scope, id, props);

    // Define Routes using the custom ApiRoute construct

    new ApiRoute(this, 'TransformCsvRoute', {
      httpApi: props.httpApi,
      routePath: '/transform_csv',
      methods: [apigwv2.HttpMethod.POST],
      handler: props.apiTransformationLambda,
    });

    const googleJwtAuthorizer = new HttpJwtAuthorizer('GoogleJwtAuthorizer', 'https://accounts.google.com', {
      jwtAudience: [GOOGLE_CLIENT_ID],
    });

    new ApiRoute(this, 'UserProgressRoute', {
      //
      httpApi: props.httpApi,
      routePath: '/progress', //
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.PUT], //
      handler: props.userProgressLambda,
      authorizer: googleJwtAuthorizer, //
    });

    new ApiRoute(this, 'LearningEntryRoute', {
      //
      httpApi: props.httpApi,
      routePath: '/learning-entries', //
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.PUT], //
      handler: props.learningEntriesLambda,
      authorizer: googleJwtAuthorizer, //
    });

    // CloudFormation Output for the API endpoint from this stack
    new CfnOutput(this, 'ApiEndpointOutput', {
      //
      value: props.httpApi.url!, // httpApi is passed from StorageStack
      description: 'Endpoint URL for the Sample App API', //
      exportName: 'SampleAppApiEndpoint', // Or use the original 'StorageStackHttpApiEndpoint' if preferred
    });
  }
}
