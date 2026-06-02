import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type MockConfig = {
  electronPort?: number
  reportPath?: string
}

const configOverrides: MockConfig = {}

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: (key: string, defaultValue: unknown) => {
        if (key === 'electronPort' && typeof configOverrides.electronPort === 'number') {
          return configOverrides.electronPort
        }
        if (key === 'reportPath' && typeof configOverrides.reportPath === 'string') {
          return configOverrides.reportPath
        }
        return defaultValue
      }
    }))
  }
}))

function createContext(initialData: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initialData))
  return {
    globalState: {
      get: (key: string, defaultValue: unknown) =>
        store.has(key) ? store.get(key) : defaultValue,
      update: (key: string, value: unknown) => {
        if (value === undefined) {
          store.delete(key)
        } else {
          store.set(key, value)
        }
        return Promise.resolve()
      }
    },
    subscriptions: []
  } as any
}

async function loadReportService() {
  vi.resetModules()
  const module = await import('../reportService')
  return module
}

beforeEach(() => {
  vi.useFakeTimers()
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as any
  configOverrides.electronPort = 3456
  configOverrides.reportPath = '/report'
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (globalThis as any).fetch
})

describe('reportService', () => {
  it('batches activity into a single payload', async () => {
    const { reportActivityToElectron } = await loadReportService()

    reportActivityToElectron({ codeAdded: 1 })
    reportActivityToElectron({ codeAdded: 2, activeFileIncrement: 1, fixCountIncrement: 1, codingDuration: 5 })

    await vi.runAllTimersAsync()

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [, options] = (globalThis.fetch as any).mock.calls[0]
    const payload = JSON.parse(options.body)
    expect(payload.codeAdded).toBe(3)
    expect(payload.activeFileIncrement).toBe(1)
    expect(payload.fixCountIncrement).toBe(1)
    expect(payload.codingDuration).toBe(5)
    expect(typeof payload.timestamp).toBe('number')
  })

  it('sends immediate activity payloads', async () => {
    const { reportActivityToElectronImmediately } = await loadReportService()

    await reportActivityToElectronImmediately({ codeAdded: 7 })

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url] = (globalThis.fetch as any).mock.calls[0]
    expect(url).toBe('http://127.0.0.1:3456/report')
  })

  it('persists pending data when sending fails', async () => {
    const context = createContext()
    ;(globalThis.fetch as any).mockResolvedValueOnce({ ok: false, status: 500 })

    const { initializeReportService, reportActivityToElectronImmediately } =
      await loadReportService()

    initializeReportService(context)
    await reportActivityToElectronImmediately({ codeAdded: 4, activeFileIncrement: 2, fixCountIncrement: 1 })

    const stored = (context.globalState as any).get(
      'csvalley.pendingActivityReportData',
      {}
    )
    expect(stored).toMatchObject({ codeAdded: 4, activeFileIncrement: 2, fixCountIncrement: 1 })
  })

  it('retries persisted payloads until success', async () => {
    const context = createContext({
      'csvalley.pendingActivityReportData': { codeAdded: 2, activeFileIncrement: 1, fixCountIncrement: 1 }
    })

    ;(globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true })

    const { initializeReportService } = await loadReportService()

    initializeReportService(context)

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(30000)

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})
