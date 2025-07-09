import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Category } from '../../entities/Category';
import createHttpError from 'http-errors';

const getCategoryHandler = async (
  event: APIGatewayProxyEvent,
  context: HandlerContext
): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id;
    
    if (!id) {
      throw createHttpError(400, 'IDが必要です');
    }

    const categoryRepository = context.dataSource.getRepository(Category);
    
    const category = await categoryRepository.findOne({
      where: { id: parseInt(id) },
      relations: ['documents'],
    });

    if (!category) {
      throw createHttpError(404, 'カテゴリが見つかりません');
    }

    return createResponse(200, category);
  } catch (error) {
    console.error('Get category error:', error);
    if (error instanceof createHttpError.HttpError) {
      throw error;
    }
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(getCategoryHandler);