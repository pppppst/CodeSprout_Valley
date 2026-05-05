// src/trackers/codeIncrementTracker.ts
import * as vscode from 'vscode';

let totalNewLines = 0;

export function initCodeIncrementTracker(context: vscode.ExtensionContext) {
    const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
        for (const change of event.contentChanges) {
            const text = change.text;
            if (text.includes('\n')) {
                const enterCount = (text.match(/\n/g) || []).length;
                totalNewLines += enterCount;
                console.log(`检测到回车 ${enterCount} 次，累计新增 ${totalNewLines} 行`);
                
                // 根据需要决定是否频繁弹窗
                // vscode.window.showInformationMessage(`检测到回车 ${enterCount} 次，累计新增 ${totalNewLines} 行`);
            }
        }
    });

    context.subscriptions.push(disposable);
}