# AWS SSO + CDK 自動認証スクリプト

このプロジェクトでは、AWS SSOを使用している場合のCDK実行を簡単にするためのスクリプトを用意しています。

## 問題

CDKはAWS SSOの認証情報を直接読み取れないため、`aws configure export-credentials`で一時的な認証情報を取得し、環境変数として設定する必要があります。

## 解決方法

### 方法1: Fishシェル関数を使う

Fishシェルを使用している場合は、以下のコマンドでセットアップできます：

```fish
# Fish設定ファイルに追加
echo "source (pwd)/cdk-with-sso.fish" >> ~/.config/fish/config.fish

# 設定を再読み込み
source ~/.config/fish/config.fish
```

その後、通常通りcdkコマンドを使用できます：

```fish
cdk deploy
cdk diff
cdk destroy
```

### 方法2: npm scriptsを使う

どのシェルでも使える方法です：

```bash
# デプロイ
npm run cdk:deploy

# 差分確認
npm run cdk:diff

# 削除
npm run cdk:destroy

# 合成
npm run cdk:synth
```

追加の引数も渡せます：

```bash
npm run cdk:deploy -- --all
npm run cdk:deploy -- MyStack
```

### 方法3: 直接Node.jsスクリプトを実行

```bash
node scripts/cdk-with-sso.js deploy
node scripts/cdk-with-sso.js diff
```

## 仕組み

1. AWS SSOにログインしているか確認
2. ログインしていない場合は自動的にログイン
3. `aws configure export-credentials`で一時認証情報を取得
4. 環境変数として設定してCDKコマンドを実行

これにより、セッションが切れていても自動的に再ログインして実行できます。