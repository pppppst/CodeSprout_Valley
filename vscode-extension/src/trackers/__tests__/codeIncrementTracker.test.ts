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

const saveEmitter = createEmitter<any>()
const openEmitter = createEmitter<any>()
const renameEmitter = createEmitter<any>()
const deleteEmitter = createEmitter<any>()

const workspaceState = {
  textDocuments: [] as any[]
}

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: (key: string, defaultValue: unknown) =>
        key === 'reportThrottleMs' ? 1 : defaultValue
    })),
    onDidSaveTextDocument: (listener: Listener<any>) => saveEmitter.event(listener),
    onDidOpenTextDocument: (listener: Listener<any>) => openEmitter.event(listener),
    onDidRenameFiles: (listener: Listener<any>) => renameEmitter.event(listener),
    onDidDeleteFiles: (listener: Listener<any>) => deleteEmitter.event(listener),
    get textDocuments() {
      return workspaceState.textDocuments
    }
  }
}))

const reportSpy = vi.fn()

vi.mock('../../reportService', () => ({
  reportActivityToElectronImmediately: reportSpy
}))

function createDocument(options: {
  uri: string
  fsPath: string
  languageId: string
  text: string
  isUntitled?: boolean
}) {
  let currentText = options.text
  return {
    uri: {
      scheme: 'file',
      toString: () => options.uri,
      fsPath: options.fsPath
    },
    isUntitled: options.isUntitled ?? false,
    languageId: options.languageId,
    getText: () => currentText,
    setText: (next: string) => {
      currentText = next
    }
  }
}

async function loadTracker() {
  vi.resetModules()
  return import('../codeIncrementTracker')
}

beforeEach(() => {
  vi.useFakeTimers()
  reportSpy.mockClear()
  workspaceState.textDocuments = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('codeIncrementTracker', () => {
  it('reports positive line increments on save', async () => {
    const tracker = await loadTracker()
    const document = createDocument({
      uri: 'file:///a.ts',
      fsPath: 'C:/a.ts',
      languageId: 'typescript',
      text: 'const a = 1;'
    })

    workspaceState.textDocuments.push(document)
    tracker.activateCodeIncrementTracker({ subscriptions: [] } as any)

    document.setText('const a = 1;\nconst b = 2;')
    saveEmitter.fire(document)

    await vi.runAllTimersAsync()

    expect(reportSpy).toHaveBeenCalledTimes(1)
    expect(reportSpy).toHaveBeenCalledWith({ codeAdded: 1 })
  })

  it('ignores comment-only changes', async () => {
    const tracker = await loadTracker()
    const document = createDocument({
      uri: 'file:///b.js',
      fsPath: 'C:/b.js',
      languageId: 'javascript',
      text: '// comment\nconst a = 1;'
    })

    workspaceState.textDocuments.push(document)
    tracker.activateCodeIncrementTracker({ subscriptions: [] } as any)

    document.setText('// comment\nconst a = 1;\n// extra comment')
    saveEmitter.fire(document)

    await vi.runAllTimersAsync()

    expect(reportSpy).not.toHaveBeenCalled()
  })

  it('keeps baseline when files are renamed', async () => {
    const tracker = await loadTracker()
    const document = createDocument({
      uri: 'file:///old/path.ts',
      fsPath: 'C:/old/path.ts',
      languageId: 'typescript',
      text: 'const a = 1;'
    })

    workspaceState.textDocuments.push(document)
    tracker.activateCodeIncrementTracker({ subscriptions: [] } as any)

    renameEmitter.fire({
      files: [
        {
          oldUri: { toString: () => 'file:///old/path.ts' },
          newUri: { toString: () => 'file:///new/path.ts' }
        }
      ]
    })

    document.setText('const a = 1;\nconst b = 2;')
    document.uri.toString = () => 'file:///new/path.ts'
    saveEmitter.fire(document)

    await vi.runAllTimersAsync()

    expect(reportSpy).toHaveBeenCalledWith({ codeAdded: 1 })
  })
})
