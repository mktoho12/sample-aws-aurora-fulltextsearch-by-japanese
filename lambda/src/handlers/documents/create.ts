import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Document } from '../../entities/Document';
import createHttpError from 'http-errors';

const createDocumentHandler = async (
  event: APIGatewayProxyEvent,
  context: HandlerContext
): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body as any;
    
    if (!body.name || !body.title || !body.content) {
      throw createHttpError(400, 'name, title, content は必須項目です');
    }

    const documentRepository = context.dataSource.getRepository(Document);
    
    const document = documentRepository.create({
      name: body.name,
      title: body.title,
      content: body.content,
      category_id: body.category_id || null,
    });

    const savedDocument = await documentRepository.save(document);
    
    // カテゴリ情報も含めて返す
    const documentWithRelations = await documentRepository.findOne({
      where: { id: savedDocument.id },
      relations: ['category'],
    });

    return createResponse(201, documentWithRelations);
  } catch (error) {
    console.error('Create document error:', error);
    if (error instanceof createHttpError.HttpError) {
      throw error;
    }
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(createDocumentHandler);