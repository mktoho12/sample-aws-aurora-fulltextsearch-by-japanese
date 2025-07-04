import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as kuromoji from 'kuromoji';
import TinySegmenter from 'tiny-segmenter';

// Secrets Managerクライアント
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

// データベース接続情報を取得
async function getDatabaseCredentials() {
  const command = new GetSecretValueCommand({
    SecretId: process.env.DB_SECRET_ARN,
  });
  
  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString!);
}

// kuromojiの初期化（グローバルに保持してコールドスタートを軽減）
let tokenizer: any = null;

async function initializeKuromoji(): Promise<void> {
  if (tokenizer) return;
  
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: '/opt/nodejs/dict' }).build((err: Error | null, _tokenizer: any) => {
      if (err) {
        console.error('Kuromoji initialization failed:', err);
        reject(err);
      } else {
        tokenizer = _tokenizer;
        resolve();
      }
    });
  });
}

// TinySegmenterのインスタンス
const tinySegmenter = new (TinySegmenter as any)();

// テキストを形態素解析して単語に分解
async function analyzeText(text: string, method: 'kuromoji' | 'tiny-segmenter' = 'kuromoji'): Promise<string[]> {
  if (method === 'kuromoji') {
    await initializeKuromoji();
    const tokens = tokenizer.tokenize(text);
    // 名詞、動詞、形容詞を抽出
    return tokens
      .filter((token: any) => 
        token.pos === '名詞' || 
        token.pos === '動詞' || 
        token.pos === '形容詞'
      )
      .map((token: any) => token.surface_form);
  } else {
    // TinySegmenterを使用
    return tinySegmenter.segment(text);
  }
}

// tsvectorフォーマットに変換
function toTsVector(words: string[]): string {
  // 重複を除去してスペース区切りで結合
  const uniqueWords = [...new Set(words)];
  return uniqueWords.join(' ');
}

// データベース接続
async function connectToDatabase(): Promise<Client> {
  const credentials = await getDatabaseCredentials();
  
  const client = new Client({
    host: process.env.DB_PROXY_ENDPOINT,
    port: 5432,
    database: 'fulltextsearch',
    user: credentials.username,
    password: credentials.password,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  
  await client.connect();
  return client;
}

// Lambda ハンドラー
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path;
  const body = JSON.parse(event.body || '{}');
  
  try {
    if (path === '/analyze') {
      // テキスト解析エンドポイント
      const { text, method = 'kuromoji' } = body;
      
      if (!text) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Text is required' }),
        };
      }
      
      const words = await analyzeText(text, method);
      const tsVector = toTsVector(words);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          original: text,
          words,
          tsVector,
          method,
        }),
      };
      
    } else if (path === '/search') {
      // 検索エンドポイント
      const { query, method = 'kuromoji' } = body;
      
      if (!query) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Query is required' }),
        };
      }
      
      // クエリを解析
      const queryWords = await analyzeText(query, method);
      const tsQuery = queryWords.join(' & ');
      
      // データベースで検索
      const client = await connectToDatabase();
      
      try {
        // サンプルクエリ（実際のテーブル構造に合わせて調整が必要）
        const result = await client.query(`
          SELECT 
            id,
            name,
            description,
            ts_rank(search_vector, to_tsquery('simple', $1)) as rank
          FROM teams
          WHERE search_vector @@ to_tsquery('simple', $1)
          ORDER BY rank DESC
          LIMIT 10
        `, [tsQuery]);
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            query,
            queryWords,
            tsQuery,
            results: result.rows,
            count: result.rowCount,
          }),
        };
        
      } finally {
        await client.end();
      }
    }
    
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' }),
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};