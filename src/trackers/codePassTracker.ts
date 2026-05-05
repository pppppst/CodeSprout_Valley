import * as vscode from 'vscode';
import { reportActivityToElectron } from '../reportService';
import { ActivityReportData, FilePassStateMap } from '../types'; // 引入 FilePassStateMap
import { isErrorSeverity } from '../utils/errorUtils';

let codePassedIncrementInSession = 0; // 新增：当前会话中，自上次上报后的通过增量
const filePassState: FilePassStateMap = new Map(); // 使用 FilePassStateMap
let reportThrottleTimeout: NodeJS.Timeout | undefined;
const REPORT_THROTTLE_MS = 5000; // 报告上报的节流阈值
const PASS_COUNT_THROTTLE_MS = 5000; // 计数通过事件的节流阈值


/**
 * 处理诊断变化，更新 codePassedIncrementInSession。
 * 此函数由 ErrorReporterTracker 的 onDiagnosticsChanged 函数调用。
 * @param uri 发生诊断变化的文件的 URI。
 */
export function handleDiagnosticChangeForCodePass(uri: vscode.Uri) {
    const diagnosticsForUri = vscode.languages.getDiagnostics(uri);
    const isErrorFreeNow = !diagnosticsForUri.some(isErrorSeverity);
    const uriStr = uri.toString();

    const prevFileState = filePassState.get(uriStr) || 0; // 默认0表示从未计数过

    // 场景1：文件当前没有 Error
    if (isErrorFreeNow) {
        const canCountThisPass = (prevFileState === -1) || (prevFileState === 0);

        if (canCountThisPass) {
            const now = Date.now();
            const lastCountedTime = (prevFileState > 0) ? prevFileState : 0;
            
            if (now - lastCountedTime > PASS_COUNT_THROTTLE_MS) {
                codePassedIncrementInSession++; // 累加到增量计数器
                console.log(`CS Valley Plugin: File ${uri.fsPath} passed. New codePassed increment in session: ${codePassedIncrementInSession}`);
                // 记录本次通过的时间戳，标记为【已稳定通过，且当前无错】
                filePassState.set(uriStr, now);
                triggerReportCodePass(); // 触发上报
            }
        }
    } else {
        // 场景2：文件当前有 Error
        // 将文件状态标记为 -1，表示该文件目前有 Error，下次修好可以重新计数
        filePassState.set(uriStr, -1);
    }
}

function triggerReportCodePass() {
    if (reportThrottleTimeout) {
        clearTimeout(reportThrottleTimeout);
    }
    reportThrottleTimeout = setTimeout(() => {
        if (codePassedIncrementInSession > 0) {
            // 只在有增量时才上报
            console.log("代码通过量："+codePassedIncrementInSession)
            reportActivityToElectron({ codePassed: codePassedIncrementInSession });
            codePassedIncrementInSession = 0; // 上报后重置增量计数器
        }
    }, REPORT_THROTTLE_MS);
}

export function activateCodePassTracker(context: vscode.ExtensionContext) {
    console.log('CS Valley Plugin: Activating Code Pass Tracker.');
    // 不再从 context.workspaceState 加载 codePassedCount，因为我们现在追踪的是会话增量
    codePassedIncrementInSession = 0; // 插件激活时重置增量计数

    // filePassState 仍然需要加载和保存，用于判断文件的通过状态和节流
    const savedFilePassState = context.workspaceState.get<[string, number][]>('csvalley.filePassState', []);
    filePassState.clear();
    savedFilePassState.forEach(([uri, state]) => filePassState.set(uri, state));
}

export function deactivateCodePassTracker(context: vscode.ExtensionContext) { // 注意：这里需要传入 context
    console.log('CS Valley Plugin: Deactivating Code Pass Tracker.');
    if (reportThrottleTimeout) {
        clearTimeout(reportThrottleTimeout);
    }
    // 保存 filePassState
    context.workspaceState.update('csvalley.filePassState', Array.from(filePassState.entries()));
    // codePassedIncrementInSession 不需保存，因为它是一个会话增量
}