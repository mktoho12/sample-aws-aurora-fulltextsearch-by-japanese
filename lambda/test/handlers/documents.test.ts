import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { handler as listOrSearchDocuments } from '../../src/handlers/documents/list-or-search';
import { handler as createDocument } from '../../src/handlers/documents/create';
import { handler as getDocument } from '../../src/handlers/documents/get';
import { handler as updateDocument } from '../../src/handlers/documents/update';
import { handler as deleteDocument } from '../../src/handlers/documents/delete';
import { Document } from '../../src/entities/Document';
import { Category } from '../../src/entities/Category';
import { createMockEvent, createMockContext, setupTestDatabase, cleanupTestDatabase } from '../utils/test-helpers';
import { HandlerContext } from '../../src/utils/middy';

describe('Document APIハンドラー', () => {
  let dataSource: DataSource;
  let categoryRepository: any;
  let documentRepository: any;
  let mockContext: HandlerContext;
  let testCategory: Category;

  beforeAll(async () => {
    dataSource = await setupTestDatabase();
    categoryRepository = dataSource.getRepository(Category);
    documentRepository = dataSource.getRepository(Document);
    
    // モックコンテキストを作成
    mockContext = {
      ...createMockContext(),
      dataSource,
    } as HandlerContext;
  });

  afterAll(async () => {
    await cleanupTestDatabase(dataSource);
  });

  beforeEach(async () => {
    // 各テスト前にデータをクリア
    await dataSource.query('TRUNCATE TABLE documents CASCADE');
    await dataSource.query('TRUNCATE TABLE categories CASCADE');
    
    // テスト用カテゴリを作成
    testCategory = await categoryRepository.save({
      name: 'テストカテゴリ',
    });
  });

  describe('POST /documents', () => {
    it('ドキュメントを作成できること', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          name: 'テストドキュメント',
          title: 'テストタイトル',
          content: 'テストコンテンツ',
          category_id: testCategory.id,
        }),
      });

      const response = await createDocument(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.name).toBe('テストドキュメント');
      expect(body.title).toBe('テストタイトル');
      expect(body.content).toBe('テストコンテンツ');
      expect(body.category.id).toBe(testCategory.id);
    });

    it('必須項目が不足している場合は400エラーになること', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          name: 'テストドキュメント',
          // titleとcontentが不足
        }),
      });

      const response = await createDocument(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.message).toBe('name, title, content は必須項目です');
    });
  });

  describe('GET /documents', () => {
    beforeEach(async () => {
      // テストデータを作成
      await documentRepository.save([
        {
          name: 'TypeScript入門',
          title: 'TypeScript基礎講座',
          content: 'TypeScriptの基本を学ぶ',
          category_id: testCategory.id,
        },
        {
          name: 'JavaScript高級編',
          title: 'JavaScript上級テクニック',
          content: 'JavaScriptの高度な使い方',
          category_id: testCategory.id,
        },
        {
          name: 'React実践',
          title: 'Reactアプリケーション開発',
          content: 'Reactでアプリを作る',
          category_id: testCategory.id,
        },
      ]);
    });

    it('ドキュメント一覧を取得できること', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const response = await listOrSearchDocuments(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.total).toBe(3);
      expect(body.limit).toBe(20);
      expect(body.offset).toBe(0);
      expect(body.documents).toHaveLength(3);
      expect(body.query).toBeUndefined();
    });

    it('limitとoffsetで件数を制御できること', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          limit: '2',
          offset: '1',
        },
      });

      const response = await listOrSearchDocuments(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.total).toBe(3);
      expect(body.limit).toBe(2);
      expect(body.offset).toBe(1);
      expect(body.documents).toHaveLength(2);
    });

    it('検索クエリでドキュメントを検索できること', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          q: 'TypeScript',
        },
      });

      const response = await listOrSearchDocuments(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.query).toBe('TypeScript');
      expect(body.total).toBe(1);
      expect(body.documents).toHaveLength(1);
      expect(body.documents[0].name).toBe('TypeScript入門');
    });

    it('カテゴリ名でも検索できること', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          q: 'テストカテゴリ',
        },
      });

      const response = await listOrSearchDocuments(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.query).toBe('テストカテゴリ');
      expect(body.total).toBe(3); // すべてのドキュメントが同じカテゴリ
    });
  });

  describe('GET /documents/:id', () => {
    let testDocument: Document;

    beforeEach(async () => {
      testDocument = await documentRepository.save({
        name: 'テストドキュメント',
        title: 'テストタイトル',
        content: 'テストコンテンツ',
        category_id: testCategory.id,
      });
    });

    it('指定したドキュメントを取得できること', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: {
          id: testDocument.id.toString(),
        },
      });

      const response = await getDocument(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.id).toBe(testDocument.id);
      expect(body.name).toBe('テストドキュメント');
      expect(body.category.id).toBe(testCategory.id);
    });

    it('存在しないIDの場合は404エラーになること', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: {
          id: '99999',
        },
      });

      const response = await getDocument(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(body.message).toBe('ドキュメントが見つかりません');
    });
  });

  describe('PUT /documents/:id', () => {
    let testDocument: Document;

    beforeEach(async () => {
      testDocument = await documentRepository.save({
        name: '更新前ドキュメント',
        title: '更新前タイトル',
        content: '更新前コンテンツ',
        category_id: testCategory.id,
      });
    });

    it('ドキュメントを更新できること', async () => {
      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: {
          id: testDocument.id.toString(),
        },
        body: JSON.stringify({
          name: '更新後ドキュメント',
          title: '更新後タイトル',
          content: '更新後コンテンツ',
        }),
      });

      const response = await updateDocument(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.name).toBe('更新後ドキュメント');
      expect(body.title).toBe('更新後タイトル');
      expect(body.content).toBe('更新後コンテンツ');
    });

    it('一部のフィールドのみ更新できること', async () => {
      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: {
          id: testDocument.id.toString(),
        },
        body: JSON.stringify({
          title: '新しいタイトルのみ',
        }),
      });

      const response = await updateDocument(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.name).toBe('更新前ドキュメント'); // 変更されない
      expect(body.title).toBe('新しいタイトルのみ'); // 変更される
      expect(body.content).toBe('更新前コンテンツ'); // 変更されない
    });
  });

  describe('DELETE /documents/:id', () => {
    let testDocument: Document;

    beforeEach(async () => {
      testDocument = await documentRepository.save({
        name: '削除対象ドキュメント',
        title: '削除対象タイトル',
        content: '削除対象コンテンツ',
        category_id: testCategory.id,
      });
    });

    it('ドキュメントを削除できること', async () => {
      const event = createMockEvent({
        httpMethod: 'DELETE',
        pathParameters: {
          id: testDocument.id.toString(),
        },
      });

      const response = await deleteDocument(event, mockContext);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('null');

      // 削除されたことを確認
      const deletedDoc = await documentRepository.findOne({
        where: { id: testDocument.id },
      });
      expect(deletedDoc).toBeNull();
    });

    it('存在しないIDの場合は404エラーになること', async () => {
      const event = createMockEvent({
        httpMethod: 'DELETE',
        pathParameters: {
          id: '99999',
        },
      });

      const response = await deleteDocument(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(body.message).toBe('ドキュメントが見つかりません');
    });
  });
});