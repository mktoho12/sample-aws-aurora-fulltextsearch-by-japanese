import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Document } from '../../src/entities/Document';
import { Category } from '../../src/entities/Category';
import { DocumentSubscriber } from '../../src/subscribers/DocumentSubscriber';
import { CategorySubscriber } from '../../src/subscribers/CategorySubscriber';
import { searchDocuments } from '../../src/utils/search';

describe('DocumentSubscriber', () => {
  let dataSource: DataSource;
  let categoryRepository: any;
  let documentRepository: any;
  let adminDataSource: DataSource;

  beforeAll(async () => {
    // 管理用接続でtest_dbを作成
    adminDataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'postgres', // デフォルトのpostgresデータベースに接続
    });
    
    await adminDataSource.initialize();
    
    // test_dbが存在する場合は削除
    await adminDataSource.query(`DROP DATABASE IF EXISTS test_db`);
    // test_dbを作成
    await adminDataSource.query(`CREATE DATABASE test_db`);
    
    await adminDataSource.destroy();

    // テスト用のデータベース設定
    dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'test_db',
      synchronize: true,
      dropSchema: true,
      entities: [Document, Category],
      subscribers: [DocumentSubscriber, CategorySubscriber],
      logging: false,
    });

    await dataSource.initialize();
    categoryRepository = dataSource.getRepository(Category);
    documentRepository = dataSource.getRepository(Document);
  });

  afterAll(async () => {
    await dataSource.destroy();
    
    // テスト終了後にtest_dbを削除
    adminDataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'postgres',
    });
    
    await adminDataSource.initialize();
    await adminDataSource.query(`DROP DATABASE IF EXISTS test_db`);
    await adminDataSource.destroy();
  });

  beforeEach(async () => {
    // 各テスト前にデータをクリア
    await documentRepository.query('TRUNCATE TABLE documents CASCADE');
    await categoryRepository.query('TRUNCATE TABLE categories CASCADE');
  });

  describe('挿入時の処理', () => {
    it('全フィールドを含むsearch_vectorが生成されること', async () => {
      // カテゴリを作成
      const category = await categoryRepository.save({
        name: 'プログラミング',
      });

      // ドキュメントを作成
      const document = await documentRepository.save({
        name: 'TypeScript入門',
        title: '初心者向けTypeScript講座',
        content: 'TypeScriptの基本的な使い方を学びましょう',
        category_id: category.id,
      });

      // search_vectorが生成されているか確認
      const result = await dataSource.query(
        'SELECT id, name, title, content, search_vector::text FROM documents WHERE id = $1',
        [document.id]
      );

      expect(result[0].search_vector).toBeDefined();
      expect(result[0].search_vector).not.toBeNull();

      // search_vectorに全フィールドが含まれているか確認
      const searchResult = await searchDocuments(dataSource, 'TypeScript');
      expect(searchResult.length).toBe(1);

      // カテゴリ名でも検索できるか確認
      const categorySearchResult = await searchDocuments(dataSource, 'プログラミング');
      expect(categorySearchResult.length).toBe(1);
    });

    it('カテゴリなしでも正常に処理されること', async () => {
      // カテゴリなしでドキュメントを作成
      const document = await documentRepository.save({
        name: 'JavaScript基礎',
        title: 'JavaScriptの基本',
        content: 'JavaScriptの基礎知識',
        category_id: null,
      });

      // search_vectorが生成されているか確認
      const result = await dataSource.query(
        'SELECT search_vector FROM documents WHERE id = $1',
        [document.id]
      );

      expect(result[0].search_vector).toBeDefined();
      expect(result[0].search_vector).not.toBeNull();
    });
  });

  describe('更新時の処理', () => {
    it('ドキュメント更新時にsearch_vectorが更新されること', async () => {
      // カテゴリを作成
      const category = await categoryRepository.save({
        name: 'Web開発',
      });

      // ドキュメントを作成
      const document = await documentRepository.save({
        name: 'React入門',
        title: 'Reactの基本',
        content: 'Reactコンポーネントの作り方',
        category_id: category.id,
      });

      // ドキュメントを更新
      document.title = 'React Hooks完全ガイド';
      document.content = 'useStateやuseEffectの使い方を詳しく解説';
      await documentRepository.save(document);

      // 新しい内容で検索できるか確認
      const searchResult = await searchDocuments(dataSource, 'Hooks');
      expect(searchResult.length).toBe(1);

      // 古い内容でも検索できるか確認（titleは更新されたので検索されない）
      const oldSearchResult = await searchDocuments(dataSource, '基本');
      expect(oldSearchResult.length).toBe(0);
    });

    it('カテゴリ変更時にsearch_vectorが更新されること', async () => {
      // カテゴリを作成
      const category1 = await categoryRepository.save({
        name: 'フロントエンド',
      });
      const category2 = await categoryRepository.save({
        name: 'バックエンド',
      });

      // ドキュメントを作成
      const document = await documentRepository.save({
        name: 'Node.js',
        title: 'Node.js入門',
        content: 'サーバーサイドJavaScript',
        category_id: category1.id,
      });

      // カテゴリを変更
      document.category_id = category2.id;
      await documentRepository.save(document);

      // 新しいカテゴリ名で検索できるか確認
      const searchResult = await searchDocuments(dataSource, 'バックエンド');
      expect(searchResult.length).toBe(1);

      // 古いカテゴリ名では検索されないか確認
      const oldSearchResult = await searchDocuments(dataSource, 'フロントエンド');
      expect(oldSearchResult.length).toBe(0);
    });
  });

  describe('検索機能', () => {
    it('複数フィールドを横断して検索できること', async () => {
      // カテゴリを作成
      const category = await categoryRepository.save({
        name: 'データベース',
      });

      // 複数のドキュメントを作成
      await documentRepository.save([
        {
          name: 'PostgreSQL',
          title: 'PostgreSQL入門',
          content: 'リレーショナルデータベースの基礎',
          category_id: category.id,
        },
        {
          name: 'MongoDB',
          title: 'NoSQLデータベース',
          content: 'MongoDBの使い方',
          category_id: category.id,
        },
        {
          name: 'Redis',
          title: 'キャッシュサーバー',
          content: 'Redisによる高速化',
          category_id: category.id,
        },
      ]);

      // カテゴリ名で検索
      const categorySearch = await searchDocuments(dataSource, 'データベース');
      expect(categorySearch.length).toBe(3);

      // 特定のドキュメント名で検索
      const nameSearch = await searchDocuments(dataSource, 'PostgreSQL');
      expect(nameSearch.length).toBe(1);

      // コンテンツ内の単語で検索
      const contentSearch = await searchDocuments(dataSource, '高速化');
      expect(contentSearch.length).toBe(1);
    });
  });
});