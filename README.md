# AWS Aurora PostgreSQL 日本語全文検索サンプル

AWS Aurora PostgreSQLで日本語全文検索を実装するサンプルプロジェクトです。

## 機能

- Aurora PostgreSQLでの日本語全文検索
- TypeORMを使用したデータベース操作
- API Gateway + Lambda による REST API
- 開発環境と本番環境の分離

## デプロイ

### AWS SSOを使用している場合

AWS SSOでログインしている場合は、付属のスクリプトを使用してください：

```bash
# AWS SSOでログイン
aws sso login --profile your-profile

# デプロイ（SSOの認証情報を自動的にエクスポート）
./scripts/cdk-sso deploy --require-approval never

# その他のCDKコマンドも同様に使用可能
./scripts/cdk-sso diff
./scripts/cdk-sso destroy
```

### 通常のAWS認証の場合

```bash
npx cdk deploy --require-approval never
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
