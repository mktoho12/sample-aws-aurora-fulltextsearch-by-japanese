import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as listModule from '../../src/handlers/categories/list';
import * as createModule from '../../src/handlers/categories/create';
import * as getModule from '../../src/handlers/categories/get';
import * as updateModule from '../../src/handlers/categories/update';
import * as deleteModule from '../../src/handlers/categories/delete';

const listCategories = listModule.handler;
const createCategory = createModule.handler;
const getCategory = getModule.handler;
const updateCategory = updateModule.handler;
const deleteCategory = deleteModule.handler;
import { Document } from '../../src/entities/Document';
import { Category } from '../../src/entities/Category';
import { createMockEvent, createMockContext, setupTestDatabase, cleanupTestDatabase } from '../utils/test-helpers';
import { HandlerContext } from '../../src/utils/middy';

describe('Category APIハンドラー', () => {
  let dataSource: DataSource;
  let categoryRepository: any;
  let documentRepository: any;
  let mockContext: HandlerContext;

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
  });

  describe('POST /categories', () => {
    it('カテゴリを作成できること', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          name: 'テストカテゴリ',
        }),
      });

      const response = await createCategory(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.name).toBe('テストカテゴリ');
      expect(body.id).toBeDefined();
    });

    it('必須項目が不足している場合は400エラーになること', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const response = await createCategory(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.message).toBe('name は必須項目です');
    });
  });

  describe('GET /categories', () => {
    beforeEach(async () => {
      // テストデータを作成
      await categoryRepository.save([
        { name: 'プログラミング' },
        { name: 'データベース' },
        { name: 'フロントエンド' },
      ]);
    });

    it('カテゴリ一覧を取得できること', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const response = await listCategories(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.categories).toHaveLength(3);
      expect(body.categories[0].name).toBeDefined();
    });
  });

  describe('GET /categories/:id', () => {
    let testCategory: Category;

    beforeEach(async () => {
      testCategory = await categoryRepository.save({
        name: 'テストカテゴリ',
      });
    });

    it('指定したカテゴリを取得できること', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: {
          id: testCategory.id.toString(),
        },
      });

      const response = await getCategory(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.id).toBe(testCategory.id);
      expect(body.name).toBe('テストカテゴリ');
    });

    it('存在しないIDの場合は404エラーになること', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: {
          id: '99999',
        },
      });

      const response = await getCategory(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(body.message).toBe('カテゴリが見つかりません');
    });
  });

  describe('PUT /categories/:id', () => {
    let testCategory: Category;

    beforeEach(async () => {
      testCategory = await categoryRepository.save({
        name: '更新前カテゴリ',
      });
    });

    it('カテゴリを更新できること', async () => {
      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: {
          id: testCategory.id.toString(),
        },
        body: JSON.stringify({
          name: '更新後カテゴリ',
        }),
      });

      const response = await updateCategory(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.name).toBe('更新後カテゴリ');
      expect(body.id).toBe(testCategory.id);
    });

    it.skip('カテゴリ名の更新で関連ドキュメントの検索ベクトルも更新されること', async () => {
      // 関連するドキュメントを作成
      const document = await documentRepository.save({
        name: 'テストドキュメント',
        title: 'テストタイトル',
        content: 'テストコンテンツ',
        category_id: testCategory.id,
      });

      // 初期化完了を待つ
      await new Promise(resolve => setTimeout(resolve, 200));

      // カテゴリ名を更新
      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: {
          id: testCategory.id.toString(),
        },
        body: JSON.stringify({
          name: '新しいカテゴリ名',
        }),
      });

      await updateCategory(event, mockContext);

      // 非同期処理の完了を待つ
      await new Promise(resolve => setTimeout(resolve, 500));

      // 新しいカテゴリ名で検索できることを確認
      const searchResult = await dataSource.query(
        `SELECT * FROM documents WHERE search_vector @@ to_tsquery('simple', $1)`,
        ['新しいカテゴリ名']
      );

      expect(searchResult).toHaveLength(1);
      expect(searchResult[0].id).toBe(document.id);
    });
  });

  describe('DELETE /categories/:id', () => {
    let testCategory: Category;

    beforeEach(async () => {
      testCategory = await categoryRepository.save({
        name: '削除対象カテゴリ',
      });
    });

    it('カテゴリを削除できること', async () => {
      const event = createMockEvent({
        httpMethod: 'DELETE',
        pathParameters: {
          id: testCategory.id.toString(),
        },
      });

      const response = await deleteCategory(event, mockContext);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('null');

      // 削除されたことを確認
      const deletedCategory = await categoryRepository.findOne({
        where: { id: testCategory.id },
      });
      expect(deletedCategory).toBeNull();
    });

    it('関連するドキュメントが存在する場合は削除できないこと', async () => {
      // 関連するドキュメントを作成
      await documentRepository.save({
        name: 'テストドキュメント',
        title: 'テストタイトル',
        content: 'テストコンテンツ',
        category_id: testCategory.id,
      });

      const event = createMockEvent({
        httpMethod: 'DELETE',
        pathParameters: {
          id: testCategory.id.toString(),
        },
      });

      const response = await deleteCategory(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.message).toBe('このカテゴリには関連するドキュメントがあるため削除できません');
    });

    it('存在しないIDの場合は404エラーになること', async () => {
      const event = createMockEvent({
        httpMethod: 'DELETE',
        pathParameters: {
          id: '99999',
        },
      });

      const response = await deleteCategory(event, mockContext);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(body.message).toBe('カテゴリが見つかりません');
    });
  });
});