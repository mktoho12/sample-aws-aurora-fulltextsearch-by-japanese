import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DataSource } from 'typeorm';
import { createConnection } from '../database/connection';

export interface HandlerContext extends Context {
  dataSource: DataSource;
}

// データベース接続を管理するミドルウェア
const dbConnectionMiddleware = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  let dataSource: DataSource | null = null;

  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request) => {
    if (!dataSource || !dataSource.isInitialized) {
      dataSource = await createConnection();
    }
    (request.context as HandlerContext).dataSource = dataSource;
  };

  return {
    before,
  };
};

// 基本的なミドルウェアスタック
export const createHandler = (
  handler: (event: APIGatewayProxyEvent, context: HandlerContext) => Promise<APIGatewayProxyResult>
) => {
  return middy<APIGatewayProxyEvent, APIGatewayProxyResult>(handler as any)
    .use(httpJsonBodyParser())
    .use(cors())
    .use(dbConnectionMiddleware())
    .use(httpErrorHandler());
};

// レスポンスヘルパー
export const createResponse = (statusCode: number, body: any): APIGatewayProxyResult => {
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  };
};