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
  public readonly jwtSecret: ManagedSecret;

  constructor(scope: Construct, id: string, props: FoundationalResourcesStackProps) {
    super(scope, id, props);

    // Reference the existing ECR repository created by the backend CI/CD pipeline
    // Repository: 598791268315.dkr.ecr.us-west-1.amazonaws.com/thoughtful-coding/backend
    this.dockerRepository = ecr.Repository.fromRepositoryName(
      this,
      'ThtflCodeAppDockerRepositoryConstruct',
      'thoughtful-coding/backend'
    );

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

    this.jwtSecret = new ManagedSecret(this, 'AppJwtSecretKey', {
      secretName: '/thoughtful-python/jwt-secret-key',
      // It's recommended to have CDK generate a strong secret for you
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'jwt-user' }),
        generateStringKey: 'password',
        passwordLength: 32,
        excludePunctuation: true,
      },
    });
  }
}
