import { getTokenizer, tokenizeText } from './tokenizer';

export async function buildSearchQuery(searchText: string): Promise<string> {
  const tokenizer = await getTokenizer();
  const words = tokenizeText(tokenizer, searchText);
  
  // 各単語をAND検索できるように結合
  return words.join(' & ');
}

export async function searchDocuments(
  queryRunner: any,
  searchText: string
): Promise<any[]> {
  const searchQuery = await buildSearchQuery(searchText);
  
  return queryRunner.query(
    `SELECT * FROM documents WHERE search_vector @@ to_tsquery('simple', $1)`,
    [searchQuery]
  );
}