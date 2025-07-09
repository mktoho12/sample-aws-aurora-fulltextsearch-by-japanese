#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SampleAwsAuroraFulltextsearchByJapaneseStack } from '../lib/sample-aws-aurora-fulltextsearch-by-japanese-stack';
import { SampleAwsAuroraFulltextsearchByJapaneseStackDev } from '../lib/sample-aws-aurora-fulltextsearch-by-japanese-stack-dev';

const app = new cdk.App();

// 環境設定
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '655840553349',
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

// 環境変数またはコンテキストから環境を取得
const deployEnv = app.node.tryGetContext('env') || process.env.DEPLOY_ENV || 'dev';

if (deployEnv === 'prod') {
  // 本番環境スタック
  new SampleAwsAuroraFulltextsearchByJapaneseStack(app, 'JapaneseFulltextSearchStack-Prod', {
    env,
    description: 'Production: Japanese fulltext search with Aurora PostgreSQL and Lambda',
  });
  cdk.Tags.of(app).add('Environment', 'Production');
} else {
  // 開発環境スタック（コスト最適化版）
  new SampleAwsAuroraFulltextsearchByJapaneseStackDev(app, 'JapaneseFulltextSearchStack-Dev', {
    env,
    description: 'Development: Japanese fulltext search with Aurora PostgreSQL and Lambda',
  });
  cdk.Tags.of(app).add('Environment', 'Development');
}

cdk.Tags.of(app).add('Project', 'JapaneseFulltextSearch');