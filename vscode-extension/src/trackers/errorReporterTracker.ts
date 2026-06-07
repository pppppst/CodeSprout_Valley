import * as vscode from 'vscode';
import { reportActivityToElectronImmediately } from '../reportService';

const DIAGNOSTIC_SETTLE_MS = 1000;
const CODE_EXTENSIONS = [
    '.bat',
    '.c',
    '.cmd',
    '.cpp',
    '.cs',
    '.css',
    '.env',
    '.go',
    '.h',
    '.hpp',
    '.html',
    '.java',
    '.js',
    '.json',
    '.jsx',
    '.less',
    '.md',
    '.php',
    '.ps1',
    '.py',
    '.rb',
    '.rs',
    '.scss',
    '.sh',
    '.sql',
    '.toml',
    '.ts',
    '.tsx',
    '.vue',
    '.yaml',
    '.yml'
];
const CODE_FILENAMES = new Set([
    'dockerfile',
    'makefile',
    '.eslintrc',
    '.prettierrc'
]);
const EXCLUDED_DIRECTORIES = new Set([
    'node_modules',
    '.git',
    '.next',
    '.venv',
    'dist',
    'build',
    'out',
    'coverage'
]);

const activeFiles = new Set<string>();
const fileProblemState = new Map<string, boolean>();
const saveTimers = new Map<string, NodeJS.Timeout>();
let activeFilesDate = '';

function getBeijingDateString(date = new Date()): string {
    return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function ensureDailyStateFresh(): void {
    const today = getBeijingDateString();
    if (activeFilesDate === today) {
        return;
    }

    activeFiles.clear();
    fileProblemState.clear();
    activeFilesDate = today;
}

function isValidCodeFile(document: vscode.TextDocument): boolean {
    if (!isValidFileUri(document.uri) || document.isUntitled) {
        return false;
    }

    if (document.getText().trim().length === 0) {
        return false;
    }

    if (!isSupportedCodePath(document.uri.fsPath)) {
        return false;
    }

    return true;
}

function isValidNotebook(document: vscode.NotebookDocument): boolean {
    if (!isValidFileUri(document.uri)) {
        return false;
    }

    if (!document.uri.fsPath.toLowerCase().endsWith('.ipynb')) {
        return false;
    }

    if (!isSupportedCodePath(document.uri.fsPath)) {
        return false;
    }

    return document.getCells().some(cell => cell.document.getText().trim().length > 0);
}

function isValidFileUri(uri: vscode.Uri): boolean {
    return uri.scheme === 'file';
}

function isSupportedCodePath(fsPath: string): boolean {
    const normalizedPath = fsPath.toLowerCase().replace(/\\/g, '/');
    const pathParts = normalizedPath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    if (pathParts.some(part => EXCLUDED_DIRECTORIES.has(part))) {
        return false;
    }

    if (isGeneratedFile(normalizedPath)) {
        return false;
    }

    return CODE_EXTENSIONS.some(ext => normalizedPath.endsWith(ext)) || CODE_FILENAMES.has(fileName);
}

function isGeneratedFile(normalizedPath: string): boolean {
    return normalizedPath.endsWith('.d.ts') ||
        normalizedPath.includes('.generated.') ||
        normalizedPath.includes('.gen.') ||
        normalizedPath.includes('.min.') ||
        normalizedPath.includes('/generated/') ||
        normalizedPath.includes('/__generated__/');
}

function hasSevereProblem(document: vscode.TextDocument): boolean {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    return diagnostics.some(diagnostic => isSevereDiagnostic(diagnostic, document));
}

function isSevereDiagnostic(diagnostic: vscode.Diagnostic, document: vscode.TextDocument): boolean {
    if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
        return true;
    }

    if (diagnostic.severity !== vscode.DiagnosticSeverity.Warning) {
        return false;
    }

    if (!document.uri.fsPath.toLowerCase().endsWith('.py')) {
        return false;
    }

    const diagnosticCode = typeof diagnostic.code === 'object'
        ? diagnostic.code.value
        : diagnostic.code;
    const severePythonCodes = new Set([
        'reportUndefinedVariable',
        'reportInvalidSyntax',
        'reportOptionalMemberAccess',
        'reportAttributeAccessIssue',
        'reportMissingImports',
        'reportMissingModuleSource',
        'reportGeneralTypeIssues',
        'reportCallIssue',
        'reportArgumentType'
    ]);

    if (severePythonCodes.has(String(diagnosticCode))) {
        return true;
    }

    return /(not defined|undefined|unresolved import|missing import|syntax|type|no attribute|cannot import|import error|unexpected indent)/i.test(
        diagnostic.message
    );
}

function scheduleSavedDocumentProcessing(document: vscode.TextDocument): void {
    const fileKey = document.uri.fsPath;
    const oldTimer = saveTimers.get(fileKey);

    if (oldTimer) {
        clearTimeout(oldTimer);
    }

    const timer = setTimeout(() => {
        saveTimers.delete(fileKey);
        handleSavedDocument(document);
    }, DIAGNOSTIC_SETTLE_MS);

    saveTimers.set(fileKey, timer);
}

function handleSavedNotebook(document: vscode.NotebookDocument): void {
    ensureDailyStateFresh();

    if (!isValidNotebook(document)) {
        return;
    }

    const fileKey = document.uri.fsPath;
    if (activeFiles.has(fileKey)) {
        return;
    }

    activeFiles.add(fileKey);
    reportActivityToElectronImmediately({
        activeFileIncrement: 1,
        fixCountIncrement: 0
    });
    console.log('[CS Valley] Active notebook increment: 1.');
}

function handleSavedDocument(document: vscode.TextDocument): void {
    ensureDailyStateFresh();

    if (!isValidCodeFile(document)) {
        return;
    }

    const fileKey = document.uri.fsPath;
    const activeFileIncrement = activeFiles.has(fileKey) ? 0 : 1;
    const previousHasProblem = fileProblemState.get(fileKey) ?? false;
    const currentHasProblem = hasSevereProblem(document);
    const fixCountIncrement = previousHasProblem && !currentHasProblem ? 1 : 0;

    if (activeFileIncrement > 0) {
        activeFiles.add(fileKey);
    }

    fileProblemState.set(fileKey, currentHasProblem);

    if (activeFileIncrement <= 0 && fixCountIncrement <= 0) {
        return;
    }

    reportActivityToElectronImmediately({
        activeFileIncrement,
        fixCountIncrement
    });

    if (activeFileIncrement > 0) {
        console.log(`[CS Valley] Active file increment: ${activeFileIncrement}.`);
    }

    if (fixCountIncrement > 0) {
        console.log(`[CS Valley] Fix count increment: ${fixCountIncrement}.`);
    }
}

export function activateErrorReporterTracker(context: vscode.ExtensionContext): void {
    activeFiles.clear();
    fileProblemState.clear();
    activeFilesDate = getBeijingDateString();
    clearSaveTimers();

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            scheduleSavedDocumentProcessing(document);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveNotebookDocument(document => {
            handleSavedNotebook(document);
        })
    );
}

export function deactivateErrorReporterTracker(): void {
    clearSaveTimers();
    activeFiles.clear();
    fileProblemState.clear();
    activeFilesDate = '';
}

function clearSaveTimers(): void {
    saveTimers.forEach(timer => {
        clearTimeout(timer);
    });
    saveTimers.clear();
}
