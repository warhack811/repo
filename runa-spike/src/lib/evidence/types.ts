export type EvidencePack = {
  query: string
  searches: number
  results: number
  truncated: boolean
  // Backend bu sözleşmeyi karşılamak zorunda. Değiştirmeden önce backend ekibiyle konuş.
  sources: EvidenceSource[]
}

export type EvidenceSource = {
  id: string
  url: string
  canonical_url: string
  title: string
  domain: string
  favicon: string
  published_at: string | null
  snippet: string
  trust_score: number
}
