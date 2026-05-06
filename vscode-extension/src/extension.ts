// src/extension.ts

import * as vscode from 'vscode';
import { reportActivityToElectron } from './reportService'; // 用于测试命令

// 1. 引入 codeIncrementTracker 的激活和停用函数
// 注意：你之前提供的 codeIncrementTracker 示例中函数名是 activateCodeIncrementTracker
import { 
    activateCodeIncrementTracker, 
    deactivateCodeIncrementTracker 
} from './trackers/codeIncrementTracker';



// 2. 引入 errorReporterTracker 的激活和停用函数
import { 
    activateErrorReporterTracker, 
    deactivateErrorReporterTracker 
} from './trackers/errorReporterTracker';

// 3. 引入 codingDurationTracker 的激活和停用函数
import { 
    activateCodingDurationTracker, 
    deactivateCodingDurationTracker 
} from './trackers/codingDurationTracker';


// 【插件启动时调用的核心函数】
export function activate(context: vscode.ExtensionContext) {
    console.log('CS Valley Activity Tracker Plugin has been activated!');

    // --- 激活所有追踪器模块 ---
    activateCodeIncrementTracker(context);
    activateErrorReporterTracker(context);
    activateCodingDurationTracker(context);

    // --- 注册测试命令 ---
    // 这个命令在 package.json 中定义为 "csvalley.sendTestReport"
    let testReportCommand = vscode.commands.registerCommand('csvalley.sendTestReport', async () => {
        vscode.window.showInformationMessage('CS Valley: Sending test activity report...');
        // 调用 reportService 发送一个模拟的增量数据
        await reportActivityToElectron({
            codeAdded: 10,           // 模拟 10 行代码增量
            errorCount: 1,           // 模拟 1 次错误状态进入
            codePassed: 2,           // 模拟 2 次代码通过
            codingDuration: 300      // 模拟 300 秒（5分钟）编码时长增量
        });
        vscode.window.showInformationMessage('CS Valley: Test report sent!');
    });

    // 将命令的 Disposable 对象添加到 context.subscriptions，以便在插件停用时自动清理
    context.subscriptions.push(testReportCommand);
}


// 【插件被关闭/卸载时调用的核心函数】
export function deactivate(context: vscode.ExtensionContext) {
    console.log('CS Valley Activity Tracker Plugin is deactivating...');

    // --- 停用所有追踪器模块，确保清理资源和上报最终增量 ---
    deactivateCodeIncrementTracker(context);
    deactivateErrorReporterTracker(context); // 确保这个函数存在且接收 context
    deactivateCodingDurationTracker(context);
    
    // context.subscriptions 会自动处理其内部的 Disposable 对象，无需手动循环

    console.log('CS Valley Activity Tracker Plugin has been deactivated.');
}