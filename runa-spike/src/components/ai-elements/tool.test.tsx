import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ToolInput } from './tool'

describe('ToolInput', () => {
  it('renders a skeleton instead of crashing while input is unavailable', () => {
    render(<ToolInput state="input-streaming" />)

    expect(screen.getByText('Parameters')).toBeInTheDocument()
  })
})
