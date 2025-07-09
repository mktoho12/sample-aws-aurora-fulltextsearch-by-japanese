import 'reflect-metadata';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createHandler } from './utils/middy';

// ハンドラーをインポート
import * as documentHandlers from './handlers/index';
import * as categoryHandlers from './handlers/index';

// ルーティングテーブル
const routes: { [key: string]: any } = {
  // Documents
  'GET /documents': documentHandlers.listOrSearchDocuments,
  'POST /documents': documentHandlers.createDocument,
  'GET /documents/{id}': documentHandlers.getDocument,
  'PUT /documents/{id}': documentHandlers.updateDocument,
  'DELETE /documents/{id}': documentHandlers.deleteDocument,
  
  // Categories
  'GET /categories': categoryHandlers.listCategories,
  'POST /categories': categoryHandlers.createCategory,
  'GET /categories/{id}': categoryHandlers.getCategory,
  'PUT /categories/{id}': categoryHandlers.updateCategory,
  'DELETE /categories/{id}': categoryHandlers.deleteCategory,
};

// メインハンドラー
const routerHandler = async (event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.resource; // API Gatewayのresourceパス（例: /documents/{id}）
  
  const routeKey = `${method} ${path}`;
  const handler = routes[routeKey];
  
  if (!handler) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Route not found' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
  
  // 対応するハンドラーを実行
  return handler(event, context);
};

// Middyでラップしてエクスポート
export const handler = createHandler(routerHandler);