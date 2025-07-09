# OpenAPI 仕様の管理

このディレクトリでは、APIのOpenAPI仕様を機能ごとに分割して管理しています。

## ディレクトリ構造

```
openapi/
├── openapi.yaml          # メインファイル（各ファイルを参照）
├── paths/               # エンドポイント定義
│   ├── documents.yaml
│   ├── documents-id.yaml
│   ├── documents-search.yaml
│   ├── categories.yaml
│   └── categories-id.yaml
├── schemas/             # データモデル定義
│   ├── document.yaml
│   ├── document-*.yaml
│   ├── category.yaml
│   └── category-*.yaml
└── responses/           # 共通レスポンス定義
    ├── bad-request.yaml
    ├── not-found.yaml
    └── internal-server-error.yaml
```

## 使い方

### 仕様の編集
各ファイルを直接編集してください。チームメンバーは自分の担当機能のファイルのみを編集すれば良いので、コンフリクトが起きにくくなります。

### 仕様の検証
```bash
npm run openapi:lint
```

### 仕様のプレビュー
```bash
npm run openapi:preview
```
ブラウザで http://localhost:8080 を開くと、ReDocでドキュメントを確認できます。

### 単一ファイルへの結合
デプロイ時やクライアントコード生成時に使用します：
```bash
npm run openapi:bundle
```
これにより `openapi-bundled.yaml` が生成されます。

### HTMLドキュメントの生成
静的なHTMLドキュメントを生成します：
```bash
npm run openapi:build-docs
```
これにより `openapi-docs.html` が生成されます。

### 結合とHTML生成を一度に実行
```bash
npm run openapi:build-all
```

## 新しいエンドポイントの追加

1. `paths/` に新しいファイルを作成
2. `openapi.yaml` に参照を追加
3. 必要に応じて `schemas/` に新しいスキーマを追加

## メリット

- **並行作業が容易**: 各メンバーが異なるファイルを編集
- **レビューが簡単**: 変更箇所が明確
- **再利用性**: 共通のスキーマやレスポンスを参照
- **保守性**: 機能ごとにファイルが分かれているため見通しが良い