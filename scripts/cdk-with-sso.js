#!/usr/bin/env node

const { execSync } = require('child_process');
const { spawn } = require('child_process');

async function main() {
  try {
    // AWS SSOにログインしているか確認
    try {
      execSync('aws sts get-caller-identity --profile default', { stdio: 'ignore' });
    } catch (error) {
      console.log('AWS SSOにログインしていません。ログインしています...');
      execSync('aws sso login --profile default', { stdio: 'inherit' });
    }

    // 認証情報をエクスポート
    let credsJson;
    try {
      credsJson = execSync('aws configure export-credentials --profile default', { encoding: 'utf8' });
    } catch (error) {
      console.error('認証情報の取得に失敗しました:', error.message);
      process.exit(1);
    }

    const creds = JSON.parse(credsJson);

    // 環境変数をセット
    const env = {
      ...process.env,
      AWS_ACCESS_KEY_ID: creds.AccessKeyId,
      AWS_SECRET_ACCESS_KEY: creds.SecretAccessKey,
      AWS_SESSION_TOKEN: creds.SessionToken,
      AWS_REGION: 'ap-northeast-1'
    };

    // CDKコマンドを実行
    const args = process.argv.slice(2);
    const cdkProcess = spawn('npx', ['cdk', ...args], {
      env,
      stdio: 'inherit'
    });

    cdkProcess.on('exit', (code) => {
      process.exit(code);
    });

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();