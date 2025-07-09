import {
  EventSubscriber,
  EntitySubscriberInterface,
  UpdateEvent,
} from 'typeorm';
import { Category } from '../entities/Category';
import { Document } from '../entities/Document';
import { getTokenizer, tokenizeText } from '../utils/tokenizer';

@EventSubscriber()
export class CategorySubscriber implements EntitySubscriberInterface<Category> {
  listenTo() {
    return Category;
  }

  async afterUpdate(event: UpdateEvent<Category>): Promise<void> {
    if (!event.entity || !event.entity.id) {
      return;
    }

    // カテゴリ名が変更された場合、関連するドキュメントのsearch_vectorを更新
    const databaseEntity = await event.manager.findOne(Category, {
      where: { id: event.entity.id },
      relations: ['documents'],
    });

    if (databaseEntity && databaseEntity.documents) {
      const tokenizer = await getTokenizer();

      for (const document of databaseEntity.documents) {
        // すべてのフィールドを結合
        const searchText = [
          document.name,
          document.title,
          document.content,
          databaseEntity.name, // 新しいカテゴリ名
        ]
          .filter(text => text)
          .join(' ');

        if (searchText) {
          const words = tokenizeText(tokenizer, searchText);
          const uniqueWords = [...new Set(words)].join(' ');

          // search_vectorを更新
          await event.manager.query(
            `UPDATE documents SET search_vector = to_tsvector('simple', $1) WHERE id = $2`,
            [uniqueWords, document.id]
          );
        }
      }
    }
  }
}