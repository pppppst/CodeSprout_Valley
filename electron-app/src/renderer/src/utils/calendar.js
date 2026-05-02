import { Solar } from 'lunar-javascript';

/**
 * 获取某个日期当前处于的“节气时段”
 * @param {number} year - 公历年
 * @param {number} month - 公历月
 * @param {number} day - 公历日
 * @returns {string} 当前所属的节气名称（如 "立夏"）
 */
export function getActiveJieQi(year, month, day) {
  const lunar = Solar.fromYmd(year, month, day).getLunar();

  // 1. 第一步：先检查今天是不是刚好就是交节气的那一天
  let currentJieQi = lunar.getJieQi();

  // 2. 第二步：如果今天不是交节日，那就往前追溯，找最近刚刚过去的一个节气
  if (!currentJieQi) {
    // 这里的入参 true 非常重要！
    // 传 true 表示获取完整的 24 节气；如果不传，它只会获取 12 个“中气”
    const prevJieQiObj = lunar.getPrevJieQi(true); 
    
    // getPrevJieQi 返回的是一个对象，我们需要调用 getName() 拿到名称字符串
    currentJieQi = prevJieQiObj.getName(); 
  }

  return currentJieQi;
}