import type { EvidencePack } from './types'

export const evidencePack: EvidencePack = {
  query: 'AI UI streaming markdown components',
  searches: 4,
  results: 17,
  truncated: false,
  sources: [
    {
      id: '1',
      url: 'https://techcrunch.com/2026/01/15/ai-agents-ui-patterns/',
      canonical_url: 'https://techcrunch.com/2026/01/15/ai-agents-ui-patterns/',
      title: 'AI agent interfaces start converging on streaming work surfaces',
      domain: 'techcrunch.com',
      favicon: 'https://www.google.com/s2/favicons?domain=techcrunch.com&sz=64',
      published_at: '2026-01-15',
      snippet:
        'Streaming assistant interfaces increasingly combine citations, tool states, and markdown rendering.',
      trust_score: 0.74,
    },
    {
      id: '2',
      url: 'https://en.wikipedia.org/wiki/Server-sent_events',
      canonical_url: 'https://en.wikipedia.org/wiki/Server-sent_events',
      title: 'Server-sent events',
      domain: 'wikipedia.org',
      favicon: 'https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64',
      published_at: null,
      snippet:
        'SSE is a browser event stream format commonly used for one-way streaming updates.',
      trust_score: 0.82,
    },
    {
      id: '3',
      url: 'https://github.com/vercel/ai',
      canonical_url: 'https://github.com/vercel/ai',
      title: 'vercel/ai',
      domain: 'github.com',
      favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
      published_at: null,
      snippet:
        'The AI SDK repository contains the UIMessage stream helpers used by the mock backend.',
      trust_score: 0.92,
    },
    {
      id: '4',
      url: 'https://news.ycombinator.com/item?id=41234567',
      canonical_url: 'https://news.ycombinator.com/item?id=41234567',
      title: 'Discussion: Streaming UI state for agents',
      domain: 'news.ycombinator.com',
      favicon:
        'https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=64',
      published_at: '2026-02-03',
      snippet:
        'Practitioners compare markdown flicker, citations, and tool call UX in long agent threads.',
      trust_score: 0.61,
    },
  ],
}
