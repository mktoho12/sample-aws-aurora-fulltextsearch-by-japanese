import { DataSource } from 'typeorm';
import { Category } from './src/entities/Category';
import { Document } from './src/entities/Document';
import { DocumentSubscriber } from './src/subscribers/DocumentSubscriber';
import { CategorySubscriber } from './src/subscribers/CategorySubscriber';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'sampledb',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [Category, Document],
  migrations: ['src/migrations/*.ts'],
  subscribers: [DocumentSubscriber, CategorySubscriber],
});