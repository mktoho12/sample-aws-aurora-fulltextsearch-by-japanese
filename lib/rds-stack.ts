import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface RdsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  databaseSubnets: ec2.ISubnet[];
  databaseName: string;
  writerInstanceType: ec2.InstanceType;
  readerInstanceType: ec2.InstanceType;
}

export class RdsStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly dbProxyEndpoint: rds.DatabaseProxy;

  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    // データベース認証情報のシークレット
    this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      description: 'Database master password',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
        passwordLength: 30,
      },
    });

    // サブネットグループの作成
    const subnetGroup = new rds.SubnetGroup(this, 'DbSubnetGroup', {
      description: 'Database subnet group',
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.databaseSubnets,
      },
    });

    // パラメータグループの作成（日本語全文検索用の設定）
    const parameterGroup = new rds.ParameterGroup(this, 'DbParameterGroup', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_5,
      }),
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements,pgaudit',
        'log_statement': 'all',
        'log_min_duration_statement': '1000',
        // 標準のPostgreSQL全文検索設定
        'default_text_search_config': 'pg_catalog.simple',
      },
    });

    // Aurora PostgreSQLクラスターの作成
    this.cluster = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_5,
      }),
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      writer: rds.ClusterInstance.provisioned('Writer', {
        instanceType: props.writerInstanceType,
        enablePerformanceInsights: true,
      }),
      readers: [
        rds.ClusterInstance.provisioned('Reader', {
          instanceType: props.readerInstanceType,
          enablePerformanceInsights: true,
        }),
      ],
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      subnetGroup: subnetGroup,
      parameterGroup: parameterGroup,
      port: 5432,
      defaultDatabaseName: props.databaseName,
      storageEncrypted: true,
      backup: {
        retention: cdk.Duration.days(7),
        preferredWindow: '16:00-17:00', // JST 01:00-02:00
      },
      preferredMaintenanceWindow: 'sun:17:00-sun:18:00', // JST 02:00-03:00
    });

    // RDS Proxyの作成（Lambda接続用）
    this.dbProxyEndpoint = new rds.DatabaseProxy(this, 'DbProxy', {
      proxyTarget: rds.ProxyTarget.fromCluster(this.cluster),
      secrets: [this.dbSecret],
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.databaseSubnets,
      },
      requireTLS: true,
      iamAuth: true,
      maxConnectionsPercent: 100,
      maxIdleConnectionsPercent: 50,
      connectionBorrowTimeout: cdk.Duration.seconds(30),
      initQuery: 'SET search_path TO public',
    });

    // 出力
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Aurora cluster endpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseProxyEndpoint', {
      value: this.dbProxyEndpoint.endpoint,
      description: 'RDS Proxy endpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'Database secret ARN',
    });
  }
}