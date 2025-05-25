import { RemovalPolicy, Duration, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { ManagedSecret } from '../constructs/secret-manager';
import { EnvironmentProps } from '../utils/config';

export interface FoundationalResourcesStackProps extends StackProps {
  readonly envProps: EnvironmentProps;
}

export class FoundationalResourcesStack extends Stack {
  public readonly dockerRepository: ecr.IRepository;
  public readonly chatbotApiKeySecret: ManagedSecret;
  public readonly httpApi: apigwv2.HttpApi;
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props: FoundationalResourcesStackProps) {
    super(scope, id, props);

    this.dockerRepository = new ecr.Repository(this, 'SampleAppDockerRepositoryConstruct', {
      repositoryName: `sample_app_src_rep-${props.envProps.account}-${props.envProps.region}`,
      removalPolicy: RemovalPolicy.RETAIN,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep only the last 10 images',
          maxImageCount: 2,
          tagStatus: ecr.TagStatus.ANY,
        },
      ],
    });

    // Output the repository URI. This can be useful for CI/CD pipelines or for other stacks to reference.
    new CfnOutput(this, 'DockerRepositoryUriOutput', {
      value: this.dockerRepository.repositoryUri,
      description: 'The URI of the ECR Docker repository',
      exportName: 'DockerRepositoryUri', // Optional: makes it easier to import in other stacks if not passing the stack object directly
    });

    // Secrets

    this.chatbotApiKeySecret = new ManagedSecret(this, 'AppChatBotApiKey', {
      secretName: '/thoughtful-python/chatbot-api-key',
    });

    // API for various apps

    this.httpApi = new apigwv2.HttpApi(this, 'StorageStackHttpApi', {
      apiName: 'StorageStackHttpApi',
      description: 'HTTP API for the various apps',
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
  }
}
