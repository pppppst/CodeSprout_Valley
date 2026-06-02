import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  API_BASE,
  fetchAdminUsers,
  fetchCloudSave,
  fetchHistoryReports,
  fetchTermStats,
  loginAccount,
  registerAccount,
  saveTermReport,
  syncCloudSave,
  updateUserProfile,
  uploadTermDailyStat
} from '../cloudApi'

const originalFetch = globalThis.fetch

function mockFetchResponse({ ok = true, status = 200, jsonData = {} } = {}) {
  globalThis.fetch.mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(jsonData)
  })
}

function mockFetchJsonFailure({ ok = true, status = 200 } = {}) {
  globalThis.fetch.mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockRejectedValue(new Error('invalid json'))
  })
}

beforeEach(() => {
  globalThis.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  if (originalFetch) {
    globalThis.fetch = originalFetch
  } else {
    delete globalThis.fetch
  }
})

describe('cloudApi helpers', () => {
  it('exposes a usable API base', () => {
    expect(typeof API_BASE).toBe('string')
    expect(API_BASE.length).toBeGreaterThan(0)
  })

  it('posts registration payloads with JSON headers', async () => {
    mockFetchResponse({ jsonData: { success: true } })

    await registerAccount('alice', 'secret')

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = globalThis.fetch.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/register`)
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe(JSON.stringify({ username: 'alice', password: 'secret' }))
  })

  it('adds authorization headers when token is provided', async () => {
    mockFetchResponse({ jsonData: { success: true } })

    await fetchCloudSave('token-123')

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer token-123')
  })

  it('fetches admin users with authorization headers', async () => {
    mockFetchResponse({ jsonData: { success: true, data: [] } })

    await fetchAdminUsers('admin-token')

    const [url, options] = globalThis.fetch.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/admin/users`)
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer admin-token')
  })

  it('encodes solar term query parameters', async () => {
    mockFetchResponse({ jsonData: { success: true } })

    await fetchTermStats('token-abc', 'spring term')

    const [url] = globalThis.fetch.mock.calls[0]
    expect(url).toContain('/api/term-stats?solarTerm=')
    expect(url).toContain(encodeURIComponent('spring term'))
  })

  it('builds report history URL with optional term filter', async () => {
    mockFetchResponse({ jsonData: { success: true } })

    await fetchHistoryReports('token-abc', 'xiaoshu')

    const [url] = globalThis.fetch.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/reports?solarTerm=xiaoshu`)
  })

  it('throws when the server responds with success=false', async () => {
    mockFetchResponse({ ok: true, status: 200, jsonData: { success: false, message: 'boom' } })

    await expect(loginAccount('a', 'b')).rejects.toMatchObject({
      message: 'boom',
      status: 200
    })
  })

  it('throws when response JSON cannot be parsed', async () => {
    mockFetchJsonFailure({ ok: true, status: 500 })

    await expect(syncCloudSave('token', { foo: 'bar' })).rejects.toMatchObject({
      status: 500
    })
  })

  it('sends payloads for profile updates and reports', async () => {
    mockFetchResponse({ jsonData: { success: true } })

    await updateUserProfile('token-1', { nickname: 'cat' })
    await uploadTermDailyStat('token-1', { date: '2024-01-01', solarTerm: 'test' })
    await saveTermReport('token-1', { solarTerm: 'test', summary: 'ok' })

    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    const bodies = globalThis.fetch.mock.calls.map(([, options]) => options.body)
    expect(bodies).toContain(JSON.stringify({ nickname: 'cat' }))
    expect(bodies).toContain(JSON.stringify({ date: '2024-01-01', solarTerm: 'test' }))
    expect(bodies).toContain(JSON.stringify({ solarTerm: 'test', summary: 'ok' }))
  })
})
