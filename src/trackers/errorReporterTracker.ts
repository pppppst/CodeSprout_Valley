// src/trackers/errorReporterTracker.ts (核心逻辑片段)
import * as vscode from 'vscode';
import { reportActivityToElectron } from '../reportService';
import { isErrorSeverity } from '../utils/errorUtils';
// 导入 codePassTracker 的处理函数
import { handleDiagnosticChangeForCodePass } from './codePassTracker'; // <-- 关键导入

let cumulativeErrorCountInSession = 0; // 新增：当前会话中，自上次上报后的错误增量
const fileHadErrorBefore: Map<string, boolean> = new Map(); // Map<uri.toString(), boolean>
let diagnosticDisposable: vscode.Disposable | undefined;
let reportThrottleTimeout: NodeJS.Timeout | undefined;
const REPORT_THROTTLE_MS = 3000; // 3秒节流

// ... (activateErrorReporterTracker 和 deactivateErrorReporterTracker 的骨架)

function onDiagnosticsChanged(e: vscode.DiagnosticChangeEvent) {
    e.uris.forEach(uri => {
        const uriStr = uri.toString();
        const diagnosticsForUri = vscode.languages.getDiagnostics(uri);
        const hasErrorsNow = diagnosticsForUri.some(isErrorSeverity);

        const hadErrorBefore = fileHadErrorBefore.get(uriStr) || false; // 默认首次为无错

        if (!hadErrorBefore && hasErrorsNow) {
            // 文件从无 Error 变为有 Error
            cumulativeErrorCountInSession++; // 累加到增量计数器
            console.log(`CS Valley Plugin: File ${uri.fsPath} entered error state. New error increment in session: ${cumulativeErrorCountInSession}`);
            triggerReportErrorCount();
        }
        fileHadErrorBefore.set(uriStr, hasErrorsNow); // 更新文件状态

        // !!! 调用 codePassTracker 的核心处理逻辑 !!!
        handleDiagnosticChangeForCodePass(uri);
    });
}

function triggerReportErrorCount() {
    if (reportThrottleTimeout) {
        clearTimeout(reportThrottleTimeout);
    }
    reportThrottleTimeout = setTimeout(() => {
        if (cumulativeErrorCountInSession > 0) {
            // 只在有增量时才上报
             console.log("代码报错量："+cumulativeErrorCountInSession);
            reportActivityToElectron({ errorCount: cumulativeErrorCountInSession });
            cumulativeErrorCountInSession = 0; // 上报后重置增量计数器
        }
    }, REPORT_THROTTLE_MS);
}

export function activateErrorReporterTracker(context: vscode.ExtensionContext) {
    console.log('CS Valley Plugin: Activating Error Reporter Tracker.');
    // 不再从 context.workspaceState 加载 cumulativeErrorCount，因为我们现在追踪的是会话增量
    cumulativeErrorCountInSession = 0; // 插件激活时重置增量计数

    // fileHadErrorBefore 状态仍然需要加载和保存，用于判断“从无错到有错”的状态变迁
    const savedFileHadErrorBefore = context.workspaceState.get<[string, boolean][]>('csvalley.fileHadErrorBefore', []);
    fileHadErrorBefore.clear();
    savedFileHadErrorBefore.forEach(([uri, status]) => fileHadErrorBefore.set(uri, status));
    
    vscode.workspace.textDocuments.forEach(doc => {
        const uriStr = doc.uri.toString();
        const diagnostics = vscode.languages.getDiagnostics(doc.uri);
        const hasError = diagnostics.some(isErrorSeverity);
        fileHadErrorBefore.set(uriStr, hasError);
    });

    diagnosticDisposable = vscode.languages.onDidChangeDiagnostics(onDiagnosticsChanged);
    context.subscriptions.push(diagnosticDisposable);
}

export function deactivateErrorReporterTracker(context: vscode.ExtensionContext) { // 注意：这里需要传入 context
    console.log('CS Valley Plugin: Deactivating Error Reporter Tracker.');
    if (diagnosticDisposable) {
        diagnosticDisposable.dispose();
    }
    if (reportThrottleTimeout) {
        clearTimeout(reportThrottleTimeout);
    }
    // 保存 fileHadErrorBefore 状态
    context.workspaceState.update('csvalley.fileHadErrorBefore', Array.from(fileHadErrorBefore.entries()));
    // cumulativeErrorCountInSession 不需保存，因为它是一个会话增量
}