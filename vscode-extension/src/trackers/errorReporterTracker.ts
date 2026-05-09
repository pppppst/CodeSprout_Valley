import * as vscode from 'vscode';
import { reportActivityToElectron } from '../reportService';

const REPORT_THROTTLE_MS = 3000;
const DIAGNOSTIC_SETTLE_MS = 800;
const CODE_EXTENSIONS = ['.py', '.c', '.cpp', '.js', '.ts', '.java', '.go'];

const previousErrorStateByFile = new Map<string, boolean>();

let pendingErrorCount = 0;
let pendingPassCount = 0;
let reportTimeout: NodeJS.Timeout | undefined;

function isTrackableCodeDocument(document: vscode.TextDocument): boolean {
    if (document.uri.scheme !== 'file' || document.isUntitled) {
        return false;
    }

    const path = document.uri.fsPath.toLowerCase();
    return CODE_EXTENSIONS.some(ext => path.endsWith(ext));
}

function hasBlockingDiagnostic(uri: vscode.Uri): boolean {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const isPythonFile = uri.fsPath.toLowerCase().endsWith('.py');

    return diagnostics.some(diagnostic => {
        if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
            return true;
        }

        if (!isPythonFile || diagnostic.severity !== vscode.DiagnosticSeverity.Warning) {
            return false;
        }

        const diagnosticCode = typeof diagnostic.code === 'object'
            ? diagnostic.code.value
            : diagnostic.code;
        const fatalPythonCodes = new Set([
            'reportUndefinedVariable',
            'reportInvalidSyntax',
            'reportOptionalMemberAccess',
            'reportAttributeAccessIssue'
        ]);

        if (fatalPythonCodes.has(String(diagnosticCode))) {
            return true;
        }

        return /(not defined|undefined|syntax|no attribute|cannot import|import error|unexpected indent)/i.test(
            diagnostic.message
        );
    });
}

function scheduleDiagnosticReport(): void {
    if (reportTimeout) {
        clearTimeout(reportTimeout);
    }

    reportTimeout = setTimeout(() => {
        flushDiagnosticReport();
    }, REPORT_THROTTLE_MS);
}

function flushDiagnosticReport(): void {
    if (reportTimeout) {
        clearTimeout(reportTimeout);
        reportTimeout = undefined;
    }

    if (pendingErrorCount > 0) {
        reportActivityToElectron({ errorCount: pendingErrorCount });
        console.log(`[CS Valley] Error increment: ${pendingErrorCount}.`);
        pendingErrorCount = 0;
    }

    if (pendingPassCount > 0) {
        reportActivityToElectron({ codePassed: pendingPassCount });
        console.log(`[CS Valley] Pass increment: ${pendingPassCount}.`);
        pendingPassCount = 0;
    }
}

async function onDocumentSaved(document: vscode.TextDocument): Promise<void> {
    if (!isTrackableCodeDocument(document)) {
        return;
    }

    await new Promise(resolve => setTimeout(resolve, DIAGNOSTIC_SETTLE_MS));

    const fileKey = document.uri.toString();
    const hasError = hasBlockingDiagnostic(document.uri);
    const previousHasError = previousErrorStateByFile.get(fileKey);

    if (previousHasError === undefined) {
        previousErrorStateByFile.set(fileKey, hasError);
        return;
    }

    if (!previousHasError && hasError) {
        pendingErrorCount += 1;
        scheduleDiagnosticReport();
    } else if (previousHasError && !hasError) {
        pendingPassCount += 1;
        scheduleDiagnosticReport();
    }

    previousErrorStateByFile.set(fileKey, hasError);
}

export function activateErrorReporterTracker(context: vscode.ExtensionContext): void {
    previousErrorStateByFile.clear();
    pendingErrorCount = 0;
    pendingPassCount = 0;

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            void onDocumentSaved(document);
        })
    );
}

export function deactivateErrorReporterTracker(): void {
    flushDiagnosticReport();
    previousErrorStateByFile.clear();
}
