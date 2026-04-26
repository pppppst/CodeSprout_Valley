// src/utils/errorUtils.ts
import * as vscode from 'vscode';

/**
 * 为 VS Code 诊断信息生成一个唯一且稳定的字符串键。
 * (目前 errorCount 不再直接依赖此键进行累加，但可作为辅助或调试工具)
 * @param diagnostic vscode.Diagnostic 对象
 * @returns {string} 诊断的唯一键
 */
export function getErrorKey(diagnostic: vscode.Diagnostic): string {
    return `${diagnostic.source || 'unknown'}:${diagnostic.code || 'no-code'}:${diagnostic.message}:${diagnostic.range.start.line}:${diagnostic.range.start.character}`;
}

/**
 * 判断一个诊断是否为 Error 级别
 * @param diagnostic vscode.Diagnostic 对象
 * @returns {boolean} 如果是 Error 级别，返回 true
 */
export function isErrorSeverity(diagnostic: vscode.Diagnostic): boolean {
    return diagnostic.severity === vscode.DiagnosticSeverity.Error;
}