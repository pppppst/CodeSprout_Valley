// 找到这部分代码并修改对应的值，没有的属性就加上
const mainWindow = new BrowserWindow({
  width: 1440,        // 悬浮窗不需要太大，改成 300
  height: 810,       // 高度改成 400
  show: false,
  autoHideMenuBar: true,
  transparent: true, // 【核心魔法】允许背景透明
  frame: false,      // 【核心魔法】隐藏 Windows 自带的标题栏（关闭、最小化按钮）
  hasShadow: false,  // 去除窗口阴影，让悬浮更纯粹
  // ... 下面的 webPreferences 等配置保持原样不要动
})