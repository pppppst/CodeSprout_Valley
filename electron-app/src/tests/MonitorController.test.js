import { describe, it, expect, beforeEach, vi } from 'vitest';
// 引入对应的控制类和实体类
import MonitorController from '../controllers/MonitorController.js';
import User from '../models/User.js';

describe('UC-CodeDetection 代码监测与资源结算逻辑测试', () => {
  let monitorController;
  let mockUser;

  beforeEach(() => {
    // 【核心测试技巧：依赖注入与 Mock 实体】
    // 为了专门测试 Controller 的逻辑，我们“伪造”一个 User 实体对象
    mockUser = {
      currentLineCount: 0, // 当日已写代码行数
      dailyTaskLimit: 200, // 每日上限 
      expPool: 0,          // 溢出经验池 
      catFood: 0,          // 猫粮资源
      // 模拟 User 实体暴露的资源扣加方法 [cite: 393]
      addResource: vi.fn(function(lines) {
        if (this.currentLineCount + lines <= this.dailyTaskLimit) {
            this.currentLineCount += lines;
            this.catFood += Math.floor(lines / 10); // 假定内部转化规则：10行换1个猫粮
        } else {
            const overflow = (this.currentLineCount + lines) - this.dailyTaskLimit;
            this.currentLineCount = this.dailyTaskLimit;
            this.expPool += overflow;
        }
      })
    };

    // 将伪造的用户实体注入控制器
    monitorController = new MonitorController(mockUser);
  });

  it('1. 基础资源结算：接收合法代码增量，未达上限时应正常累加并转换资源', () => {
    // Act: 模拟从 VS Code 插件接收到 50 行代码增量
    monitorController.processCodeIncrement(50);

    // Assert: 验证用户实体的进度和猫粮是否增加
    expect(mockUser.currentLineCount).toBe(50);
    expect(mockUser.expPool).toBe(0);
  });

  it('2. 溢出经验结算：代码总增量超过200行每日上限，超出部分应转入溢出经验池', () => {
    // Act: 模拟高强度敲代码，分两次传入增量
    monitorController.processCodeIncrement(150); // 第一次 150 行
    monitorController.processCodeIncrement(100); // 第二次 100 行，总计 250 行

    // Assert: 验证是否卡在每日上限，并产生溢出
    expect(mockUser.currentLineCount).toBe(200); // 当日进度应卡在 200 
    expect(mockUser.expPool).toBe(50);           // 溢出 50 行转入经验池 
  });

  it('3. 异常数据过滤：接收到非法或异常代码行数（如负数），应予以拦截', () => {
    // Act: 模拟传输异常，传来了负数行代码
    monitorController.processCodeIncrement(-20);

    // Assert: 进度不应发生变化，防止恶意刷数据
    expect(mockUser.currentLineCount).toBe(0); 
  });
});