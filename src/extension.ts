import * as vscode from 'vscode';

// 1. 引入你的回车统计 (假设你在里面写了 initCodeIncrementTracker 函数)
import { initCodeIncrementTracker } from './trackers/codeIncrementTracker';

// 2. 引入同伴的统计 (选择包含 Activate 和 Deactivate 的函数)
import { activateCodePassTracker, deactivateCodePassTracker } from './trackers/codePassTracker';
// 如果 errorReporterTracker 里也有类似的函数，就按照如下格式补充
import { activateErrorReporterTracker } from './trackers/errorReporterTracker';
import { activateCodingDurationTracker, deactivateCodingDurationTracker } from './trackers/codingDurationTracker';

// 【插件启动时调用的核心函数】
export function activate(context: vscode.ExtensionContext) {
    console.log('CS Valley 插件已全面启动！');

    // 启动你的回车统计功能
    initCodeIncrementTracker(context);

    // 启动同伴的通过次数统计功能
    activateCodePassTracker(context);
    
    // 如果有其他的，也像这样启动：
    activateErrorReporterTracker(context);

    activateCodingDurationTracker(context);
}

// 【插件被关闭/卸载时调用的核心函数】
export function deactivate(context: vscode.ExtensionContext) {
    // 调用同伴写的清理与保存数据的函数
    deactivateCodePassTracker(context);
    deactivateCodingDurationTracker(context);
}