import * as kuromoji from 'kuromoji';
import * as path from 'path';

let tokenizerInstance: any = null;
let initializePromise: Promise<any> | null = null;

export async function getTokenizer(): Promise<any> {
  if (tokenizerInstance) {
    return tokenizerInstance;
  }

  if (!initializePromise) {
    initializePromise = new Promise((resolve, reject) => {
      const dicPath = path.resolve(__dirname, '../../node_modules/kuromoji/dict');
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) {
          reject(err);
          return;
        }
        tokenizerInstance = tokenizer;
        resolve(tokenizer);
      });
    });
  }

  return initializePromise;
}

export function tokenizeText(tokenizer: any, text: string): string[] {
  const tokens = tokenizer.tokenize(text);
  return tokens
    .filter((token: any) => {
      // 助詞、記号、助動詞、接続詞を除外
      return !['助詞', '記号', '助動詞', '接続詞'].includes(token.pos);
    })
    .map((token: any) => token.surface_form.toLowerCase()); // 小文字に統一
}