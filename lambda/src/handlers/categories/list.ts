import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Category } from '../../entities/Category';
import createHttpError from 'http-errors';

const listCategoriesHandler = async (
  event: APIGatewayProxyEvent,
  context: HandlerContext
): Promise<APIGatewayProxyResult> => {
  try {
    const categoryRepository = context.dataSource.getRepository(Category);
    
    const categories = await categoryRepository.find({
      order: {
        name: 'ASC',
      },
    });

    return createResponse(200, {
      categories,
    });
  } catch (error) {
    console.error('List categories error:', error);
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(listCategoriesHandler);