

import * as vscode from 'vscode'; // 用于类型定义


/**

 * 报告给 CS Valley Electron 应用的活动数据接口

 */

export interface ActivityReportData {

    codeAdded?: number; //每次保存时新增的有效代码行数
    errorCount?: number;//文件从“无 Error 状态”进入“有 Error 状态”的增量。
    codePassed?: number;//文件达到或保持无 Error 级别诊断状态的增量。
    codingDuration?: number; //编码时长增量
    /** (可选) 其他通用信息，如用户ID, 项目ID, 时间戳等，如果Electron应用需要，需与后端协商 */

    // userId?: string;

    // projectId?: string;

    // timestamp?: number; // Unix timestamp in milliseconds

}


// 辅助类型定义 (供内部使用)

/**

 * 记录文件上次通过时间，或当前是否有错误的状态。

 * - 0: 文件从未被计数或重置为初始状态。

 * - -1: 文件当前有 Error。

 * - >0 (时间戳): 文件上次被计数为“通过”的时间。

 */

export type FilePassStateMap = Map<string, number>; // 使用 string (uri.toString()) 作为键

