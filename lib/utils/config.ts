// Define the interface for environment settings
export interface EnvironmentProps {
    account: string;
    region: string;
}

export const GOOGLE_CLIENT_ID =
  "111269738814-64jdhnq0krkbgdk7f1lubtf7oc1fkr8n.apps.googleusercontent.com";

// Stage types for deployment environments
export type Stage = 'prod' | 'beta';

// Configuration that varies by stage
export interface StageConfig {
    stage: Stage;
    region: string;
    enableTestAuth: boolean;
    enableDemoPermissions: boolean;
}

// Get stage-specific configuration
export function getStageConfig(stage: Stage): StageConfig {
    switch (stage) {
        case 'beta':
            return {
                stage: 'beta',
                region: 'us-east-1',
                enableTestAuth: true,      // Allow Playwright E2E test authentication
                enableDemoPermissions: true,
            };
        case 'prod':
        default:
            return {
                stage: 'prod',
                region: 'us-west-1',
                enableTestAuth: false,     // Never enable test auth in production
                enableDemoPermissions: true, // Allow new users to see demo instructor dashboard
            };
    }
}

export class CdkConfig {
    // Function to fetch environment using the defined interface
    static getEnvironment(stage?: Stage): EnvironmentProps {
        const stageConfig = stage ? getStageConfig(stage) : null;
        return {
            account: process.env.CDK_DEFAULT_ACCOUNT || "598791268315",
            region: stageConfig?.region || process.env.CDK_DEFAULT_REGION || "us-west-1"
        };
    }
}
