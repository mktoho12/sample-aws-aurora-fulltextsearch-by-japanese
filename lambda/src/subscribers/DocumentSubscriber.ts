import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { Document } from '../entities/Document';
import { Category } from '../entities/Category';
import { getTokenizer, tokenizeText } from '../utils/tokenizer';

@EventSubscriber()
export class DocumentSubscriber implements EntitySubscriberInterface<Document> {
  listenTo() {
    return Document;
  }

  async afterInsert(event: InsertEvent<Document>): Promise<void> {
    await this.updateSearchVector(event);
  }

  async afterUpdate(event: UpdateEvent<Document>): Promise<void> {
    await this.updateSearchVector(event);
  }

  private async updateSearchVector(
    event: InsertEvent<Document> | UpdateEvent<Document>
  ): Promise<void> {
    if (!event.entity || !event.entity.id) {
      return;
    }

    try {
      const tokenizer = await getTokenizer();
      const { id, name, title, content, category_id } = event.entity;
      
      // カテゴリ名を取得
      let categoryName = '';
      if (category_id) {
        const category = await event.manager.findOne(Category, {
          where: { id: category_id }
        });
        if (category) {
          categoryName = category.name;
        }
      }

      // すべてのフィールドを結合
      const searchText = [name, title, content, categoryName]
        .filter(text => text) // null/undefinedを除外
        .join(' ');

      // 形態素解析してトークンを抽出
      if (searchText) {
        const words = tokenizeText(tokenizer, searchText);

        // 重複を除去してスペース区切りのテキストに
        const uniqueWords = [...new Set(words)].join(' ');

        // search_vectorを直接更新
        await event.manager.query(
          `UPDATE documents SET search_vector = to_tsvector('simple', $1) WHERE id = $2`,
          [uniqueWords, id]
        );
      }
    } catch (error) {
      console.error('Failed to update search vector:', error);
    }
  }
}