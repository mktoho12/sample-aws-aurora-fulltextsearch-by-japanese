# セキュリティガイドライン

## 重要な注意事項

### 🚨 絶対にコミットしてはいけないもの

1. **AWSアクセスキー・シークレットキー**
   - `aws_access_key_id`
   - `aws_secret_access_key`
   - `aws_session_token`

2. **AWSアカウントID**
   - 本番環境のアカウントID
   - 個人のアカウントID

3. **その他の認証情報**
   - データベースのパスワード
   - APIキー
   - 秘密鍵

## 推奨される認証方法

### 1. AWS SSO（推奨）
```bash
aws sso login --profile your-profile
```

### 2. IAMロール（EC2/Lambda等）
インスタンスプロファイルやサービスロールを使用

### 3. 環境変数の使用
```bash
# .envファイルを作成（.gitignoreに含まれていることを確認）
cp .env.example .env
# 実際の値を設定
```

## セキュリティチェックリスト

- [ ] `.gitignore`に認証情報ファイルが含まれているか確認
- [ ] `git add`前に`git status`で確認
- [ ] アカウントIDやキーをハードコーディングしていないか確認
- [ ] 定期的に`git log`で過去のコミットを確認

## もし誤ってコミットしてしまったら

1. **即座にAWSコンソールでキーを無効化**
2. **新しいキーを生成**
3. **GitHubの場合はサポートに連絡**
4. **git-filter-branchやBFG Repo-Cleanerで履歴から削除**

```bash
# 例: BFG Repo-Cleanerを使用
bfg --delete-files config.js
git push --force
```

## AWS設定ファイルのベストプラクティス

~/.aws/configには認証情報を含めず、~/.aws/credentialsまたはSSO設定のみを使用してください。

```ini
# ~/.aws/config の良い例
[profile myprofile]
sso_start_url = https://myorg.awsapps.com/start
sso_region = us-east-1
sso_account_id = 123456789012
sso_role_name = MyRole
region = ap-northeast-1
```