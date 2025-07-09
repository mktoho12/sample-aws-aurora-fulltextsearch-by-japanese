import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export class SampleAwsAuroraFulltextsearchByJapaneseStackDev extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 開発環境用の小さなVPC（NAT Gatewayなし）
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      natGateways: 0, // NAT Gatewayを使わない（月$45節約）
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // データベース認証情報
    const dbCredentials = new secretsmanager.Secret(this, 'DBCredentials', {
      description: 'Credentials for Aurora PostgreSQL',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });

    // セキュリティグループ
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc,
      description: 'Security group for Aurora PostgreSQL',
      allowAllOutbound: true,
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to Aurora PostgreSQL'
    );

    // 開発環境用の小さなAurora PostgreSQL
    const auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromSecret(dbCredentials),
      defaultDatabaseName: 'api_db',
      writer: rds.ClusterInstance.provisioned('writer', {
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T4G,
          ec2.InstanceSize.MEDIUM  // 開発環境用の小さなインスタンス
        ),
      }),
      readers: [
        rds.ClusterInstance.provisioned('reader', {
          instanceType: ec2.InstanceType.of(
            ec2.InstanceClass.T4G,
            ec2.InstanceSize.MEDIUM
          ),
        }),
      ],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda関数（パブリックサブネットで実行してNAT Gatewayを回避）
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'src/index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/dist')),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // パブリックサブネットで実行
      },
      allowPublicSubnet: true, // パブリックサブネットでの実行を許可
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_HOST: auroraCluster.clusterEndpoint.hostname,
        DB_PORT: '5432',
        DB_NAME: 'api_db',
        DB_SECRET_ARN: dbCredentials.secretArn,
        NODE_ENV: 'development',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512, // メモリも削減
      logRetention: logs.RetentionDays.ONE_DAY, // ログ保持期間も短縮
    });

    dbCredentials.grantRead(apiFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'FullTextSearchAPI-Dev',
      description: 'Development API for full text search',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      deployOptions: {
        stageName: 'api',
      },
    });

    // API設定（同じ）
    const documents = api.root.addResource('documents');
    const documentProxy = documents.addResource('{proxy+}');
    documents.addMethod('ANY', new apigateway.LambdaIntegration(apiFunction));
    documentProxy.addMethod('ANY', new apigateway.LambdaIntegration(apiFunction));

    const categories = api.root.addResource('categories');
    const categoryProxy = categories.addResource('{proxy+}');
    categories.addMethod('ANY', new apigateway.LambdaIntegration(apiFunction));
    categoryProxy.addMethod('ANY', new apigateway.LambdaIntegration(apiFunction));

    // 出力
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'DBEndpoint', {
      value: auroraCluster.clusterEndpoint.hostname,
      description: 'Aurora cluster endpoint',
    });
  }
}