# 测试说明

本文档总结了当前仓库新增的测试代码与运行方式，便于后续维护与扩展。

## electron-app

已补充的单元测试（Vitest）：

- bubbleMessages 纯数据模块测试
- calendar 辅助函数测试
- cloudApi 请求封装测试（mock fetch，覆盖成功/失败/编码路径）

运行方式：

```bash
cd electron-app
npm test
```

## vscode-extension

### 单元测试（Vitest）

已补充的单元测试（mock VS Code API/计时器/网络）：

- utils/errorUtils
- reportService
- trackers/codeIncrementTracker
- trackers/codingDurationTracker
- trackers/errorReporterTracker

运行方式：

```bash
cd vscode-extension
npm run test:unit
```

说明：

- 单元测试已通过 Vitest 全局 setup 静音控制台输出，避免刷屏。

### 集成测试（VS Code Test Runner）

已补充的集成测试：

- 扩展激活后命令注册检查（csvalley.sendTestReport）

运行方式：

```bash
cd vscode-extension
npm run test:integration
```

说明：

- 集成测试会自动执行 tsc 编译后启动 VS Code 测试运行器。

## 目录参考

- electron-app 测试目录：electron-app/src/renderer/src/__tests__ 与 electron-app/src/renderer/src/utils/__tests__
- vscode-extension 单元测试目录：vscode-extension/src/__tests__ 与 vscode-extension/src/**/__tests__
- vscode-extension 集成测试目录：vscode-extension/src/test
