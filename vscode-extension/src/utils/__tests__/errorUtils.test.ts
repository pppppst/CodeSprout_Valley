import { describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => ({
  DiagnosticSeverity: { Error: 0 }
}))

import { getErrorKey, isErrorSeverity } from '../errorUtils'

describe('errorUtils', () => {
  it('builds a stable diagnostic key', () => {
    const diagnostic = {
      source: 'eslint',
      code: 'no-undef',
      message: 'x is not defined',
      range: { start: { line: 1, character: 2 } },
      severity: 0
    } as any

    expect(getErrorKey(diagnostic)).toBe('eslint:no-undef:x is not defined:1:2')
  })

  it('uses fallback values when source or code are missing', () => {
    const diagnostic = {
      message: 'oops',
      range: { start: { line: 3, character: 4 } },
      severity: 1
    } as any

    expect(getErrorKey(diagnostic)).toBe('unknown:no-code:oops:3:4')
  })

  it('detects error severity', () => {
    const errorDiagnostic = { severity: 0 } as any
    const warningDiagnostic = { severity: 1 } as any

    expect(isErrorSeverity(errorDiagnostic)).toBe(true)
    expect(isErrorSeverity(warningDiagnostic)).toBe(false)
  })
})
