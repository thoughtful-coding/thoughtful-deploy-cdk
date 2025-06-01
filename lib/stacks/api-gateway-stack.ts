import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { ApiRoute } from '../constructs/api-route';
import { GOOGLE_CLIENT_ID } from '../utils/config';

export interface APIGatewayStackProps extends StackProps {
  readonly apiTransformationLambda: lambda.IFunction;
  readonly userProgressLambda: lambda.IFunction;
  readonly learningEntriesLambda: lambda.IFunction;
  readonly primmFeedbackLambda: lambda.IFunction;
  readonly instructorPortalLambda: lambda.IFunction;
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
        maxAge: Duration.days(10),
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

    const googleJwtAuthorizer = new HttpJwtAuthorizer('GoogleJwtAuthorizer', 'https://accounts.google.com', {
      jwtAudience: [GOOGLE_CLIENT_ID],
    });

    new ApiRoute(this, 'UserProgressRoute', {
      httpApi: this.httpApi,
      routePath: '/progress',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.PUT],
      handler: props.userProgressLambda,
      authorizer: googleJwtAuthorizer,
    });

    new ApiRoute(this, 'LearningEntryRoute', {
      httpApi: this.httpApi,
      routePath: '/learning-entries',
      methods: [apigwv2.HttpMethod.GET],
      handler: props.learningEntriesLambda,
      authorizer: googleJwtAuthorizer,
    });

    new ApiRoute(this, 'ReflectionsFeedbackRoute', {
      httpApi: this.httpApi,
      routePath: '/reflections/{lessonId}/sections/{sectionId}',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      handler: props.learningEntriesLambda,
      authorizer: googleJwtAuthorizer,
    });

    new ApiRoute(this, 'PRIMMFeedbackRoute', {
      httpApi: this.httpApi,
      routePath: '/primm-feedback',
      methods: [apigwv2.HttpMethod.POST],
      handler: props.primmFeedbackLambda,
      authorizer: googleJwtAuthorizer,
    });

    new ApiRoute(this, 'InstructorStudentsRoute', {
      httpApi: this.httpApi,
      routePath: '/instructor/students',
      methods: [apigwv2.HttpMethod.GET],
      handler: props.instructorPortalLambda,
      authorizer: googleJwtAuthorizer,
    });

    new ApiRoute(this, 'InstructorStudentUnitProgressRoute', {
      httpApi: this.httpApi,
      routePath: '/instructor/students/{studentId}/units/{unitId}/progress',
      methods: [apigwv2.HttpMethod.GET],
      handler: props.instructorPortalLambda,
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
