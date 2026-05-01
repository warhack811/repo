export type SearchOptions = {
  limit: number
  timeoutMs?: number
}

export type RawSearchResult = {
  url: string
  title: string
  snippet: string
  publishedAt: string | null
}

export interface SearchProvider {
  search(q: string, opts: SearchOptions): Promise<RawSearchResult[]>
}
