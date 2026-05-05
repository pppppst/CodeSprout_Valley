import * as vscode from 'vscode';
import { reportActivityToElectron } from '../reportService';
import { ActivityReportData } from '../types';

// --- 内部状态和变量 ---
let isCodingActive: boolean = false; // 用户当前是否处于“编码活跃”状态
let accumulatedDurationIncrement: number = 0; // 自上次上报后累积的编码时长增量（秒）

let activityDebounceTimeout: NodeJS.Timeout | undefined; // 用户活动防抖定时器
let durationAccumulationInterval: NodeJS.Timeout | undefined; // 每秒累积时长的定时器
let reportTriggerInterval: NodeJS.Timeout | undefined; // 定时触发上报的定时器

let lastAccumulationTime: number = 0; // 上次执行 durationAccumulationInterval 的时间戳（毫秒）

// --- 配置读取函数 ---
function getCodingActivityDebounceMs(): number {
    const config = vscode.workspace.getConfiguration('csvalley');
    // 默认值与 package.json 中的 csvalley.codingActivityDebounceMs 保持一致
    return config.get<number>('codingActivityDebounceMs', 5000); // 5秒防抖
}

function getCodingDurationReportIntervalMs(): number {
    const config = vscode.workspace.getConfiguration('csvalley');
    // 默认值与 package.json 中的 csvalley.codingDurationReportIntervalMs 保持一致
    return config.get<number>('codingDurationReportIntervalMs', 60000); // 60 秒（1分钟）上报一次
}

// --- 核心逻辑函数 ---

/**
 * 标记用户活跃，并重置防抖计时器。
 * 此函数是所有用户活动监听的入口。
 */
function markUserActive() {
    // 每次活动都重置防抖定时器
    if (activityDebounceTimeout) {
        clearTimeout(activityDebounceTimeout);
    }
    activityDebounceTimeout = setTimeout(() => {
        // 如果防抖时间到了，且期间没有新的活动，则认为用户停止活跃
        isCodingActive = false;
        console.log('CS Valley Plugin: Coding activity paused.');
        stopAccumulationAndReporting(); // 停止所有计时器
        // 立即上报剩余的累积时长（如果有）
        triggerDurationReport();
    }, getCodingActivityDebounceMs());

    // 如果之前不活跃，则开始累积和上报
    if (!isCodingActive) {
        isCodingActive = true;
        console.log('CS Valley Plugin: Coding activity started.');
        startAccumulationAndReporting();
    }
}

/**
 * 每秒钟检查并累积编码时长。
 * 此函数由 durationAccumulationInterval 定时调用。
 */
function accumulateDuration() {
    if (isCodingActive) {
        const now = Date.now();
        // 计算自上次累积以来经过的时间
        // 第一次执行时 lastAccumulationTime 为 0，会使用一个合理的初始值（例如间隔时间本身）
        const elapsedMs = lastAccumulationTime === 0 ? 1000 : (now - lastAccumulationTime);
        const elapsedSeconds = elapsedMs / 1000;
        
        // 避免累积过长时间，例如如果系统休眠了很久
        // 假设最大累积间隔为 5 秒，防止一次性累积过多（可调）
        accumulatedDurationIncrement += Math.min(elapsedSeconds, 5); 
        
        lastAccumulationTime = now; // 更新上次累积时间
        // console.log(`CS Valley Plugin: Accumulating duration. Current increment: ${accumulatedDurationIncrement.toFixed(2)} seconds.`);
    }
}

/**
 * 触发编码时长上报，并重置累积器。
 * 此函数由 reportTriggerInterval 定时调用，或者在停用时立即调用。
 */
function triggerDurationReport() {
    if (accumulatedDurationIncrement > 0) {
        const durationToSend = Math.round(accumulatedDurationIncrement); // 取整上报
        reportActivityToElectron({ codingDuration: durationToSend });
        accumulatedDurationIncrement = 0; // 上报后重置累积器
        console.log(`编程时间增量: ${durationToSend} seconds.`);
    }
}

/**
 * 启动编码时长累积和定时上报的计时器。
 */
function startAccumulationAndReporting() {
    // 确保只启动一次
    if (!durationAccumulationInterval) {
        lastAccumulationTime = Date.now(); // 首次启动时设置上次累积时间
        durationAccumulationInterval = setInterval(accumulateDuration, 1000); // 每秒累积
    }
    if (!reportTriggerInterval) {
        reportTriggerInterval = setInterval(triggerDurationReport, getCodingDurationReportIntervalMs()); // 定时上报
    }
}

/**
 * 停止所有与编码时长累积和上报相关的计时器。
 */
function stopAccumulationAndReporting() {
    if (durationAccumulationInterval) {
        clearInterval(durationAccumulationInterval);
        durationAccumulationInterval = undefined;
    }
    if (reportTriggerInterval) {
        clearInterval(reportTriggerInterval);
        reportTriggerInterval = undefined;
    }
    lastAccumulationTime = 0; // 重置累积时间标记
}

// --- 激活和停用函数 ---

export function activateCodingDurationTracker(context: vscode.ExtensionContext) {
    console.log('CS Valley Plugin: Activating Coding Duration Tracker.');

    // 初始化状态
    isCodingActive = false;
    accumulatedDurationIncrement = 0;
    lastAccumulationTime = 0;

    // 注册各种用户活动监听器
    // 1. 文档内容改变
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        // 仅当有实际内容变化时才算活跃，排除无意义的事件（如诊断更新不改变内容）
        if (e.contentChanges.length > 0) {
            markUserActive();
        }
    }));

    // 2. 文档保存
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => {
        markUserActive();
    }));

    // 3. 活动编辑器切换
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) { // 确保有活动的编辑器
            markUserActive();
        }
    }));
    
    // 4. 文本编辑器选择范围改变 (例如鼠标拖动选择文本)
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
        // 仅当选择了内容时（非空选择）才算活跃，避免光标移动也触发
        if (e.textEditor === vscode.window.activeTextEditor && !e.selections[0].isEmpty) {
            markUserActive();
        }
    }));
    
    

    // 初始状态下，如果用户已经处于活跃编辑器，也视为活跃
    if (vscode.window.activeTextEditor) {
        markUserActive();
    }
}

// 注意：deactivate 函数需要 context 参数，因为在 extension.ts 中是这样调用的
export function deactivateCodingDurationTracker(context: vscode.ExtensionContext) {
    console.log('CS Valley Plugin: Deactivating Coding Duration Tracker.');

    // 清理所有防抖和定时器
    if (activityDebounceTimeout) {
        clearTimeout(activityDebounceTimeout);
        activityDebounceTimeout = undefined;
    }
    stopAccumulationAndReporting();

    // 在停用前，确保最后一次的累积时长也被上报（重要）
    triggerDurationReport(); 
    
    // 如果有需要持久化的数据，可以在这里使用 context.workspaceState.update()
    // 目前这个追踪器没有需要持久化的数据（因为它只关心当前会话的增量）
}