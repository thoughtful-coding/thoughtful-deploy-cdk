import { RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { ManagedSecret } from '../constructs/secret-manager';
import { EnvironmentProps } from '../utils/config';

export interface FoundationalResourcesStackProps extends StackProps {
  readonly envProps: EnvironmentProps;
}

export class FoundationalResourcesStack extends Stack {
  public readonly dockerRepository: ecr.IRepository;
  public readonly chatbotApiKeySecret: ManagedSecret;

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
  }
}
