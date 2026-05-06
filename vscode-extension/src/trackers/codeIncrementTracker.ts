import * as vscode from 'vscode';
import { reportActivityToElectron } from '../reportService';

let lastKnownLineCount: Map<string, number> = new Map();
let accumulatedCodeAddedIncrement = 0;
let reportThrottleTimeout: NodeJS.Timeout | undefined;

function getReportThrottleMs(): number {
  const config = vscode.workspace.getConfiguration('csvalley');
  return config.get<number>('reportThrottleMs', 3000);
}

// 计算增量
function calculateAndAccumulateCodeIncrement(document: vscode.TextDocument) {
    const uriStr = document.uri.toString();
    const currentLines = document.lineCount;
    
    // 上次行数（没有则为 0 → 新文件）
    const lastLines = lastKnownLineCount.get(uriStr) ?? 0;

    const diff = currentLines - lastLines;
    if (diff > 0) {
        accumulatedCodeAddedIncrement += diff;
        triggerReportCodeIncrement();
    }

    // 永远更新最新行数
    lastKnownLineCount.set(uriStr, currentLines);
}

// 节流上报
function triggerReportCodeIncrement() {
    if (reportThrottleTimeout) {
        clearTimeout(reportThrottleTimeout);
        reportThrottleTimeout = undefined;
    }

    reportThrottleTimeout = setTimeout(() => {
        if (accumulatedCodeAddedIncrement > 0) {
            reportActivityToElectron({ codeAdded: accumulatedCodeAddedIncrement });
            console.log(`上报代码增量: ${accumulatedCodeAddedIncrement} 行`);
            accumulatedCodeAddedIncrement = 0;
        }
        reportThrottleTimeout = undefined;
    }, getReportThrottleMs());
}

// 激活
export function activateCodeIncrementTracker(context: vscode.ExtensionContext) {
    lastKnownLineCount.clear();
    accumulatedCodeAddedIncrement = 0;

    // 记录基准行数（打开文件时不计增量）
    const recordBaseline = (doc: vscode.TextDocument) => {
        if (doc.isUntitled) return;
        const key = doc.uri.toString();
        
        if (!lastKnownLineCount.has(key)) {
            lastKnownLineCount.set(key, doc.lineCount);
        }
    };

    // 1. 保存时计算增量
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            calculateAndAccumulateCodeIncrement(doc);
        })
    );

    // 2. 打开文件时记录基准
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            recordBaseline(doc);
        })
    );

    // 3. 插件启动时，已打开的文件全部记录基准
    vscode.workspace.textDocuments.forEach(doc => {
        recordBaseline(doc);
    });
}

// 停用
export function deactivateCodeIncrementTracker(context: vscode.ExtensionContext) {
    if (reportThrottleTimeout) clearTimeout(reportThrottleTimeout);
    triggerReportCodeIncrement();
}