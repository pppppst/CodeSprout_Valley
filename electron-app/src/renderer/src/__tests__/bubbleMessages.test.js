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
    expect(bubbleMessages).toContain('🍃 报错只是善意的提醒，不是对你的否定')
    expect(bubbleMessages).toContain('✨ 保持手感，你敲下的每一个字符都算数')
    expect(bubbleMessages).toContain('🚀 去创造吧，用代码在这个数字世界里盖楼')
  })
})
