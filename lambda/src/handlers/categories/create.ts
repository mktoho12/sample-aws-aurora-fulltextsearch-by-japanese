import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Category } from '../../entities/Category';
import createHttpError from 'http-errors';

const createCategoryHandler = async (
  event: APIGatewayProxyEvent,
  context: HandlerContext
): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body as any;
    
    if (!body.name) {
      throw createHttpError(400, 'name は必須項目です');
    }

    const categoryRepository = context.dataSource.getRepository(Category);
    
    const category = categoryRepository.create({
      name: body.name,
    });

    const savedCategory = await categoryRepository.save(category);

    return createResponse(201, savedCategory);
  } catch (error) {
    console.error('Create category error:', error);
    if (error instanceof createHttpError.HttpError) {
      throw error;
    }
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(createCategoryHandler);