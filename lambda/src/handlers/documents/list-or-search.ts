import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Document } from '../../entities/Document';
import { searchDocuments } from '../../utils/search';
import createHttpError from 'http-errors';

const listOrSearchDocumentsHandler = async (
  event: APIGatewayProxyEvent,
  context: HandlerContext
): Promise<APIGatewayProxyResult> => {
  try {
    const query = event.queryStringParameters?.q;
    const limit = parseInt(event.queryStringParameters?.limit || '20');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    // 検索クエリがある場合は検索を実行
    if (query) {
      const documents = await searchDocuments(context.dataSource, query);
      
      // カテゴリ情報も含めて返す
      const documentsWithCategory = await Promise.all(
        documents.map(async (doc) => {
          const documentWithRelations = await context.dataSource
            .getRepository('Document')
            .findOne({
              where: { id: doc.id },
              relations: ['category'],
            });
          return documentWithRelations;
        })
      );

      return createResponse(200, {
        query,
        total: documentsWithCategory.length,
        limit: documentsWithCategory.length,  // 検索時は全件返すのでtotalと同じ
        offset: 0,  // 検索時は常に0
        documents: documentsWithCategory,
      });
    }

    // 検索クエリがない場合は一覧を返す
    const documentRepository = context.dataSource.getRepository(Document);
    
    const [documents, total] = await documentRepository.findAndCount({
      relations: ['category'],
      order: {
        created_at: 'DESC',
      },
      take: limit,
      skip: offset,
    });

    return createResponse(200, {
      total,
      limit,
      offset,
      documents,
    });
  } catch (error) {
    console.error('List/Search documents error:', error);
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(listOrSearchDocumentsHandler);