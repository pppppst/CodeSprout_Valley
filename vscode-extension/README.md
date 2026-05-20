# CodeSprout Valley Tracker

CodeSprout Valley Tracker 是一个 VS Code 扩展，用于收集用户在 VS Code 中的编程活动，并将统计结果上报给 CodeSprout Valley Electron 桌面应用。

插件当前主要统计三类数据：

- 代码新增行数
- 代码诊断结果，包括错误次数和通过次数
- 编程活跃时长

## 功能

### 代码增量统计

插件会在文件保存时统计当前文件的行数变化。

当同一个文件本次保存后的行数大于上次记录的行数时，差值会被计入 `codeAdded`。插件只统计新增行数，不会因为删除代码而扣减历史数据。

### 错误与通过统计

插件会在代码文件保存后读取 VS Code 的诊断信息，并根据诊断结果上报：

- `errorCount`：文件保存后存在阻塞性错误
- `codePassed`：文件保存后没有阻塞性错误

当前支持的代码文件后缀包括：

- `.py`
- `.c`
- `.cpp`
- `.js`
- `.ts`
- `.java`
- `.go`

对于 Python 文件，插件除了识别 VS Code 的 Error 级别诊断外，也会把部分严重 Warning 视为阻塞性错误，例如未定义变量、语法错误、属性访问错误、导入错误等。

### 编程时长统计

插件会根据用户在 VS Code 中的实际活动计算编程时长。

以下行为会被视为编程活动：

- 编辑文件
- 保存文件
- 切换到代码编辑器
- 在当前编辑器中选中文本

如果一段时间内没有新的活动，插件会认为当前编程活动暂停，并把已累计的时长上报给 Electron 应用。

### 本地失败缓存

插件在上报数据前，会先把待上报的增量数据写入 VS Code 扩展的本地持久存储。

如果 Electron 应用没有启动、接口不可访问、请求超时，或服务端返回非成功状态码，数据不会丢失，而是会保留在本地缓存中。插件会定时重试发送缓存数据。

缓存逻辑位于：

```text
src/reportService.ts
```

本地缓存使用的 key 为：

```text
csvalley.pendingActivityReportData
```

缓存数据会在以下时机尝试补发：

- 插件启动后
- 新的活动数据产生时
- 上一次发送失败后的定时重试
- 插件停用前

发送成功后，已成功上报的增量会从本地缓存中移除。

## 上报数据格式

插件会通过 HTTP POST 将活动数据发送给 Electron 应用。

默认地址为：

```text
http://127.0.0.1:3001/activity-report
```

示例 payload：

```json
{
  "codeAdded": 10,
  "errorCount": 1,
  "codePassed": 2,
  "codingDuration": 300,
  "timestamp": 1778490000000
}
```

字段说明：

| 字段 | 含义 |
| --- | --- |
| `codeAdded` | 新增代码行数 |
| `errorCount` | 保存后存在阻塞性错误的次数 |
| `codePassed` | 保存后没有阻塞性错误的次数 |
| `codingDuration` | 编程活跃时长增量，单位为秒 |
| `timestamp` | 插件生成上报数据时的时间戳 |

## 配置项

可以在 VS Code 设置中搜索 `csvalley` 修改插件配置。

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `csvalley.electronPort` | `3001` | Electron 本地服务端口 |
| `csvalley.reportPath` | `/activity-report` | Electron 接收活动数据的 HTTP POST 路径 |
| `csvalley.reportThrottleMs` | `3000` | 代码增量上报节流间隔，单位毫秒 |
| `csvalley.codingActivityDebounceMs` | `5000` | 多久没有活动后认为编程暂停，单位毫秒 |
| `csvalley.codingDurationReportIntervalMs` | `60000` | 活跃期间编程时长上报间隔，单位毫秒 |

## 本地开发运行

进入扩展目录：

```powershell
cd vscode-extension
```

安装依赖：

```powershell
npm install
```

编译：

```powershell
npm run compile
```

在 VS Code 中打开 `vscode-extension` 目录后，按 `F5` 启动 Extension Development Host。

新打开的 VS Code 窗口中会加载该扩展。此时可以编辑并保存代码文件，观察插件是否向 Electron 应用上报活动数据。

## 测试上报

插件提供了一个测试命令：

```text
CS Valley: Send Test Report
```

可以在 VS Code 命令面板中运行该命令。运行后插件会发送一条测试活动数据：

```json
{
  "codeAdded": 10,
  "errorCount": 1,
  "codePassed": 2,
  "codingDuration": 300
}
```

## 构建 VSIX

当前目录中已经包含一个示例打包文件：

```text
codetracker-0.0.1.vsix
```

如需重新打包，可以使用 VS Code Extension 相关工具重新生成 VSIX。

## 主要源码结构

```text
src/
  extension.ts
  reportService.ts
  types.ts
  trackers/
    codeIncrementTracker.ts
    codingDurationTracker.ts
    errorReporterTracker.ts
  utils/
    errorUtils.ts
```

核心文件说明：

| 文件 | 说明 |
| --- | --- |
| `src/extension.ts` | 插件入口，负责激活各个 tracker 和测试命令 |
| `src/reportService.ts` | 上报服务，负责数据合并、发送、本地缓存和失败重试 |
| `src/trackers/codeIncrementTracker.ts` | 统计保存时的代码新增行数 |
| `src/trackers/errorReporterTracker.ts` | 统计保存后的错误或通过状态 |
| `src/trackers/codingDurationTracker.ts` | 统计用户编程活跃时长 |
| `src/types.ts` | 活动数据类型定义 |

