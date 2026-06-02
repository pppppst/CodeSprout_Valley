import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Listener<T> = (event: T) => void

type Disposable = { dispose: () => void }

type MockEmitter<T> = {
  event: (listener: Listener<T>) => Disposable
  fire: (event: T) => void
}

function createEmitter<T>(): MockEmitter<T> {
  const listeners = new Set<Listener<T>>()
  return {
    event: (listener: Listener<T>) => {
      listeners.add(listener)
      return {
        dispose: () => listeners.delete(listener)
      }
    },
    fire: (event: T) => {
      for (const listener of Array.from(listeners)) {
        listener(event)
      }
    }
  }
}

const changeEmitter = createEmitter<any>()
const saveEmitter = createEmitter<any>()
const activeEditorEmitter = createEmitter<any>()
const selectionEmitter = createEmitter<any>()

const workspaceState = {
  getConfiguration: vi.fn(() => ({
    get: (key: string, defaultValue: unknown) => {
      if (key === 'codingActivityDebounceMs') {
        return 1500
      }
      if (key === 'codingDurationReportIntervalMs') {
        return 10000
      }
      return defaultValue
    }
  }))
}

const windowState = {
  activeTextEditor: undefined as any
}

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: workspaceState.getConfiguration,
    onDidChangeTextDocument: (listener: Listener<any>) => changeEmitter.event(listener),
    onDidSaveTextDocument: (listener: Listener<any>) => saveEmitter.event(listener)
  },
  window: {
    onDidChangeActiveTextEditor: (listener: Listener<any>) =>
      activeEditorEmitter.event(listener),
    onDidChangeTextEditorSelection: (listener: Listener<any>) =>
      selectionEmitter.event(listener),
    get activeTextEditor() {
      return windowState.activeTextEditor
    }
  }
}))

const reportSpy = vi.fn()

vi.mock('../../reportService', () => ({
  reportActivityToElectronImmediately: reportSpy
}))

function createDocument(text = 'const a = 1;') {
  return {
    uri: { scheme: 'file' },
    isUntitled: false,
    getText: () => text
  }
}

async function loadTracker() {
  vi.resetModules()
  return import('../codingDurationTracker')
}

beforeEach(() => {
  vi.useFakeTimers()
  reportSpy.mockClear()
  windowState.activeTextEditor = undefined
})

afterEach(() => {
  vi.useRealTimers()
})

describe('codingDurationTracker', () => {
  it('accumulates time and reports after inactivity', async () => {
    const tracker = await loadTracker()
    const document = createDocument()

    tracker.activateCodingDurationTracker({ subscriptions: [] } as any)

    changeEmitter.fire({ contentChanges: [{ text: 'x' }], document })

    await vi.advanceTimersByTimeAsync(1200)
    await vi.advanceTimersByTimeAsync(1500)

    expect(reportSpy).toHaveBeenCalled()
    const payload = reportSpy.mock.calls[0][0]
    expect(payload.codingDuration).toBeGreaterThan(0)
  })

  it('tracks selection changes for active editor', async () => {
    const tracker = await loadTracker()
    const document = createDocument()
    const editor = { document }

    windowState.activeTextEditor = editor
    tracker.activateCodingDurationTracker({ subscriptions: [] } as any)

    selectionEmitter.fire({
      textEditor: editor,
      selections: [{ isEmpty: false }]
    })

    await vi.advanceTimersByTimeAsync(2000)

    expect(reportSpy).toHaveBeenCalled()
  })
})
