import { describe, expect, it } from 'vitest'
import { bubbleMessages } from '../bubbleMessages'

describe('bubbleMessages', () => {
  it('exposes a non-empty list', () => {
    expect(Array.isArray(bubbleMessages)).toBe(true)
    expect(bubbleMessages.length).toBeGreaterThan(0)
  })

  it('contains readable string entries', () => {
    bubbleMessages.forEach((message) => {
      expect(typeof message).toBe('string')
      expect(message.trim().length).toBeGreaterThan(0)
    })
  })

  it('includes a few well-known messages', () => {
    expect(bubbleMessages).toContain('🐛 捉到一个bug！')
    expect(bubbleMessages).toContain('✅ 测试全部通过！')
    expect(bubbleMessages).toContain('🚀 部署到生产环境！')
  })
})
