import * as vscode from 'vscode';
import { reportActivityToElectronImmediately } from '../reportService';

let isCodingActive = false;
let accumulatedDurationIncrement = 0;
let lastAccumulationTime = 0;
let activityDebounceTimeout: NodeJS.Timeout | undefined;
let durationAccumulationInterval: NodeJS.Timeout | undefined;
let reportTriggerInterval: NodeJS.Timeout | undefined;

function getCodingActivityDebounceMs(): number {
    const config = vscode.workspace.getConfiguration('csvalley');
    return config.get<number>('codingActivityDebounceMs', 5000);
}

function getCodingDurationReportIntervalMs(): number {
    const config = vscode.workspace.getConfiguration('csvalley');
    return config.get<number>('codingDurationReportIntervalMs', 60000);
}

function isTrackableDocument(document: vscode.TextDocument): boolean {
    return document.uri.scheme === 'file' && !document.isUntitled;
}

function markUserActive(): void {
    if (activityDebounceTimeout) {
        clearTimeout(activityDebounceTimeout);
    }

    activityDebounceTimeout = setTimeout(() => {
        isCodingActive = false;
        stopAccumulationAndReporting();
        triggerDurationReport();
        console.log('[CS Valley] Coding activity paused.');
    }, getCodingActivityDebounceMs());

    if (!isCodingActive) {
        isCodingActive = true;
        startAccumulationAndReporting();
        console.log('[CS Valley] Coding activity started.');
    }
}

function accumulateDuration(): void {
    if (!isCodingActive) {
        return;
    }

    const now = Date.now();
    const elapsedMs = lastAccumulationTime === 0 ? 1000 : now - lastAccumulationTime;
    const elapsedSeconds = elapsedMs / 1000;

    accumulatedDurationIncrement += Math.min(elapsedSeconds, 5);
    lastAccumulationTime = now;
}

function triggerDurationReport(): void {
    const durationToSend = Math.round(accumulatedDurationIncrement);
    if (durationToSend <= 0) {
        accumulatedDurationIncrement = 0;
        return;
    }

    reportActivityToElectronImmediately({ codingDuration: durationToSend });
    accumulatedDurationIncrement = 0;
    console.log(`[CS Valley] Coding duration increment: ${durationToSend} seconds.`);
}

function startAccumulationAndReporting(): void {
    if (!durationAccumulationInterval) {
        lastAccumulationTime = Date.now();
        durationAccumulationInterval = setInterval(accumulateDuration, 1000);
    }

    if (!reportTriggerInterval) {
        reportTriggerInterval = setInterval(triggerDurationReport, getCodingDurationReportIntervalMs());
    }
}

function stopAccumulationAndReporting(): void {
    if (durationAccumulationInterval) {
        clearInterval(durationAccumulationInterval);
        durationAccumulationInterval = undefined;
    }

    if (reportTriggerInterval) {
        clearInterval(reportTriggerInterval);
        reportTriggerInterval = undefined;
    }

    lastAccumulationTime = 0;
}

export function activateCodingDurationTracker(context: vscode.ExtensionContext): void {
    isCodingActive = false;
    accumulatedDurationIncrement = 0;
    lastAccumulationTime = 0;

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        if (event.contentChanges.length > 0 && isTrackableDocument(event.document)) {
            markUserActive();
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
        if (isTrackableDocument(document)) {
            markUserActive();
        }
    }));

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && isTrackableDocument(editor.document)) {
            markUserActive();
        }
    }));

    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
        if (
            event.textEditor === vscode.window.activeTextEditor &&
            isTrackableDocument(event.textEditor.document) &&
            event.selections.some(selection => !selection.isEmpty)
        ) {
            markUserActive();
        }
    }));
}

export function deactivateCodingDurationTracker(): void {
    if (activityDebounceTimeout) {
        clearTimeout(activityDebounceTimeout);
        activityDebounceTimeout = undefined;
    }

    stopAccumulationAndReporting();
    triggerDurationReport();
    isCodingActive = false;
}
