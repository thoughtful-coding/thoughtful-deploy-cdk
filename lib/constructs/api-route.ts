import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';

// Props for our custom ApiRoute construct
export interface ApiRouteProps {
  readonly httpApi: apigwv2.HttpApi;
  readonly routePath: string;
  readonly methods: apigwv2.HttpMethod[];
  readonly handler: lambda.IFunction;
  readonly authorizer?: apigwv2.IHttpRouteAuthorizer;
}

// Custom construct to define an API route with Lambda integration
export class ApiRoute extends Construct {
  constructor(scope: Construct, id: string, props: ApiRouteProps) {
    super(scope, id);

    const lambdaIntegration = new HttpLambdaIntegration(id, props.handler);

    props.httpApi.addRoutes({
      path: props.routePath,
      methods: props.methods,
      integration: lambdaIntegration,
      authorizer: props.authorizer,
    });
  }
}
