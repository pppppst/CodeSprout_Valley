import * as vscode from 'vscode';
import { reportActivityToElectronImmediately } from '../reportService';

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

const lastKnownLineCount = new Map<string, number>();

let accumulatedCodeAddedIncrement = 0;
let reportThrottleTimeout: NodeJS.Timeout | undefined;

function getReportThrottleMs(): number {
    const config = vscode.workspace.getConfiguration('csvalley');
    return config.get<number>('reportThrottleMs', 3000);
}

function isTrackableDocument(document: vscode.TextDocument): boolean {
    return document.uri.scheme === 'file' &&
        !document.isUntitled &&
        isSupportedCodePath(document.uri.fsPath);
}

function getDocumentKey(uri: vscode.Uri): string {
    return uri.toString();
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

type CommentSyntax = {
    line?: string[];
    block?: Array<[string, string]>;
};

const COMMENT_SYNTAX_BY_LANGUAGE = new Map<string, CommentSyntax>([
    ['bat', { line: ['REM ', 'rem ', '::'] }],
    ['c', { line: ['//'], block: [['/*', '*/']] }],
    ['cpp', { line: ['//'], block: [['/*', '*/']] }],
    ['csharp', { line: ['//'], block: [['/*', '*/']] }],
    ['css', { block: [['/*', '*/']] }],
    ['go', { line: ['//'], block: [['/*', '*/']] }],
    ['graphql', { line: ['#'] }],
    ['html', { block: [['<!--', '-->']] }],
    ['java', { line: ['//'], block: [['/*', '*/']] }],
    ['javascript', { line: ['//'], block: [['/*', '*/']] }],
    ['javascriptreact', { line: ['//'], block: [['/*', '*/']] }],
    ['jsonc', { line: ['//'], block: [['/*', '*/']] }],
    ['less', { line: ['//'], block: [['/*', '*/']] }],
    ['php', { line: ['//', '#'], block: [['/*', '*/']] }],
    ['powershell', { line: ['#'], block: [['<#', '#>']] }],
    ['python', { line: ['#'], block: [['"""', '"""'], ["'''", "'''"]] }],
    ['ruby', { line: ['#'] }],
    ['rust', { line: ['//'], block: [['/*', '*/']] }],
    ['scss', { line: ['//'], block: [['/*', '*/']] }],
    ['shellscript', { line: ['#'] }],
    ['sql', { line: ['--'], block: [['/*', '*/']] }],
    ['swift', { line: ['//'], block: [['/*', '*/']] }],
    ['typescript', { line: ['//'], block: [['/*', '*/']] }],
    ['typescriptreact', { line: ['//'], block: [['/*', '*/']] }],
    ['vue', { line: ['//'], block: [['/*', '*/'], ['<!--', '-->']] }],
    ['xml', { block: [['<!--', '-->']] }],
    ['yaml', { line: ['#'] }],
]);

function findMatchingToken(text: string, tokens: string[] | undefined, position: number): string | undefined {
    return tokens?.find(token => text.startsWith(token, position));
}

function findMatchingBlockStart(
    text: string,
    blockTokens: Array<[string, string]> | undefined,
    position: number
): [string, string] | undefined {
    return blockTokens?.find(([start]) => text.startsWith(start, position));
}

function stripCommentsFromText(text: string, syntax: CommentSyntax): string {
    let result = '';
    let blockEndToken: string | undefined;
    let quoteToken: string | undefined;
    let isEscaped = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (blockEndToken) {
            if (text.startsWith(blockEndToken, index)) {
                index += blockEndToken.length - 1;
                blockEndToken = undefined;
                continue;
            }

            if (character === '\r' || character === '\n') {
                result += character;
            }

            continue;
        }

        if (quoteToken) {
            result += character;

            if (isEscaped) {
                isEscaped = false;
                continue;
            }

            if (character === '\\') {
                isEscaped = true;
                continue;
            }

            if (character === quoteToken) {
                quoteToken = undefined;
            }

            continue;
        }

        const blockComment = findMatchingBlockStart(text, syntax.block, index);
        if (blockComment) {
            blockEndToken = blockComment[1];
            index += blockComment[0].length - 1;
            continue;
        }

        if (character === '"' || character === '\'' || character === '`') {
            quoteToken = character;
            result += character;
            continue;
        }

        const lineCommentToken = findMatchingToken(text, syntax.line, index);
        if (lineCommentToken) {
            const nextNewline = text.indexOf('\n', index + lineCommentToken.length);
            if (nextNewline === -1) {
                break;
            }

            result += text.slice(nextNewline, nextNewline + 1);
            index = nextNewline;
            continue;
        }

        result += character;
    }

    return result;
}

function getMeaningfulLineCount(document: vscode.TextDocument): number {
    const syntax = COMMENT_SYNTAX_BY_LANGUAGE.get(document.languageId);
    const text = syntax
        ? stripCommentsFromText(document.getText(), syntax)
        : document.getText();
    let meaningfulLines = 0;

    for (const line of text.split(/\r?\n/)) {
        if (line.trim().length > 0) {
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
        console.log(
            `[CS Valley] Code increment detected: ${diff} lines. file=${document.uri.fsPath}, previous=${lastLines}, current=${currentLines}.`
        );
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
