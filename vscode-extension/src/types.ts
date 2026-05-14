import * as vscode from 'vscode'; // 用于类型定义


/**

 * 报告给 CS Valley Electron 应用的活动数据接口

 */

export interface ActivityReportData {

    codeAdded?: number; //每次保存时新增的有效代码行数
    errorCount?: number;//文件从“无 Error 状态”进入“有 Error 状态”的增量。
    codePassed?: number;//文件达到或保持无 Error 级别诊断状态的增量。
    codingDuration?: number; //编码时长增量
   
}


