#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { RdsStack } from '../lib/rds-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { appParameter } from '../lib/parameter';

const app = new cdk.App();

// VPCスタック
const vpcStack = new VpcStack(app, `${appParameter.envName}-VpcStack`, {
  env: appParameter.env,
  vpcCidr: appParameter.vpcCidr,
  description: 'VPC for Japanese fulltext search demo',
});

// RDSスタック
const rdsStack = new RdsStack(app, `${appParameter.envName}-RdsStack`, {
  env: appParameter.env,
  vpc: vpcStack.vpc,
  databaseSubnets: vpcStack.databaseSubnets,
  databaseName: appParameter.databaseName,
  writerInstanceType: appParameter.dbClusterProps.writerInstanceType,
  readerInstanceType: appParameter.dbClusterProps.readerInstanceType,
  description: 'Aurora PostgreSQL for Japanese fulltext search demo',
});

// Lambdaスタック
const lambdaStack = new LambdaStack(app, `${appParameter.envName}-LambdaStack`, {
  env: appParameter.env,
  vpc: vpcStack.vpc,
  privateSubnets: vpcStack.privateSubnets,
  dbProxyEndpoint: rdsStack.dbProxyEndpoint,
  dbSecret: rdsStack.dbSecret,
  memorySize: appParameter.lambdaProps.memorySize,
  timeout: appParameter.lambdaProps.timeout,
  description: 'Lambda functions for Japanese fulltext search demo',
});

// スタック間の依存関係
rdsStack.addDependency(vpcStack);
lambdaStack.addDependency(rdsStack);

// タグの追加
cdk.Tags.of(app).add('Project', 'JapaneseFulltextSearch');
cdk.Tags.of(app).add('Environment', appParameter.envName);