import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Document } from '../../entities/Document';
import createHttpError from 'http-errors';

const updateDocumentHandler = async (
  event: APIGatewayProxyEvent,
  context: HandlerContext
): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id;
    const body = event.body as any;
    
    if (!id) {
      throw createHttpError(400, 'IDが必要です');
    }

    const documentRepository = context.dataSource.getRepository(Document);
    
    const document = await documentRepository.findOne({
      where: { id: parseInt(id) },
    });

    if (!document) {
      throw createHttpError(404, 'ドキュメントが見つかりません');
    }

    // 更新可能なフィールドのみ更新
    if (body.name !== undefined) document.name = body.name;
    if (body.title !== undefined) document.title = body.title;
    if (body.content !== undefined) document.content = body.content;
    if (body.category_id !== undefined) document.category_id = body.category_id;

    const updatedDocument = await documentRepository.save(document);
    
    // カテゴリ情報も含めて返す
    const documentWithRelations = await documentRepository.findOne({
      where: { id: updatedDocument.id },
      relations: ['category'],
    });

    return createResponse(200, documentWithRelations);
  } catch (error) {
    console.error('Update document error:', error);
    if (error instanceof createHttpError.HttpError) {
      throw error;
    }
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(updateDocumentHandler);