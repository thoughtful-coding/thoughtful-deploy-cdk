import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { EnvironmentProps } from '../utils/config';

export interface FoundationalResourcesStackProps extends StackProps {
  readonly envProps: EnvironmentProps;
}

export class FoundationalResourcesStack extends Stack {
  public readonly dockerRepository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: FoundationalResourcesStackProps) {
    super(scope, id, props);

    // Reference the existing ECR repository created by the backend CI/CD pipeline
    // The repository must exist in the target region (created manually or via backend CI/CD)
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
  }
}
