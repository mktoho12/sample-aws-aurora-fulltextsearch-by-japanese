import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Category } from '../../entities/Category';
import createHttpError from 'http-errors';

const updateCategoryHandler = async (
  event: APIGatewayProxyEvent,
  context: HandlerContext
): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id;
    const body = event.body as any;
    
    if (!id) {
      throw createHttpError(400, 'IDが必要です');
    }

    if (!body.name) {
      throw createHttpError(400, 'name は必須項目です');
    }

    const categoryRepository = context.dataSource.getRepository(Category);
    
    const category = await categoryRepository.findOne({
      where: { id: parseInt(id) },
    });

    if (!category) {
      throw createHttpError(404, 'カテゴリが見つかりません');
    }

    category.name = body.name;

    const updatedCategory = await categoryRepository.save(category);

    return createResponse(200, updatedCategory);
  } catch (error) {
    console.error('Update category error:', error);
    if (error instanceof createHttpError.HttpError) {
      throw error;
    }
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(updateCategoryHandler);