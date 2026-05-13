import * as vscode from 'vscode';
import { ActivityReportData } from './types';

const BATCH_INTERVAL = 1500;
const REQUEST_TIMEOUT_MS = 3000;
const NUMERIC_KEYS: Array<keyof ActivityReportData> = [
    'codeAdded',
    'errorCount',
    'codePassed',
    'codingDuration'
];

let dataBuffer: ActivityReportData = {};
let batchTimer: NodeJS.Timeout | undefined;

export function reportActivityToElectron(data: ActivityReportData): void {
    mergeIntoBuffer(data);

    if (!batchTimer) {
        batchTimer = setTimeout(() => {
            void flushBuffer();
        }, BATCH_INTERVAL);
    }
}

export function reportActivityToElectronImmediately(data: ActivityReportData): void {
    const payload = buildPayload(data);
    if (payload) {
        void sendPayload(payload);
    }
}

export async function flushActivityBuffer(): Promise<void> {
    if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = undefined;
    }

    await flushBuffer();
}

function buildPayload(data: ActivityReportData): (ActivityReportData & { timestamp: number }) | undefined {
    const payload: ActivityReportData = {};

    for (const key of NUMERIC_KEYS) {
        const value = data[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            payload[key] = value;
        }
    }

    if (Object.keys(payload).length === 0) {
        return undefined;
    }

    return { ...payload, timestamp: Date.now() };
}

function mergeIntoBuffer(data: ActivityReportData): void {
    for (const key of NUMERIC_KEYS) {
        const value = data[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            dataBuffer[key] = (dataBuffer[key] ?? 0) + value;
        }
    }
}

async function flushBuffer(): Promise<void> {
    if (Object.keys(dataBuffer).length === 0) {
        batchTimer = undefined;
        return;
    }

    const payload = buildPayload(dataBuffer);
    dataBuffer = {};
    batchTimer = undefined;

    if (!payload) {
        return;
    }

    await sendPayload(payload);
}

async function sendPayload(payload: ActivityReportData & { timestamp: number }): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(getElectronReportUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            console.error(`[CS Valley] Server responded with ${response.status}`);
        }
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('[CS Valley] Report request timed out.');
        } else if (error instanceof Error) {
            console.error(`[CS Valley] Network error: ${error.message}`);
        } else {
            console.error('[CS Valley] Unknown network error.');
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

function getElectronReportUrl(): string {
    const config = vscode.workspace.getConfiguration('csvalley');
    const port = config.get<number>('electronPort', 3001);
    const path = config.get<string>('reportPath', '/activity-report');
    return `http://127.0.0.1:${port}${path}`;
}
