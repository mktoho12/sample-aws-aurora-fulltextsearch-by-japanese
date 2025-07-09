import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export class SampleAwsAuroraFulltextsearchByJapaneseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPCの作成
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // データベース認証情報の作成
    const dbCredentials = new secretsmanager.Secret(this, 'DBCredentials', {
      description: 'Credentials for Aurora PostgreSQL',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });

    // セキュリティグループの作成
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

    // Lambda関数からデータベースへの接続を許可
    dbSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to Aurora PostgreSQL'
    );

    // Aurora PostgreSQLクラスターの作成
    const auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromSecret(dbCredentials),
      defaultDatabaseName: 'api_db',
      instanceProps: {
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        securityGroups: [dbSecurityGroup],
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.BURSTABLE3,
          ec2.InstanceSize.MEDIUM
        ),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 本番環境では RETAIN にすること
    });

    // Lambda Layer の作成（node_modules用）
    const lambdaLayer = new lambda.LayerVersion(this, 'LambdaLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_18_X.bundlingImage,
          local: {
            tryBundle(outputDir: string) {
              const { execSync } = require('child_process');
              const layerDir = path.join(outputDir, 'nodejs');
              
              // Create nodejs directory structure for Lambda Layer
              execSync(`mkdir -p ${layerDir}`);
              execSync(`cp ${path.join(__dirname, '../lambda/package*.json')} ${layerDir}/`);
              execSync(`cd ${layerDir} && npm ci --production`, { stdio: 'inherit' });
              execSync(`rm ${layerDir}/package*.json`);
              
              return true;
            },
          },
          command: [
            'bash', '-c', [
              'mkdir -p /asset-output/nodejs',
              'cp package*.json /asset-output/nodejs/',
              'cd /asset-output/nodejs',
              'npm ci --production',
              'rm package*.json',
            ].join(' && '),
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Node modules layer',
    });

    // 環境変数の定義
    const environment = {
      DB_HOST: auroraCluster.clusterEndpoint.hostname,
      DB_PORT: '5432',
      DB_NAME: 'api_db',
      DB_SECRET_ARN: dbCredentials.secretArn,
      NODE_ENV: 'production',
    };

    // 単一のLambda関数で全てのAPIを処理
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'src/index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_18_X.bundlingImage,
          local: {
            tryBundle(outputDir: string) {
              const { execSync } = require('child_process');
              const lambdaDir = path.join(__dirname, '../lambda');
              
              // Build TypeScript
              execSync('npm ci', { cwd: lambdaDir, stdio: 'inherit' });
              execSync('npm run build', { cwd: lambdaDir, stdio: 'inherit' });
              
              // Copy built files to output
              execSync(`cp -r ${lambdaDir}/dist/* ${outputDir}/`);
              
              // Copy migrations if exists
              try {
                execSync(`cp -r ${lambdaDir}/src/migrations ${outputDir}/migrations`);
              } catch (e) {
                // Ignore if migrations directory doesn't exist
              }
              
              return true;
            },
          },
          command: [
            'bash', '-c', [
              'npm ci',
              'npm run build',
              'cp -r dist/* /asset-output/',
              'cp -r src/migrations /asset-output/migrations 2>/dev/null || true',
            ].join(' && '),
          ],
        },
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      environment,
      layers: [lambdaLayer],
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'Main API handler function',
    });

    // シークレットへのアクセス権限を付与
    dbCredentials.grantRead(apiFunction);

    // API Gatewayの作成（プロキシ統合）
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'FullTextSearchAPI',
      description: 'API for full text search with Japanese support',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Documents エンドポイント
    const documents = api.root.addResource('documents');
    const documentProxy = documents.addResource('{proxy+}');
    
    // 全てのメソッドを単一のLambda関数にルーティング
    documents.addMethod('ANY', new apigateway.LambdaIntegration(apiFunction));
    documentProxy.addMethod('ANY', new apigateway.LambdaIntegration(apiFunction));

    // Categories エンドポイント
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

    new cdk.CfnOutput(this, 'DBSecretArn', {
      value: dbCredentials.secretArn,
      description: 'Database credentials secret ARN',
    });
  }
}