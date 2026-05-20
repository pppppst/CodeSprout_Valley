import * as vscode from 'vscode';
import { ActivityReportData } from './types';

const BATCH_INTERVAL = 1500;
const REQUEST_TIMEOUT_MS = 3000;
const RETRY_INTERVAL_MS = 30000;
const PENDING_STORAGE_KEY = 'csvalley.pendingActivityReportData';
const NUMERIC_KEYS: Array<keyof ActivityReportData> = [
    'codeAdded',
    'errorCount',
    'codePassed',
    'codingDuration'
];

let dataBuffer: ActivityReportData = {};
let batchTimer: NodeJS.Timeout | undefined;
let retryTimer: NodeJS.Timeout | undefined;
let extensionContext: vscode.ExtensionContext | undefined;
let persistedPendingData: ActivityReportData = {};
let isFlushingPersistedData = false;

export function initializeReportService(context: vscode.ExtensionContext): void {
    extensionContext = context;
    persistedPendingData = sanitizeActivityData(
        context.globalState.get<ActivityReportData>(PENDING_STORAGE_KEY, {})
    );

    if (hasReportableData(persistedPendingData)) {
        schedulePersistedDataFlush(1000);
    }
}

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
        void queueAndFlushPayload(payload);
    }
}

export async function flushActivityBuffer(): Promise<void> {
    if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = undefined;
    }
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
    }

    await flushBuffer();
    await flushPersistedData();

    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
    }
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
    mergeActivityData(dataBuffer, data);
}

function mergeActivityData(target: ActivityReportData, data: ActivityReportData): void {
    for (const key of NUMERIC_KEYS) {
        const value = data[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            target[key] = (target[key] ?? 0) + value;
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

    await queueAndFlushPayload(payload);
}

function sanitizeActivityData(data: ActivityReportData | undefined): ActivityReportData {
    const sanitized: ActivityReportData = {};

    if (!data) {
        return sanitized;
    }

    for (const key of NUMERIC_KEYS) {
        const value = data[key];
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

function hasReportableData(data: ActivityReportData): boolean {
    return NUMERIC_KEYS.some(key => typeof data[key] === 'number' && (data[key] ?? 0) > 0);
}

async function persistPendingData(): Promise<void> {
    if (!extensionContext) {
        return;
    }

    await extensionContext.globalState.update(
        PENDING_STORAGE_KEY,
        hasReportableData(persistedPendingData) ? persistedPendingData : undefined
    );
}

async function queueAndFlushPayload(payload: ActivityReportData & { timestamp: number }): Promise<void> {
    mergeActivityData(persistedPendingData, payload);
    await persistPendingData();
    await flushPersistedData();
}

function schedulePersistedDataFlush(delayMs = RETRY_INTERVAL_MS): void {
    if (retryTimer || !hasReportableData(persistedPendingData)) {
        return;
    }

    retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void flushPersistedData();
    }, delayMs);
}

async function flushPersistedData(): Promise<void> {
    if (isFlushingPersistedData || !hasReportableData(persistedPendingData)) {
        return;
    }

    isFlushingPersistedData = true;
    const dataToSend = { ...persistedPendingData };
    const payload = buildPayload(dataToSend);

    if (!payload) {
        isFlushingPersistedData = false;
        return;
    }

    const sent = await sendPayload(payload);

    if (sent) {
        subtractActivityData(persistedPendingData, dataToSend);
        await persistPendingData();
        if (hasReportableData(persistedPendingData)) {
            schedulePersistedDataFlush(0);
        }
    } else {
        schedulePersistedDataFlush();
    }

    isFlushingPersistedData = false;
}

function subtractActivityData(target: ActivityReportData, sentData: ActivityReportData): void {
    for (const key of NUMERIC_KEYS) {
        const sentValue = sentData[key];
        const currentValue = target[key];

        if (typeof sentValue !== 'number' || typeof currentValue !== 'number') {
            continue;
        }

        const remaining = currentValue - sentValue;
        if (remaining > 0) {
            target[key] = remaining;
        } else {
            delete target[key];
        }
    }
}

async function sendPayload(payload: ActivityReportData & { timestamp: number }): Promise<boolean> {
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
            return false;
        }

        return true;
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('[CS Valley] Report request timed out.');
        } else if (error instanceof Error) {
            console.error(`[CS Valley] Network error: ${error.message}`);
        } else {
            console.error('[CS Valley] Unknown network error.');
        }

        return false;
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
