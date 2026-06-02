import * as vscode from 'vscode';
import {
    clearPendingActivityCache,
    flushActivityBuffer,
    initializeReportService,
    reportActivityToElectronImmediately
} from './reportService';
import {
    activateCodeIncrementTracker,
    deactivateCodeIncrementTracker
} from './trackers/codeIncrementTracker';
import {
    activateErrorReporterTracker,
    deactivateErrorReporterTracker
} from './trackers/errorReporterTracker';
import {
    activateCodingDurationTracker,
    deactivateCodingDurationTracker
} from './trackers/codingDurationTracker';

export function activate(context: vscode.ExtensionContext): void {
    console.log('[CS Valley] Activity tracker plugin activated.');

    initializeReportService(context);
    activateCodeIncrementTracker(context);
    activateErrorReporterTracker(context);
    activateCodingDurationTracker(context);

    const testReportCommand = vscode.commands.registerCommand('csvalley.sendTestReport', () => {
        vscode.window.showInformationMessage('CS Valley: Sending test activity report...');
        reportActivityToElectronImmediately({
            activeFileIncrement: 1
        });
        vscode.window.showInformationMessage('CS Valley: Test report queued.');
    });

    const clearCacheCommand = vscode.commands.registerCommand('csvalley.clearPendingReportCache', async () => {
        await clearPendingActivityCache();
        vscode.window.showInformationMessage('CS Valley: Pending report cache cleared.');
    });

    context.subscriptions.push(testReportCommand);
    context.subscriptions.push(clearCacheCommand);
}

export async function deactivate(): Promise<void> {
    console.log('[CS Valley] Activity tracker plugin deactivating.');

    deactivateCodeIncrementTracker();
    deactivateErrorReporterTracker();
    deactivateCodingDurationTracker();
    await flushActivityBuffer();

    console.log('[CS Valley] Activity tracker plugin deactivated.');
}
