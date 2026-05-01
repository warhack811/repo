import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StreamdownMessage } from './StreamdownMessage'

describe('StreamdownMessage math rendering', () => {
  it('renders inline and display math through KaTeX, including Turkish text around inline math', async () => {
    const { container } = render(
      <StreamdownMessage>
        {'Enerji formulu $E=mc^2$ olarak bilinir.\n\n$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$'}
      </StreamdownMessage>,
    )

    expect(screen.getByText(/Enerji formulu/)).toBeInTheDocument()

    await waitFor(() => {
      expect(container.querySelectorAll('.katex').length).toBeGreaterThan(0)
    })
  })
})
