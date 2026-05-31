import * as assert from 'assert'
import * as vscode from 'vscode'

suite('CS Valley Extension', () => {
  test('registers command on activation', async () => {
    const extension = vscode.extensions.getExtension('cyber007.codetracker')
    assert.ok(extension, 'Extension not found')

    await extension.activate()
    const commands = await vscode.commands.getCommands(true)

    assert.ok(
      commands.includes('csvalley.sendTestReport'),
      'Command is not registered'
    )
  })
})
