import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';

export interface EnvironmentConfig {
  envName: string;
  vpc: {
    natGateways: number;
  };
  aurora: {
    instanceType: ec2.InstanceType;
    readerCount: number;
  };
  lambda: {
    memorySize: number;
    timeout: cdk.Duration;
  };
  costMonthlyEstimate: string;
}

export const environments: { [key: string]: EnvironmentConfig } = {
  dev: {
    envName: 'Development',
    vpc: {
      natGateways: 0,  // NAT Gateway なし
    },
    aurora: {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
      readerCount: 1,
    },
    lambda: {
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    },
    costMonthlyEstimate: '$125/month',
  },
  
  staging: {
    envName: 'Staging',
    vpc: {
      natGateways: 1,
    },
    aurora: {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R7G, ec2.InstanceSize.MEDIUM),
      readerCount: 1,
    },
    lambda: {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
    },
    costMonthlyEstimate: '$300/month',
  },
  
  prod: {
    envName: 'Production',
    vpc: {
      natGateways: 2,  // 高可用性
    },
    aurora: {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R7G, ec2.InstanceSize.LARGE),
      readerCount: 2,  // 複数のリーダー
    },
    lambda: {
      memorySize: 2048,
      timeout: cdk.Duration.seconds(60),
    },
    costMonthlyEstimate: '$800/month',
  },
};