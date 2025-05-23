import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Dashboard, GraphWidget } from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface OverviewStackProps extends StackProps {
  readonly apiTransformationLambda: lambda.IFunction;
}

export class OverviewStack extends Stack {
  constructor(scope: Construct, id: string, props: OverviewStackProps) {
    super(scope, id, props);

    // Create a new CloudWatch Dashboard
    const dashboard = new Dashboard(this, 'LambdaDashboard', {
      dashboardName: 'LambdaActivityDashboard',
    });

    // Widget for Lambda Invocations
    const invocationWidget = new GraphWidget({
      title: 'Transform Lambda Invocations',
      left: [
        props.apiTransformationLambda.metricInvocations({
          statistic: 'Sum',
          period: Duration.minutes(1),
        }),
      ],
    });
    dashboard.addWidgets(invocationWidget);

    // Widget for Lambda Errors
    const errorWidget = new GraphWidget({
      title: 'Transform Lambda Invocation Errors',
      left: [
        props.apiTransformationLambda.metricErrors({
          statistic: 'Sum',
          period: Duration.minutes(1),
        }),
      ],
    });

    // Add widgets to the dashboard
    dashboard.addWidgets(errorWidget);
  }
}
