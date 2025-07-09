import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHandler, createResponse, HandlerContext } from '../../utils/middy';
import { Category } from '../../entities/Category';
import createHttpError from 'http-errors';

const deleteCategoryHandler = async (
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

    // 関連するドキュメントがある場合はエラー
    if (category.documents && category.documents.length > 0) {
      throw createHttpError(400, 'このカテゴリには関連するドキュメントがあるため削除できません');
    }

    await categoryRepository.remove(category);

    return createResponse(204, null);
  } catch (error) {
    console.error('Delete category error:', error);
    if (error instanceof createHttpError.HttpError) {
      throw error;
    }
    throw createHttpError(500, 'Internal server error');
  }
};

export const handler = createHandler(deleteCategoryHandler);