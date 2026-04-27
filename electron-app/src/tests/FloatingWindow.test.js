import { describe, it, expect, beforeEach, vi } from 'vitest';
// 同样，引入开发同学“即将”或“正在”编写的类
import AppMainController from '../controllers/AppMainController.js';

describe('UC-FloatingWindow 桌面悬浮窗陪伴功能测试', () => {
  let controller;

  beforeEach(() => {
    controller = new AppMainController();
    
    // 【核心 Mock 技巧】伪造一个底层的 Electron 窗口对象和计时器
    controller.mainWindow = {
      setAlwaysOnTop: vi.fn(), // 伪造置顶 API
      setBounds: vi.fn(),      // 伪造修改坐标 API
    };
    
    controller.sessionTimer = {
      start: vi.fn(),
      pause: vi.fn(),
      isActive: false
    };
  });

  it('1. 开启悬浮模式：应请求透明置顶窗口，并启动代码专注计时器', () => {
    // Act: 模拟 UI 层点击了“开启悬浮窗”
    controller.enableFloatingMode();

    // Assert: 验证内部状态是否切换
    expect(controller.isFloatingMode).toBe(true);
    // 验证是否调用了 Electron 的置顶能力
    expect(controller.mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    // 验证计时器是否被正确启动
    expect(controller.sessionTimer.start).toHaveBeenCalled();
  });

  it('2. 悬浮交互监控：拖拽宠物时，应正确更新底层窗口的物理坐标', () => {
    // Arrange: 假设目前已经是悬浮状态
    controller.isFloatingMode = true;

    // Act: 模拟鼠标拖拽到了屏幕的 (150, 300) 坐标点
    controller.updateWindowPosition(150, 300);

    // Assert: 验证是否向底层窗口发送了最新的坐标更新指令
    expect(controller.mainWindow.setBounds).toHaveBeenCalledWith({ x: 150, y: 300 });
  });

  it('3. 恢复主界面：应取消置顶属性，并暂停/停止计时器', () => {
    // Arrange: 先处于悬浮状态
    controller.enableFloatingMode(); 

    // Act: 模拟用户双击恢复
    controller.restoreMainWindow();

    // Assert: 验证状态回滚
    expect(controller.isFloatingMode).toBe(false);
    expect(controller.mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(controller.sessionTimer.pause).toHaveBeenCalled();
  });
});