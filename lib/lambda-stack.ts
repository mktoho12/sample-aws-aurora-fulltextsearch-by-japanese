import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as path from 'path';

export interface LambdaStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  privateSubnets: ec2.ISubnet[];
  dbProxyEndpoint: rds.DatabaseProxy;
  dbSecret: secretsmanager.Secret;
  memorySize: number;
  timeout: cdk.Duration;
}

export class LambdaStack extends cdk.Stack {
  public readonly searchFunction: lambda.Function;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Lambda Layer（形態素解析ライブラリ用）
    const morphLayer = new lambda.LayerVersion(this, 'MorphAnalysisLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-layers/morph-analysis')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Japanese morphological analysis libraries',
    });

    // Lambda関数
    this.searchFunction = new lambda.Function(this, 'SearchFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.privateSubnets,
      },
      memorySize: props.memorySize,
      timeout: props.timeout,
      environment: {
        DB_PROXY_ENDPOINT: props.dbProxyEndpoint.endpoint,
        DB_SECRET_ARN: props.dbSecret.secretArn,
        NODE_OPTIONS: '--enable-source-maps',
      },
      layers: [morphLayer],
    });

    // Lambda用のセキュリティグループ
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Lambda function',
      allowAllOutbound: true,
    });
    this.searchFunction.connections.addSecurityGroup(lambdaSecurityGroup);

    // RDS Proxyへのアクセス許可
    props.dbProxyEndpoint.grantConnect(this.searchFunction, 'postgres');

    // Secrets Managerへのアクセス許可
    props.dbSecret.grantRead(this.searchFunction);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'SearchApi', {
      restApiName: 'Japanese Fulltext Search API',
      description: 'API for Japanese fulltext search demo',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // API エンドポイント
    const searchResource = this.api.root.addResource('search');
    searchResource.addMethod('POST', new apigateway.LambdaIntegration(this.searchFunction));

    const analyzeResource = this.api.root.addResource('analyze');
    analyzeResource.addMethod('POST', new apigateway.LambdaIntegration(this.searchFunction));

    // 出力
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'SearchEndpoint', {
      value: `${this.api.url}search`,
      description: 'Search endpoint URL',
    });

    new cdk.CfnOutput(this, 'AnalyzeEndpoint', {
      value: `${this.api.url}analyze`,
      description: 'Text analysis endpoint URL',
    });
  }
}