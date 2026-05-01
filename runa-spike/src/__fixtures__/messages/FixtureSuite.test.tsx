import { render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StreamdownMessage } from '@/lib/streamdown/StreamdownMessage'
import { messageFixtures } from './message-fixtures'

describe('message fixture suite', () => {
  it.each(messageFixtures)('renders $id without throwing', async (fixture) => {
    const { container } = render(<StreamdownMessage>{fixture.content}</StreamdownMessage>)

    await waitFor(() => {
      expect(container.textContent?.length ?? 0).toBeGreaterThan(0)
    })
  })

  it('keeps unsafe raw HTML inert', () => {
    const { container } = render(
      <StreamdownMessage>{'<script>alert(1)</script><img src=x onerror=alert(1)>'}</StreamdownMessage>,
    )

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})
