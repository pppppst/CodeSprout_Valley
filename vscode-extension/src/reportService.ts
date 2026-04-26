import * as vscode from 'vscode';
import { ActivityReportData } from './types';

// 1. 数据缓冲区：暂存短时间内产生的所有数据
let dataBuffer: ActivityReportData = {};
let batchTimer: NodeJS.Timeout | null = null;
const BATCH_INTERVAL = 1500; // 聚合时间阈值：1.5秒

/**
 * 核心暴露接口：开发者 A 和 B 调用的依然是这个函数
 * 但数据不再立即发送，而是进入缓冲区等待“打包”
 */
export function reportActivityToElectron(data: ActivityReportData): void {
    // 将新数据合并到缓冲区 (浅拷贝合并)
    dataBuffer = { ...dataBuffer, ...data };

    // 如果没有定时器在跑，开启一个
    if (!batchTimer) {
        batchTimer = setTimeout(() => {
            flushBuffer();
        }, BATCH_INTERVAL);
    }
}

/**
 * 内部函数：负责将缓冲区的数据清空并真正通过网络发送
 */
async function flushBuffer(): Promise<void> {
    if (Object.keys(dataBuffer).length === 0) return;

    // 准备发送的数据快照，并清空缓冲区和计时器
    const payload = { ...dataBuffer, timestamp: Date.now() };
    dataBuffer = {}; 
    batchTimer = null;

    const url = getElectronReportUrl();

    try {
        // 使用 AbortController 实现超时控制 (3秒超时)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        // 使用 VS Code 目标环境(Node.js 18+)内置的原生 fetch
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[CS Valley] Server responded with ${response.status}`);
        }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error('[CS Valley] Report request timed out.');
        } else {
            console.error(`[CS Valley] Network error: ${error.message}`);
        }
    }
}

/**
 * 配置读取逻辑保持不变
 */
function getElectronReportUrl(): string {
    const config = vscode.workspace.getConfiguration('csvalley');
    const port = config.get<number>('electronPort', 3001);
    const path = config.get<string>('reportPath', '/activity-report');
    return `http://localhost:${port}${path}`;
}