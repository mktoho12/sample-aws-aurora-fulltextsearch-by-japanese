import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Document } from '../../entities/Document';
import createHttpError from 'http-errors';

const getDocumentHandler = async (
  event: APIGatewayProxyEvent,
  context: HandlerContext
): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id;
    
    if (!id) {
      throw createHttpError(400, 'IDが必要です');
    }

    const documentRepository = context.dataSource.getRepository(Document);
    
    const document = await documentRepository.findOne({
      where: { id: parseInt(id) },
      relations: ['category'],
    });

    if (!document) {
      throw createHttpError(404, 'ドキュメントが見つかりません');
    }

    return createResponse(200, document);
  } catch (error) {
    console.error('Get document error:', error);
    if (error instanceof createHttpError.HttpError) {
      throw error;
    }
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(getDocumentHandler);