import { describe, expect, it } from 'vitest'
import { classifyTransportError } from './error-catalog'

describe('classifyTransportError', () => {
  it('maps terminated streams to the network-cut retry state', () => {
    expect(classifyTransportError(new Error('terminated')).kind).toBe('network-cut')
  })
})
