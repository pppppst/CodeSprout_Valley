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

function getDocumentKey(uri: vscode.Uri): string {
    return uri.toString();
}

function getMeaningfulLineCount(document: vscode.TextDocument): number {
    let meaningfulLines = 0;

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        if (document.lineAt(lineIndex).text.trim().length > 0) {
            meaningfulLines++;
        }
    }

    return meaningfulLines;
}

function calculateAndAccumulateCodeIncrement(document: vscode.TextDocument): void {
    if (!isTrackableDocument(document)) {
        return;
    }

    const uriStr = getDocumentKey(document.uri);
    const currentLines = getMeaningfulLineCount(document);
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

    const incrementToReport = accumulatedCodeAddedIncrement;

    try {
        reportActivityToElectronImmediately({ codeAdded: incrementToReport });
        accumulatedCodeAddedIncrement -= incrementToReport;
        console.log(`[CS Valley] Code increment: ${incrementToReport} lines.`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[CS Valley] Failed to queue code increment report: ${message}`);
        scheduleCodeIncrementReport();
    }
}

function recordBaseline(document: vscode.TextDocument): void {
    if (!isTrackableDocument(document)) {
        return;
    }

    const key = getDocumentKey(document.uri);
    if (!lastKnownLineCount.has(key)) {
        lastKnownLineCount.set(key, getMeaningfulLineCount(document));
    }
}

function handleRenamedFiles(event: vscode.FileRenameEvent): void {
    for (const file of event.files) {
        const oldKey = getDocumentKey(file.oldUri);
        const newKey = getDocumentKey(file.newUri);
        const childKeyPrefix = `${oldKey}/`;
        const renamedEntries = Array.from(lastKnownLineCount.entries()).filter(([key]) =>
            key === oldKey || key.startsWith(childKeyPrefix)
        );

        for (const [key, previousLineCount] of renamedEntries) {
            const movedKey = key === oldKey
                ? newKey
                : `${newKey}/${key.slice(childKeyPrefix.length)}`;

            lastKnownLineCount.delete(key);
            lastKnownLineCount.set(movedKey, previousLineCount);
        }
    }
}

function handleDeletedFiles(event: vscode.FileDeleteEvent): void {
    for (const uri of event.files) {
        const deletedKey = getDocumentKey(uri);
        const childKeyPrefix = `${deletedKey}/`;

        for (const key of Array.from(lastKnownLineCount.keys())) {
            if (key === deletedKey || key.startsWith(childKeyPrefix)) {
                lastKnownLineCount.delete(key);
            }
        }
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

    context.subscriptions.push(
        vscode.workspace.onDidRenameFiles(event => {
            handleRenamedFiles(event);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidDeleteFiles(event => {
            handleDeletedFiles(event);
        })
    );

    vscode.workspace.textDocuments.forEach(recordBaseline);
}

export function deactivateCodeIncrementTracker(): void {
    flushCodeIncrementReport();
    lastKnownLineCount.clear();
}
