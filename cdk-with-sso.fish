#!/usr/bin/env fish

# AWS SSOの認証情報をエクスポートしてCDKコマンドを実行する関数
function cdk-with-sso
    # AWS SSOにログインしているか確認
    aws sts get-caller-identity --profile default >/dev/null 2>&1
    if test $status -ne 0
        echo "AWS SSOにログインしていません。ログインしています..."
        aws sso login --profile default
    end

    # 認証情報をエクスポート
    set -l creds (aws configure export-credentials --profile default)
    
    if test $status -ne 0
        echo "認証情報の取得に失敗しました"
        return 1
    end

    # JSONから値を抽出
    set -l access_key (echo $creds | jq -r '.AccessKeyId')
    set -l secret_key (echo $creds | jq -r '.SecretAccessKey')
    set -l session_token (echo $creds | jq -r '.SessionToken')

    # 環境変数をセットしてCDKコマンドを実行
    env AWS_ACCESS_KEY_ID="$access_key" \
        AWS_SECRET_ACCESS_KEY="$secret_key" \
        AWS_SESSION_TOKEN="$session_token" \
        AWS_REGION="ap-northeast-1" \
        npx cdk $argv
end

# エイリアスを作成
alias cdk="cdk-with-sso"