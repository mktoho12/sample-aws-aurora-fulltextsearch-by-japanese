import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFullTextSearch1752025818583 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // tsvector カラムを追加
        await queryRunner.query(`ALTER TABLE "documents" ADD COLUMN "search_vector" tsvector`);
        
        // GIN インデックスを作成
        await queryRunner.query(`CREATE INDEX "idx_documents_search_vector" ON "documents" USING GIN("search_vector")`);
        
        // 既存データの search_vector を更新（日本語対応）
        await queryRunner.query(`
            UPDATE "documents" 
            SET "search_vector" = to_tsvector('simple', "title" || ' ' || "content")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // インデックスを削除
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_documents_search_vector"`);
        
        // カラムを削除
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "search_vector"`);
    }

}
