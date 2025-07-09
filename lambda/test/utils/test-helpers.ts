import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DataSource } from 'typeorm';
import { Document } from '../../src/entities/Document';
import { Category } from '../../src/entities/Category';
import { DocumentSubscriber } from '../../src/subscribers/DocumentSubscriber';
import { CategorySubscriber } from '../../src/subscribers/CategorySubscriber';

// APIGatewayProxyEventのモックを作成
export const createMockEvent = (
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent => {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api-id',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource-id',
      resourcePath: '/',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-user-agent',
        userArn: null,
      },
    },
    resource: '/',
    ...overrides,
  };
};

// Contextのモックを作成
export const createMockContext = (): Context => {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };
};

// グローバルな配列で作成されたデータベース名を追跡
const createdDatabases: string[] = [];

// プロセス終了時のクリーンアップを登録
const registerCleanupHandlers = () => {
  const cleanup = async () => {
    if (createdDatabases.length === 0) return;
    
    console.log('Cleaning up test databases...');
    const adminDataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'postgres',
    });

    try {
      await adminDataSource.initialize();
      for (const dbName of createdDatabases) {
        try {
          await adminDataSource.query(`DROP DATABASE IF EXISTS ${dbName}`);
          console.log(`Dropped database: ${dbName}`);
        } catch (error) {
          console.error(`Failed to drop database ${dbName}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to connect for cleanup:', error);
    } finally {
      if (adminDataSource.isInitialized) {
        await adminDataSource.destroy();
      }
    }
  };

  // 各種終了シグナルに対してクリーンアップを登録
  let cleanupInProgress = false;
  
  const handleExit = () => {
    if (cleanupInProgress || createdDatabases.length === 0) return;
    cleanupInProgress = true;
    
    // 同期的にクリーンアップコマンドを実行
    const { execSync } = require('child_process');
    for (const dbName of createdDatabases) {
      try {
        execSync(`psql -U postgres -c "DROP DATABASE IF EXISTS ${dbName}"`, {
          env: { ...process.env, PGPASSWORD: 'postgres' },
          stdio: 'ignore'
        });
        console.log(`Dropped database: ${dbName}`);
      } catch (error) {
        // エラーは無視（データベースが存在しない場合など）
      }
    }
  };
  
  process.on('exit', handleExit);
  process.on('SIGINT', () => {
    handleExit();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    handleExit();
    process.exit(143);
  });
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    handleExit();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    handleExit();
    process.exit(1);
  });
};

// 最初のインポート時に一度だけ登録
registerCleanupHandlers();

// テスト用のデータベース接続を作成
export const createTestDataSource = async (dbName: string): Promise<DataSource> => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: dbName,
    synchronize: true,
    dropSchema: true,
    entities: [Document, Category],
    subscribers: [DocumentSubscriber, CategorySubscriber],
    logging: false,
  });

  return dataSource.initialize();
};

// テスト用のデータベースをセットアップ
export const setupTestDatabase = async (): Promise<DataSource> => {
  // ユニークなデータベース名を生成
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const dbName = `test_api_db_${timestamp}_${random}`;
  
  // 作成するデータベース名を記録
  createdDatabases.push(dbName);
  
  // 管理用接続でデータベースを作成
  const adminDataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });

  await adminDataSource.initialize();
  
  try {
    await adminDataSource.query(`CREATE DATABASE ${dbName}`);
  } finally {
    await adminDataSource.destroy();
  }

  const dataSource = await createTestDataSource(dbName);
  // DataSourceにデータベース名を保存（クリーンアップ時に使用）
  (dataSource as any).testDbName = dbName;
  
  return dataSource;
};

// テスト用のデータベースをクリーンアップ
export const cleanupTestDatabase = async (dataSource: DataSource): Promise<void> => {
  const dbName = (dataSource as any).testDbName;
  
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }

  if (!dbName) return;

  const adminDataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });

  await adminDataSource.initialize();
  
  try {
    await adminDataSource.query(`DROP DATABASE IF EXISTS ${dbName}`);
    // 削除できたらリストから削除
    const index = createdDatabases.indexOf(dbName);
    if (index > -1) {
      createdDatabases.splice(index, 1);
    }
  } finally {
    await adminDataSource.destroy();
  }
};