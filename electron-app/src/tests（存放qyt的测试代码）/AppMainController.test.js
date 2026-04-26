import { describe, it, expect, beforeEach } from 'vitest';
// 引入开发同学“即将”编写的类
import AppMainController from '../controllers/AppMainController.js';

describe('AppMainController 核心逻辑测试', () => {
  let controller;

  beforeEach(() => {
    // 每次测试前，实例化一个全新的控制器，确保状态干净，不互相干扰
    controller = new AppMainController();
  });

  it('初始状态下，当日代码量应为 0，任务上限为 200', () => {
    expect(controller.currentLineCount).toBe(0);
    expect(controller.dailyTaskLimit).toBe(200);
  });

  it('当代码增量未达上限时，应正常累加至当日进度', () => {
    // 假设开发同学将提供一个增加代码行数的方法
    controller.addCodeLines(50);
    expect(controller.currentLineCount).toBe(50);
    // 此时不应产生溢出经验
    expect(controller.calculateOverflowExp()).toBe(0);
  });

  it('当代码增量超出 200 行上限时，超出部分应转入溢出经验池', () => {
    controller.addCodeLines(250);
    // 当日进度应卡在 200 的上限
    expect(controller.currentLineCount).toBe(200);
    // 超出的 50 行应转化为溢出经验
    expect(controller.calculateOverflowExp()).toBe(50);
  });
});