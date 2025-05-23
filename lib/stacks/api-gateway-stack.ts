import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import { EnvironmentProps, GOOGLE_CLIENT_ID } from '../utils/config'; // Assuming path
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

// Props for our custom ApiRoute construct
interface ApiRouteProps {
  readonly httpApi: apigwv2.HttpApi;
  readonly routePath: string;
  readonly methods: apigwv2.HttpMethod[];
  readonly handler: lambda.IFunction;
  readonly authorizer?: apigwv2.IHttpRouteAuthorizer;
}

// Custom construct to define an API route with Lambda integration
class ApiRoute extends Construct {
  constructor(scope: Construct, id: string, props: ApiRouteProps) {
    super(scope, id);

    const lambdaIntegration = new HttpLambdaIntegration(
      `${id}Integration`,
      props.handler
    );

    props.httpApi.addRoutes({
      path: props.routePath,
      methods: props.methods,
      integration: lambdaIntegration,
      authorizer: props.authorizer,
    });
  }
}

// Props for the APIGatewayStack
export interface APIGatewayStackProps extends StackProps {
  readonly envProps: EnvironmentProps; // Though not directly used here, kept for consistency
  readonly apiTransformationLambda: lambda.IFunction;
  readonly userProgressLambda: lambda.IFunction;
  readonly learningEntriesLambda: lambda.IFunction;
}

export class APIGatewayStack extends Stack {
  public readonly apiEndpoint: string;
  private readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: APIGatewayStackProps) {
    super(scope, id, props);

    this.httpApi = new apigwv2.HttpApi(this, 'SampleAppHttpApi', {
      apiName: 'SampleAppAPI',
      description: 'HTTP API for the Sample Application',
      corsPreflight: {
        allowOrigins: ['https://eric-rizzi.github.io', 'http://localhost:5173'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.OPTIONS,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: Duration.days(10), //
      },
    });
    this.apiEndpoint = this.httpApi.url!; // The ! asserts that apiEndpoint is not undefined

    // Define Routes using the custom ApiRoute construct

    new ApiRoute(this, 'TransformCsvRoute', {
      httpApi: this.httpApi,
      routePath: '/transform_csv',
      methods: [apigwv2.HttpMethod.POST],
      handler: props.apiTransformationLambda,
    });

    const googleJwtAuthorizer = new HttpJwtAuthorizer(
      'GoogleJwtAuthorizer',
      'https://accounts.google.com',
      {
        jwtAudience: [GOOGLE_CLIENT_ID],
      }
    );

    new ApiRoute(this, 'UserProgressRoute', {
      httpApi: this.httpApi,
      routePath: '/progress',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      handler: props.userProgressLambda,
      authorizer: googleJwtAuthorizer,
    });

    new ApiRoute(this, 'LearningEntryRoute', {
      httpApi: this.httpApi,
      routePath: '/learning-entries',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      handler: props.learningEntriesLambda,
      authorizer: googleJwtAuthorizer,
    });

    // CloudFormation Output for the API endpoint
    new CfnOutput(this, 'ApiEndpointOutput', {
      value: this.apiEndpoint,
      description: 'Endpoint URL for the Sample App API',
      exportName: 'SampleAppApiEndpoint',
    });
  }
}
