import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Category } from '../entities/Category';
import { Document } from '../entities/Document';
import { DocumentSubscriber } from '../subscribers/DocumentSubscriber';
import { CategorySubscriber } from '../subscribers/CategorySubscriber';

export const createConnection = async (): Promise<DataSource> => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'sampledb',
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    entities: [Category, Document],
    subscribers: [DocumentSubscriber, CategorySubscriber],
  });

  return await dataSource.initialize();
};