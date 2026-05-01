import type { RawSearchResult, SearchOptions, SearchProvider } from './types'

const mockResults: RawSearchResult[] = [
  {
    url: 'https://github.com/vercel/ai',
    title: 'Vercel AI SDK',
    snippet: 'UIMessage streams, transports, and tool-call parts for AI apps.',
    publishedAt: null,
  },
  {
    url: 'https://en.wikipedia.org/wiki/Server-sent_events',
    title: 'Server-sent events',
    snippet: 'Browser event-stream protocol used for one-way streaming updates.',
    publishedAt: null,
  },
]

export class MockSerperProvider implements SearchProvider {
  async search(_q: string, opts: SearchOptions) {
    return mockResults.slice(0, opts.limit)
  }
}
