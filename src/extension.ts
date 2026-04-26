import * as vscode from 'vscode';

let totalNewLines = 0;

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('CodeTracker 已启动回车统计版');

    const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
        for (const change of event.contentChanges) {
            const text = change.text;

            //console.log('本次输入内容:', JSON.stringify(text));

            if (text.includes('\n')) {
                const enterCount = (text.match(/\n/g) || []).length;
                totalNewLines += enterCount;

                console.log(`检测到回车 ${enterCount} 次，累计新增 ${totalNewLines} 行`);

                vscode.window.showInformationMessage(
                    `检测到回车 ${enterCount} 次，累计新增 ${totalNewLines} 行`
                );
            }
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}