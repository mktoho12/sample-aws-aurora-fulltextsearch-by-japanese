import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Category } from '../entities/Category';
import { Document } from '../entities/Document';
import { DocumentSubscriber } from '../subscribers/DocumentSubscriber';
import { CategorySubscriber } from '../subscribers/CategorySubscriber';
import * as AWS from 'aws-sdk';

let dataSource: DataSource | null = null;

interface SecretData {
  username: string;
  password: string;
  engine?: string;
  host?: string;
  port?: number;
  dbname?: string;
}

async function getSecretValue(secretArn: string): Promise<SecretData> {
  const secretsManager = new AWS.SecretsManager();
  
  try {
    const data = await secretsManager.getSecretValue({ SecretId: secretArn }).promise();
    if (data.SecretString) {
      return JSON.parse(data.SecretString);
    }
    throw new Error('Secret string is empty');
  } catch (error) {
    console.error('Error retrieving secret:', error);
    throw error;
  }
}

export const createConnection = async (): Promise<DataSource> => {
  if (dataSource && dataSource.isInitialized) {
    return dataSource;
  }

  // 環境変数から設定を取得
  const isProduction = process.env.NODE_ENV === 'production';
  
  let config: any;

  if (isProduction && process.env.DB_SECRET_ARN) {
    // 本番環境: Secrets Managerから認証情報を取得
    const secretData = await getSecretValue(process.env.DB_SECRET_ARN);
    
    config = {
      type: 'postgres',
      host: process.env.DB_HOST || secretData.host,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: secretData.username,
      password: secretData.password,
      database: process.env.DB_NAME || secretData.dbname || 'api_db',
      entities: [Category, Document],
      subscribers: [DocumentSubscriber, CategorySubscriber],
      synchronize: false, // 本番環境では自動同期を無効化
      logging: false,
      ssl: {
        rejectUnauthorized: false, // Aurora用の設定
      },
    };
  } else {
    // 開発環境: 環境変数から直接取得
    config = {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'api_db',
      entities: [Category, Document],
      subscribers: [DocumentSubscriber, CategorySubscriber],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    };
  }

  dataSource = new DataSource(config);
  
  try {
    await dataSource.initialize();
    console.log('Database connection established');
    
    // 本番環境の場合、マイグレーションを実行
    if (isProduction) {
      console.log('Running migrations...');
      await dataSource.runMigrations();
      console.log('Migrations completed');
    }
    
    return dataSource;
  } catch (error) {
    console.error('Error connecting to database:', error);
    dataSource = null;
    throw error;
  }
};