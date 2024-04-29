
// Define the interface for environment settings
export interface EnvironmentProps {
    account: string;
    region: string;
}

export class CdkConfig {
    // Function to fetch environment using the defined interface
    static getEnvironment(): EnvironmentProps {
        return {
            account: process.env.CDK_DEFAULT_ACCOUNT || "598791268315",
            region: process.env.CDK_DEFAULT_REGION || "us-east-2"
        };
    }
}