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

const debugEmitter = createEmitter<any>()
let diagnostics: any[] = []

const windowState = {
  activeTextEditor: undefined as any,
  visibleTextEditors: [] as any[]
}

vi.mock('vscode', () => ({
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1
  },
  languages: {
    getDiagnostics: vi.fn(() => diagnostics)
  },
  debug: {
    onDidStartDebugSession: (listener: Listener<any>) => debugEmitter.event(listener)
  },
  window: {
    get activeTextEditor() {
      return windowState.activeTextEditor
    },
    get visibleTextEditors() {
      return windowState.visibleTextEditors
    }
  },
  workspace: {
    textDocuments: [] as any[]
  }
}))

const reportSpy = vi.fn()

vi.mock('../../reportService', () => ({
  reportActivityToElectronImmediately: reportSpy
}))

function createDocument(path: string) {
  return {
    uri: {
      scheme: 'file',
      fsPath: path
    },
    isUntitled: false
  }
}

async function loadTracker() {
  vi.resetModules()
  return import('../errorReporterTracker')
}

beforeEach(() => {
  vi.useFakeTimers()
  reportSpy.mockClear()
  diagnostics = []
  windowState.activeTextEditor = undefined
  windowState.visibleTextEditors = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('errorReporterTracker', () => {
  it('reports error increment for blocking diagnostics', async () => {
    const tracker = await loadTracker()
    const document = createDocument('C:/demo.ts')

    windowState.activeTextEditor = { document }
    diagnostics = [
      {
        severity: 0,
        message: 'bad'
      }
    ]

    tracker.activateErrorReporterTracker({ subscriptions: [] } as any)
    debugEmitter.fire({ parentSession: undefined })

    await vi.advanceTimersByTimeAsync(800)
    await vi.advanceTimersByTimeAsync(3000)

    expect(reportSpy).toHaveBeenCalledWith({ errorCount: 1 })
  })

  it('treats certain python warnings as blocking', async () => {
    const tracker = await loadTracker()
    const document = createDocument('C:/demo.py')

    windowState.activeTextEditor = { document }
    diagnostics = [
      {
        severity: 1,
        code: 'reportUndefinedVariable',
        message: 'undefined'
      }
    ]

    tracker.activateErrorReporterTracker({ subscriptions: [] } as any)
    debugEmitter.fire({ parentSession: undefined })

    await vi.advanceTimersByTimeAsync(800)
    await vi.advanceTimersByTimeAsync(3000)

    expect(reportSpy).toHaveBeenCalledWith({ errorCount: 1 })
  })

  it('reports pass increment when no blocking diagnostics', async () => {
    const tracker = await loadTracker()
    const document = createDocument('C:/demo.ts')

    windowState.activeTextEditor = { document }
    diagnostics = []

    tracker.activateErrorReporterTracker({ subscriptions: [] } as any)
    debugEmitter.fire({ parentSession: undefined })

    await vi.advanceTimersByTimeAsync(800)
    await vi.advanceTimersByTimeAsync(3000)

    expect(reportSpy).toHaveBeenCalledWith({ codePassed: 1 })
  })
})
