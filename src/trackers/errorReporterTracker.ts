import * as vscode from 'vscode';
import { reportActivityToElectron } from '../reportService';

// 会话累计报错次数
let cumulativeErrorCountInSession = 0;

// 上报节流定时器
let errorReportTimeout: NodeJS.Timeout | undefined;
let passReportTimeout: NodeJS.Timeout | undefined;

// 节流上报间隔 3秒
const REPORT_THROTTLE_MS = 3000;

// 需要统计的代码后缀
const CODE_EXTENSIONS = [
    '.py', '.c', '.cpp', '.js', '.ts', '.java', '.go'
];

/**
 * 检测错误：
 * 1. 所有语言：优先认红色 Error
 * 2. Python：额外把【重要警告】当成错误（未定义变量/语法问题）
 * 解决 Python 只报 Warning 不报错的问题
 */
function hasRedError(uri: vscode.Uri): boolean {
  const diagnostics = vscode.languages.getDiagnostics(uri);
  const isPythonFile = uri.fsPath.toLowerCase().endsWith('.py');

  return diagnostics.some(d => {
    // 1. 通用逻辑：如果是 Error 级别，直接判错
    if (d.severity === vscode.DiagnosticSeverity.Error) return true;

    // 2. Python 深度检测
    if (isPythonFile) {
      // 检查 Pylance/Pyright 的错误代码 (比字符串匹配稳得多)
      // 常见代码参考：reportUndefinedVariable, reportInvalidSyntax, reportGeneralTypeIssues
      const diagnosticCode = typeof d.code === 'object' ? d.code.value : d.code;
      
      const fatalPythonCodes = [
        "reportUndefinedVariable",
        "reportInvalidSyntax",
        "reportOptionalMemberAccess", // 访问 None 对象的属性
        "reportAttributeAccessIssue"
      ];

      if (fatalPythonCodes.includes(String(diagnosticCode))) return true;

      // 3. 增强版关键词匹配 (针对一些不带 Code 的警告)
      const msg = d.message.toLowerCase();
      const fatalRegex = /(not defined|undefined|syntax|no attribute|cannot import|import error|unexpected indent)/;
      
      if (d.severity === vscode.DiagnosticSeverity.Warning && fatalRegex.test(msg)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * 报错统一节流上报
 */
function triggerErrorReport() {
    if (errorReportTimeout) clearTimeout(errorReportTimeout);
    errorReportTimeout = setTimeout(() => {
        if (cumulativeErrorCountInSession > 0) {
            console.log("报错增量：" + cumulativeErrorCountInSession);
            reportActivityToElectron({ errorCount: cumulativeErrorCountInSession });
            cumulativeErrorCountInSession = 0;
        }
    }, REPORT_THROTTLE_MS);
}

/**
 * 通过统一节流上报
 */
function triggerPassReport() {
    if (passReportTimeout) clearTimeout(passReportTimeout);
    passReportTimeout = setTimeout(() => {
        console.log("通过增量： 1");
        reportActivityToElectron({ codePassed: 1 });
    }, REPORT_THROTTLE_MS);
}

/**
 * 保存事件核心处理（已删除冷却）
 */
async function onDocumentSaved(doc: vscode.TextDocument) {
    const uri = doc.uri;

    // 非指定代码文件，不参与统计
    const path = uri.fsPath.toLowerCase();
    const isCode = CODE_EXTENSIONS.some(ext => path.endsWith(ext));
    if (!isCode) {
        return;
    }
    // 关键：等待 800ms 左右，给 Python 插件留出生成红线的时间
    await new Promise(resolve => setTimeout(resolve, 800));
    // 判断是否有红错，二选一计数上报
    if (hasRedError(uri)) {
        cumulativeErrorCountInSession++;
        triggerErrorReport();
    } else {
        triggerPassReport();
    }
}

export function activateErrorReporterTracker(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(onDocumentSaved)
    );
}

export function deactivateErrorReporterTracker(context: vscode.ExtensionContext) {
    if (errorReportTimeout) clearTimeout(errorReportTimeout);
    if (passReportTimeout) clearTimeout(passReportTimeout);
}