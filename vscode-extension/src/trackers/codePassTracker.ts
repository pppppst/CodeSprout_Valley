// src/trackers/codePassTracker.ts
import * as vscode from 'vscode';
import { reportActivityToElectron } from '../reportService';
import { ActivityReportData, FilePassStateMap } from '../types'; // 引入 FilePassStateMap
import { isErrorSeverity } from '../utils/errorUtils';

let codePassedCount = 0;
const filePassState: FilePassStateMap = new Map(); // 使用 FilePassStateMap
let reportThrottleTimeout: NodeJS.Timeout | undefined;
const REPORT_THROTTLE_MS = 5000; // 报告上报的节流阈值
const PASS_COUNT_THROTTLE_MS = 5000; // 计数通过事件的节流阈值

/**
 * 处理诊断变化，更新 codePassedCount。
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
        // 判断是否满足“通过”的计数条件：
        // 1. prevFileState === -1: 文件之前有 Error，现在修复了 => “通过修改问题通过”
        // 2. prevFileState === 0: 文件从未计数过通过，且当前无 Error => “直接通过 / 首次通过”
        const canCountThisPass = (prevFileState === -1) || (prevFileState === 0);

        if (canCountThisPass) {
            const now = Date.now();
            // 提取上次计数时间，用于节流。如果 prevFileState 是 0 或 -1，则 lastCountedTime 为 0。
            const lastCountedTime = (prevFileState > 0) ? prevFileState : 0;
            
            if (now - lastCountedTime > PASS_COUNT_THROTTLE_MS) {
                codePassedCount++;
                console.log(`CS Valley Plugin: File ${uri.fsPath} passed. codePassedCount: ${codePassedCount}`);
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
        reportActivityToElectron({ codePassed: codePassedCount });
    }, REPORT_THROTTLE_MS);
}

export function activateCodePassTracker(context: vscode.ExtensionContext) {
    console.log('CS Valley Plugin: Activating Code Pass Tracker.');
    // 加载持久化的 codePassedCount 和 filePassState
    codePassedCount = context.workspaceState.get('csvalley.codePassedCount', 0);
    const savedFilePassState = context.workspaceState.get<[string, number][]>('csvalley.filePassState', []);
    filePassState.clear();
    savedFilePassState.forEach(([uri, state]) => filePassState.set(uri, state));
}

export function deactivateCodePassTracker() {
    console.log('CS Valley Plugin: Deactivating Code Pass Tracker.');
    if (reportThrottleTimeout) {
        clearTimeout(reportThrottleTimeout);
    }
    // 保存 codePassedCount 和 filePassState
    context.workspaceState.update('csvalley.codePassedCount', codePassedCount);
    context.workspaceState.update('csvalley.filePassState', Array.from(filePassState.entries()));
}