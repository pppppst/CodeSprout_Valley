import { describe, expect, it } from 'vitest'
import { getActiveJieQi } from '../calendar'

describe('getActiveJieQi', () => {
  it('returns the correct solar term on a JieQi day', () => {
    const term = getActiveJieQi(2024, 2, 4)
    expect(term).toBe('立春')
  })

  it('falls back to the most recent JieQi when not on a JieQi day', () => {
    const term = getActiveJieQi(2024, 2, 5)
    expect(term).toBe('立春')
  })

  it('always returns a non-empty string', () => {
    const term = getActiveJieQi(2024, 6, 18)
    expect(typeof term).toBe('string')
    expect(term.length).toBeGreaterThan(0)
  })
})
