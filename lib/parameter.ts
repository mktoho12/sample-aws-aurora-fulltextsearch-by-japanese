import { Duration, Environment, aws_ec2 as ec2 } from 'aws-cdk-lib';

export interface AppParameter {
  env: Environment;
  appName: string;
  envName: string;
  
  // VPC設定
  vpcCidr: string;
  
  // RDS設定
  databaseName: string;
  dbClusterProps: {
    writerInstanceType: ec2.InstanceType;
    readerInstanceType: ec2.InstanceType;
  };
  
  // Lambda設定
  lambdaProps: {
    memorySize: number;
    timeout: Duration;
  };
}

export const appParameter: AppParameter = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || 'ACCOUNT_ID_HERE',
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  
  appName: 'FulltextSearchTest',
  envName: 'Dev',
  
  // VPC設定
  vpcCidr: '10.200.0.0/16',
  
  // RDS設定（本番環境と同等のスペック）
  databaseName: 'fulltextsearch',
  dbClusterProps: {
    writerInstanceType: ec2.InstanceType.of(ec2.InstanceClass.R7G, ec2.InstanceSize.LARGE),
    readerInstanceType: ec2.InstanceType.of(ec2.InstanceClass.R7G, ec2.InstanceSize.LARGE),
  },
  
  // Lambda設定（形態素解析ライブラリのメモリ使用を考慮）
  lambdaProps: {
    memorySize: 1024,
    timeout: Duration.seconds(30),
  },
};