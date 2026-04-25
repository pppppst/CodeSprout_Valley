// src/trackers/errorReporterTracker.ts (核心逻辑片段)
import * as vscode from 'vscode';
import { reportActivityToElectron } from '../reportService';
import { isErrorSeverity } from '../utils/errorUtils';
// 导入 codePassTracker 的处理函数
import { handleDiagnosticChangeForCodePass } from './codePassTracker'; // <-- 关键导入

let cumulativeErrorCount = 0;
const fileHadErrorBefore: Map<string, boolean> = new Map(); // Map<uri.toString(), boolean>
let diagnosticDisposable: vscode.Disposable | undefined;
let reportThrottleTimeout: NodeJS.Timeout | undefined;
const REPORT_THROTTLE_MS = 3000; // 3秒节流

// ... (省略 activateErrorReporterTracker 和 deactivateErrorReporterTracker 的骨架)

// 统一诊断事件处理函数
function onDiagnosticsChanged(e: vscode.DiagnosticChangeEvent) {
    e.uris.forEach(uri => {
        const uriStr = uri.toString();
        const diagnosticsForUri = vscode.languages.getDiagnostics(uri);
        const hasErrorsNow = diagnosticsForUri.some(isErrorSeverity);

        const hadErrorBefore = fileHadErrorBefore.get(uriStr) || false; // 默认首次为无错

        if (!hadErrorBefore && hasErrorsNow) {
            // 文件从无 Error 变为有 Error
            cumulativeErrorCount++;
            console.log(`CS Valley Plugin: File ${uri.fsPath} entered error state. cumulativeErrorCount: ${cumulativeErrorCount}`);
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
        reportActivityToElectron({ errorCount: cumulativeErrorCount });
    }, REPORT_THROTTLE_MS);
}

export function activateErrorReporterTracker(context: vscode.ExtensionContext) {
    console.log('CS Valley Plugin: Activating Error Reporter Tracker.');
    // 加载持久化的 cumulativeErrorCount 和 fileHadErrorBefore
    cumulativeErrorCount = context.workspaceState.get('csvalley.cumulativeErrorCount', 0);
    const savedFileHadErrorBefore = context.workspaceState.get<[string, boolean][]>('csvalley.fileHadErrorBefore', []);
    fileHadErrorBefore.clear();
    savedFileHadErrorBefore.forEach(([uri, status]) => fileHadErrorBefore.set(uri, status));


    // 注册主诊断监听器
    diagnosticDisposable = vscode.languages.onDidChangeDiagnostics(onDiagnosticsChanged);
    context.subscriptions.push(diagnosticDisposable);
}

export function deactivateErrorReporterTracker() {
    console.log('CS Valley Plugin: Deactivating Error Reporter Tracker.');
    if (diagnosticDisposable) {
        diagnosticDisposable.dispose();
    }
    if (reportThrottleTimeout) {
        clearTimeout(reportThrottleTimeout);
    }
    // 保存 cumulativeErrorCount 和 fileHadErrorBefore
    context.workspaceState.update('csvalley.cumulativeErrorCount', cumulativeErrorCount);
    context.workspaceState.update('csvalley.fileHadErrorBefore', Array.from(fileHadErrorBefore.entries()));
}