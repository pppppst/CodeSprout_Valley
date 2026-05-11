import * as vscode from 'vscode';
import { flushActivityBuffer, reportActivityToElectron } from './reportService';
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

    activateCodeIncrementTracker(context);
    activateErrorReporterTracker(context);
    activateCodingDurationTracker(context);

    const testReportCommand = vscode.commands.registerCommand('csvalley.sendTestReport', () => {
        vscode.window.showInformationMessage('CS Valley: Sending test activity report...');
        reportActivityToElectron({
            codeAdded: 10,
            errorCount: 1,
            codePassed: 2,
            codingDuration: 300
        });
        vscode.window.showInformationMessage('CS Valley: Test report queued.');
    });

    context.subscriptions.push(testReportCommand);
}

export async function deactivate(): Promise<void> {
    console.log('[CS Valley] Activity tracker plugin deactivating.');

    deactivateCodeIncrementTracker();
    deactivateErrorReporterTracker();
    deactivateCodingDurationTracker();
    await flushActivityBuffer();

    console.log('[CS Valley] Activity tracker plugin deactivated.');
}