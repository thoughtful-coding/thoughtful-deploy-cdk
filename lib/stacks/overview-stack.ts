import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface OverviewStackProps extends StackProps {
  authLambda: lambda.IFunction;
  authorizerLambda: lambda.IFunction;
  learningEntriesLambda: lambda.IFunction;
  primmFeedbackLambda: lambda.IFunction;
}

export class OverviewStack extends Stack {
  constructor(scope: Construct, id: string, props: OverviewStackProps) {
    super(scope, id, props);

    const dashboard = new cw.Dashboard(this, 'AppDashboard', {
      dashboardName: 'ThoughtfulPython-Overview',
    });

    // --- Reusable Widget Creation Functions ---

    const createLambdaPerformanceWidget = (title: string, lambdaFunc: lambda.IFunction) => {
      return new cw.GraphWidget({
        title,
        width: 12,
        left: [
          lambdaFunc.metricInvocations({ label: 'Invocations', period: Duration.minutes(5), color: cw.Color.BLUE }),
          lambdaFunc.metricErrors({ label: 'Errors', period: Duration.minutes(5), color: cw.Color.RED }),
        ],
        right: [
          lambdaFunc.metricDuration({
            label: 'Latency (p90)',
            period: Duration.minutes(5),
            statistic: 'p90',
            color: cw.Color.ORANGE,
          }),
        ],
      });
    };

    const createCustomMetricWidget = (
      title: string,
      namespace: string,
      metrics: { name: string; label: string; color?: string }[]
    ) => {
      return new cw.GraphWidget({
        title,
        width: 12,
        left: metrics.map(
          (m) =>
            new cw.Metric({
              namespace,
              metricName: m.name,
              label: m.label,
              statistic: 'sum',
              period: Duration.minutes(5),
              color: m.color,
            })
        ),
      });
    };

    // --- SECTION 1: Thoughtful Teaching Authentication ---
    dashboard.addWidgets(new cw.TextWidget({ markdown: '## 2. Authentication Service', width: 24, height: 1 }));
    const authRow = new cw.Row(
      createCustomMetricWidget('Authorizer Events (SUM)', 'ThoughtfulPython/Authentication', [
        { name: 'AuthorizationSuccess', label: 'Success', color: cw.Color.GREEN },
        { name: 'AuthorizationFailure', label: 'Failure (Deny)', color: cw.Color.RED },
      ]),
      createCustomMetricWidget('Session Events (SUM)', 'ThoughtfulPython/Authentication', [
        { name: 'LoginSuccess', label: 'Logins' },
        { name: 'RefreshSuccess', label: 'Refreshes' },
        { name: 'LoginFailure', label: 'Login Failures' },
        { name: 'RefreshFailure', label: 'Refresh Failures' },
      ])
    );
    dashboard.addWidgets(authRow);
    dashboard.addWidgets(
      new cw.Row(
        createLambdaPerformanceWidget('Authorizer Lambda Performance', props.authorizerLambda),
        createLambdaPerformanceWidget('Session Lambda Performance', props.authLambda)
      )
    );

    // --- SECTION 2: ChatBot Usage ---
    dashboard.addWidgets(new cw.TextWidget({ markdown: '## 3. ChatBot Usage & Health', width: 24, height: 1 }));
    const chatbotRow = new cw.Row(
      createCustomMetricWidget('ChatBot Events (SUM)', 'ThoughtfulPython/ChatBot', [
        { name: 'ChatBotApiFailure', label: 'ChatBot API Failures', color: cw.Color.RED },
        { name: 'ThrottledRequest', label: 'Throttled Users', color: cw.Color.ORANGE },
      ]),
      new cw.GraphWidget({
        title: 'ChatBot Lambda Invocations (SUM)',
        width: 12,
        left: [
          props.learningEntriesLambda.metricInvocations({ label: 'Reflection Lambda' }),
          props.primmFeedbackLambda.metricInvocations({ label: 'PRIMM Lambda' }),
        ],
      })
    );
    dashboard.addWidgets(chatbotRow);
  }
}
