import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Document } from '../../entities/Document';
import createHttpError from 'http-errors';

const deleteDocumentHandler = async (
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
    });

    if (!document) {
      throw createHttpError(404, 'ドキュメントが見つかりません');
    }

    await documentRepository.remove(document);

    return createResponse(204, null);
  } catch (error) {
    console.error('Delete document error:', error);
    if (error instanceof createHttpError.HttpError) {
      throw error;
    }
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(deleteDocumentHandler);