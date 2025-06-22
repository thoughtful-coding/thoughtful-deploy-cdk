import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { ApiRoute } from '../constructs/api-route';

export interface APIGatewayStackProps extends StackProps {
  readonly apiTransformationLambda: lambda.IFunction;
  readonly userProgressLambda: lambda.IFunction;
  readonly learningEntriesLambda: lambda.IFunction;
  readonly primmFeedbackLambda: lambda.IFunction;
  readonly instructorPortalLambda: lambda.IFunction;
  readonly authLambda: lambda.IFunction;
  readonly authorizerLambda: lambda.IFunction;
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

    const customAuthorizer = new HttpLambdaAuthorizer('CustomLambdaAuthorizer', props.authorizerLambda, {
      responseTypes: [HttpLambdaResponseType.IAM], // Required for this policy format
      identitySource: ['$request.header.Authorization'],
    });

    new ApiRoute(this, 'UserProgressRoute', {
      httpApi: this.httpApi,
      routePath: '/progress',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      handler: props.userProgressLambda,
      authorizer: customAuthorizer,
    });

    new ApiRoute(this, 'LearningEntryRoute', {
      httpApi: this.httpApi,
      routePath: '/learning-entries',
      methods: [apigwv2.HttpMethod.GET],
      handler: props.learningEntriesLambda,
      authorizer: customAuthorizer,
    });

    new ApiRoute(this, 'ReflectionsFeedbackRoute', {
      httpApi: this.httpApi,
      routePath: '/reflections/{lessonId}/sections/{sectionId}',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      handler: props.learningEntriesLambda,
      authorizer: customAuthorizer,
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
      authorizer: customAuthorizer,
    });

    new ApiRoute(this, 'InstructorStudentUnitProgressRoute', {
      httpApi: this.httpApi,
      routePath: '/instructor/students/{studentId}/units/{unitId}/progress',
      methods: [apigwv2.HttpMethod.GET],
      handler: props.instructorPortalLambda,
      authorizer: customAuthorizer,
    });

    new ApiRoute(this, 'InstructorStudentLearningEntriesRoute', {
      httpApi: this.httpApi,
      routePath: '/instructor/students/{studentId}/learning-entries',
      methods: [apigwv2.HttpMethod.GET],
      handler: props.instructorPortalLambda,
      authorizer: customAuthorizer,
    });

    new ApiRoute(this, 'InstructorUnitProgressRoute', {
      httpApi: this.httpApi,
      routePath: '/instructor/units/{unitId}/class-progress',
      methods: [apigwv2.HttpMethod.GET],
      handler: props.instructorPortalLambda,
      authorizer: customAuthorizer,
    });

    new ApiRoute(this, 'InstructorAssignmentSubmissionsRoute', {
      httpApi: this.httpApi,
      routePath: '/instructor/units/{unitId}/lessons/{lessonId}/sections/{sectionId}/assignment-submissions',
      methods: [apigwv2.HttpMethod.GET],
      handler: props.instructorPortalLambda,
      authorizer: customAuthorizer,
    });

    new ApiRoute(this, 'AuthLoginRoute', {
      httpApi: this.httpApi,
      routePath: '/auth/login',
      methods: [apigwv2.HttpMethod.POST],
      handler: props.authLambda,
      // No 'authorizer' property, making this route public
    });

    new ApiRoute(this, 'AuthRefreshRoute', {
      httpApi: this.httpApi,
      routePath: '/auth/refresh',
      methods: [apigwv2.HttpMethod.POST],
      handler: props.authLambda,
      // No 'authorizer' property, making this route public
    });

    new ApiRoute(this, 'AuthLogoutRoute', {
      httpApi: this.httpApi,
      routePath: '/auth/logout',
      methods: [apigwv2.HttpMethod.POST],
      handler: props.authLambda,
      // No 'authorizer' property, making this route public
    });
  }
}
