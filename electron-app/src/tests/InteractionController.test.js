import { describe, it, expect, beforeEach, vi } from 'vitest';
// 引入即将编写的控制类和实体类
import InteractionController from '../controllers/InteractionController.js';

describe('UC-PetPlantCare 宠物与植物养成逻辑测试', () => {
  let interactionController;
  let mockUser;
  let mockPlant;
  let mockPet;

  beforeEach(() => {
    // 1. 伪造用户实体 (拥有资源)
    mockUser = {
      waterDrop: 5,
      catFood: 0,
      deductWater: vi.fn(function() {
        if (this.waterDrop > 0) {
          this.waterDrop -= 1;
          return true;
        }
        return false;
      }),
      deductFood: vi.fn(function() {
        if (this.catFood > 0) {
          this.catFood -= 1;
          return true;
        }
        return false;
      })
    };

    // 2. 伪造植物实体 (拥有成长值和阶段)
    mockPlant = {
      growthValue: 0,
      state: '幼苗',
      addGrowthValue: vi.fn(function(val) {
        this.growthValue += val;
        // 假设设定：成长值达到 10 时，升级为“抽枝展叶”
        if (this.growthValue >= 10 && this.state === '幼苗') {
          this.state = '抽枝展叶';
        }
      })
    };

    // 3. 伪造宠物实体
    mockPet = {
      growthValue: 0,
      animationState: 'idle',
      addGrowthValue: vi.fn(function(val) {
        this.growthValue += val;
        if (this.growthValue >= 5) {
          this.animationState = 'stretch'; // 解锁伸懒腰动画
        }
      })
    };

    // 将伪造的实体注入控制器
    interactionController = new InteractionController(mockUser, mockPlant, mockPet);
  });

  it('1. 资源不足拦截：猫粮不足时喂食宠物，应被拦截且成长值不变', () => {
    // Act: 模拟点击喂食 (此时 mockUser.catFood 为 0)
    const result = interactionController.interactFeed();

    // Assert: 验证交互失败，且宠物未成长
    expect(result).toBe(false);
    expect(mockUser.deductFood).toHaveBeenCalled();
    expect(mockPet.growthValue).toBe(0);
  });

  it('2. 正常养成扣除：水滴充足时浇水，应扣除水滴并增加植物成长值', () => {
    // Act: 模拟点击浇水 (此时 mockUser.waterDrop 为 5)
    const result = interactionController.interactWater();

    // Assert: 验证交互成功，水滴减少，植物成长值增加
    expect(result).toBe(true);
    expect(mockUser.waterDrop).toBe(4);
    expect(mockPlant.addGrowthValue).toHaveBeenCalledWith(1); // 假设每次浇水增加 1 点成长值
  });

  it('3. 阶段性升级判定：植物成长值达到升级阈值时，应触发阶段演化', () => {
    // Arrange: 将植物的成长值垫高到即将升级的临界点
    mockPlant.growthValue = 9;

    // Act: 触发一次成功的浇水
    interactionController.interactWater();

    // Assert: 验证植物状态是否成功从“幼苗”跃迁至“抽枝展叶”
    expect(mockPlant.growthValue).toBe(10);
    expect(mockPlant.state).toBe('抽枝展叶');
  });

  it('4. 宠物动画解锁：宠物成长值达标后，应解锁新的待机动画库', () => {
    // Arrange: 强制给点猫粮
    mockUser.catFood = 10;
    mockPet.growthValue = 4;

    // Act: 喂食
    interactionController.interactFeed();

    // Assert: 验证动画状态更新
    expect(mockPet.growthValue).toBe(5);
    expect(mockPet.animationState).toBe('stretch');
  });
});