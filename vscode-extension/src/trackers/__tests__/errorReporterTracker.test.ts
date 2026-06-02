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

const saveTextEmitter = createEmitter<any>()
const saveNotebookEmitter = createEmitter<any>()
let diagnostics: any[] = []

vi.mock('vscode', () => ({
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1
  },
  languages: {
    getDiagnostics: vi.fn(() => diagnostics)
  },
  workspace: {
    onDidSaveTextDocument: (listener: Listener<any>) => saveTextEmitter.event(listener),
    onDidSaveNotebookDocument: (listener: Listener<any>) => saveNotebookEmitter.event(listener)
  }
}))

const reportSpy = vi.fn()

vi.mock('../../reportService', () => ({
  reportActivityToElectronImmediately: reportSpy
}))

function createDocument(path: string, text = 'const value = 1') {
  return {
    uri: {
      scheme: 'file',
      fsPath: path
    },
    isUntitled: false,
    getText: () => text
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
})

afterEach(() => {
  vi.useRealTimers()
})

describe('errorReporterTracker', () => {
  it('reports active file increment when a valid edited file is saved', async () => {
    const tracker = await loadTracker()
    const document = createDocument('C:/demo.ts')

    tracker.activateErrorReporterTracker({ subscriptions: [] } as any)
    saveTextEmitter.fire(document)

    await vi.advanceTimersByTimeAsync(1000)

    expect(reportSpy).toHaveBeenCalledWith({
      activeFileIncrement: 1,
      fixCountIncrement: 0
    })
  })

  it('reports fix increment when a problem file becomes clean', async () => {
    const tracker = await loadTracker()
    const document = createDocument('C:/demo.py')

    tracker.activateErrorReporterTracker({ subscriptions: [] } as any)

    diagnostics = [
      {
        severity: 0,
        message: 'bad'
      }
    ]
    saveTextEmitter.fire(document)
    await vi.advanceTimersByTimeAsync(1000)

    reportSpy.mockClear()
    diagnostics = []
    saveTextEmitter.fire(document)
    await vi.advanceTimersByTimeAsync(1000)

    expect(reportSpy).toHaveBeenCalledWith({
      activeFileIncrement: 0,
      fixCountIncrement: 1
    })
  })

  it('does not count the same active file twice in one session', async () => {
    const tracker = await loadTracker()
    const document = createDocument('C:/demo.ts')

    tracker.activateErrorReporterTracker({ subscriptions: [] } as any)
    saveTextEmitter.fire(document)
    await vi.advanceTimersByTimeAsync(1000)

    reportSpy.mockClear()
    saveTextEmitter.fire(document)
    await vi.advanceTimersByTimeAsync(1000)

    expect(reportSpy).not.toHaveBeenCalled()
  })
})
