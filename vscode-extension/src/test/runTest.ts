import * as path from 'path'
import { runTests } from '@vscode/test-electron'

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../..')
    const extensionTestsPath = path.resolve(__dirname, './suite/index')

    await runTests({ extensionDevelopmentPath, extensionTestsPath })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to run integration tests: ${message}`)
    process.exit(1)
  }
}

void main()
