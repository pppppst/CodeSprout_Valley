import * as vscode from 'vscode';
import { reportActivityToElectronImmediately } from '../reportService';

const lastKnownLineCount = new Map<string, number>();

let accumulatedCodeAddedIncrement = 0;
let reportThrottleTimeout: NodeJS.Timeout | undefined;

function getReportThrottleMs(): number {
    const config = vscode.workspace.getConfiguration('csvalley');
    return config.get<number>('reportThrottleMs', 3000);
}

function isTrackableDocument(document: vscode.TextDocument): boolean {
    return document.uri.scheme === 'file' && !document.isUntitled;
}

function calculateAndAccumulateCodeIncrement(document: vscode.TextDocument): void {
    if (!isTrackableDocument(document)) {
        return;
    }

    const uriStr = document.uri.toString();
    const currentLines = document.lineCount;
    const lastLines = lastKnownLineCount.get(uriStr);

    if (lastLines === undefined) {
        lastKnownLineCount.set(uriStr, currentLines);
        console.log(`[CS Valley] Code increment baseline initialized on save: ${uriStr}`);
        return;
    }

    const diff = currentLines - lastLines;
    if (diff > 0) {
        accumulatedCodeAddedIncrement += diff;
        scheduleCodeIncrementReport();
    }

    lastKnownLineCount.set(uriStr, currentLines);
}

function scheduleCodeIncrementReport(): void {
    if (reportThrottleTimeout) {
        clearTimeout(reportThrottleTimeout);
    }

    reportThrottleTimeout = setTimeout(() => {
        flushCodeIncrementReport();
    }, getReportThrottleMs());
}

function flushCodeIncrementReport(): void {
    if (reportThrottleTimeout) {
        clearTimeout(reportThrottleTimeout);
        reportThrottleTimeout = undefined;
    }

    if (accumulatedCodeAddedIncrement <= 0) {
        return;
    }

    reportActivityToElectronImmediately({ codeAdded: accumulatedCodeAddedIncrement });
    console.log(`[CS Valley] Code increment: ${accumulatedCodeAddedIncrement} lines.`);
    accumulatedCodeAddedIncrement = 0;
}

function recordBaseline(document: vscode.TextDocument): void {
    if (!isTrackableDocument(document)) {
        return;
    }

    const key = document.uri.toString();
    if (!lastKnownLineCount.has(key)) {
        lastKnownLineCount.set(key, document.lineCount);
    }
}

export function activateCodeIncrementTracker(context: vscode.ExtensionContext): void {
    lastKnownLineCount.clear();
    accumulatedCodeAddedIncrement = 0;

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            calculateAndAccumulateCodeIncrement(document);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            recordBaseline(document);
        })
    );

    vscode.workspace.textDocuments.forEach(recordBaseline);
}

export function deactivateCodeIncrementTracker(): void {
    flushCodeIncrementReport();
    lastKnownLineCount.clear();
}
