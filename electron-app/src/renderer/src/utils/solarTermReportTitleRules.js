/**
 * @typedef {Object} SolarTermReportStats
 * @property {number} codeAdded
 * @property {number} activeFileCount
 * @property {number} fixCount
 * @property {number} codingDurationMinutes
 */

/**
 * @typedef {Object} TitleRule
 * @property {string} id
 * @property {string} title
 * @property {string} slogan
 * @property {number} priority
 * @property {(stats: SolarTermReportStats) => boolean} match
 * @property {(stats: SolarTermReportStats) => string} reason
 */

function formatHours(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0))
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  if (hours <= 0) return `${mins} 分钟`
  if (mins <= 0) return `${hours} 小时`
  return `${hours} 小时 ${mins} 分钟`
}

export const titleSlogans = {
  bug_healer: {
    title: 'Bug 治愈师',
    slogan: '不是所有英雄都披披风，\n有些人在修 Bug。'
  },
  red_line_expert: {
    title: '红线拆弹专家',
    slogan: '我赌你的代码，\n没有 Bug。'
  },
  code_doctor: {
    title: '代码急诊科主任',
    slogan: '患者病情稳定，\n系统暂时恢复呼吸。'
  },
  compiler_therapist: {
    title: '编译器心理医生',
    slogan: '你负责写代码，\n也负责安抚编译器情绪。'
  },
  bug_tamer: {
    title: '祖传 Bug 驯兽师',
    slogan: '有些 Bug 很野，\n但你更野。'
  },
  code_sower: {
    title: '代码播种员',
    slogan: '键盘敲得很响，\n种子埋得很深。'
  },
  productive_dev: {
    title: '高产开发者',
    slogan: '今天的键盘，\n工时拉满。'
  },
  construction_team: {
    title: '疯狂施工队',
    slogan: '这里改一点，\n那里再推倒重来。'
  },
  hardcore_coder: {
    title: '无敌爆肝王',
    slogan: 'CPU 降温了，\n你还没有。'
  },
  code_generator: {
    title: '人形代码生成器',
    slogan: '说吧，\n你是不是偷偷接入了 AI。'
  },
  file_inspector: {
    title: '文件巡查员',
    slogan: '项目这么大，\n你偏偏都去过。'
  },
  module_walker: {
    title: '模块穿梭者',
    slogan: '今天的你，\n依旧四处串门。'
  },
  project_roamer: {
    title: '项目漫游者',
    slogan: '这边看看，\n那边也看看。'
  },
  fullstack_ranger: {
    title: '全栈游侠',
    slogan: '前端认识你，\n后端也认识你。'
  },
  code_cartographer: {
    title: '代码地图绘制师',
    slogan: '如果项目是迷宫，\n你已经快通关了。'
  },
  focus_gardener: {
    title: '专注园丁',
    slogan: '凌晨的月亮见过你，\n清晨的太阳也见过你。'
  },
  night_farmer: {
    title: '深夜耕作者',
    slogan: '别人已经下线，\n你刚进入状态。'
  },
  time_master: {
    title: '时间管理大师',
    slogan: '一天还是 24 小时，\n但你用了两份。'
  },
  liver_candidate: {
    title: '爆肝预备役',
    slogan: '离爆肝王，\n只差一次通宵。'
  },
  no_sleep_human: {
    title: '人类不需要睡眠',
    slogan: '系统建议：\n请及时补充睡眠。'
  },
  code_archaeologist: {
    title: '祖传代码考古学家',
    slogan: '你翻开的每一层，\n都是前人留下的谜题。'
  },
  project_tourist: {
    title: '项目观光客',
    slogan: '来过很多地方，\n暂时还没决定住哪儿。'
  },
  debug_survivor: {
    title: '调试地狱幸存者',
    slogan: '问题没有打败你，\n只是磨掉了一点头发。'
  },
  one_shot_hero: {
    title: '一次过战神',
    slogan: '代码写完了，\n头发还在。'
  },
  firefighter: {
    title: '全项目救火队长',
    slogan: '哪里冒烟，\n你就出现在哪里。'
  },
  requirement_finisher: {
    title: '需求终结者',
    slogan: '需求提得很快，\n你写得更快。'
  },
  refactor_artist: {
    title: '重构艺术家',
    slogan: '代码变少了，\n价值却变多了。'
  },
  release_officer: {
    title: '版本发布官',
    slogan: '这一版终于能发了，\n今晚可以睡个好觉。'
  },
  solar_term_mvp: {
    title: '节气 MVP',
    slogan: '这个节气，\n你是真的在写代码。'
  },
  valley_guardian: {
    title: '山谷守护者',
    slogan: '代码会记得，\n你来过这里。'
  },
  valley_legend: {
    title: '代码山谷传说',
    slogan: '有人在写代码，\n有人正在成为传说。'
  }
}

const defaultTitle = {
  id: 'valley_guardian',
  ...titleSlogans.valley_guardian,
  priority: 0,
  reason: () => '因为这个节气还在悄悄积累，新的记录会继续生长。'
}

function createRule(id, priority, match, reason) {
  const sloganConfig = titleSlogans[id]
  return {
    id,
    title: sloganConfig.title,
    slogan: sloganConfig.slogan,
    priority,
    match,
    reason
  }
}

/** @type {TitleRule[]} */
export const titleRules = [
  createRule(
    'valley_legend',
    1000,
    ({ codeAdded, activeFileCount, fixCount, codingDurationMinutes }) =>
      codeAdded >= 1500 && activeFileCount >= 20 && fixCount >= 15 && codingDurationMinutes >= 720,
    ({ codeAdded, activeFileCount, fixCount, codingDurationMinutes }) =>
      `因为你新增了 ${codeAdded} 行有效代码，活跃于 ${activeFileCount} 个文件，完成 ${fixCount} 次问题修复，并专注开发 ${formatHours(codingDurationMinutes)}。`
  ),
  createRule(
    'solar_term_mvp',
    950,
    ({ codeAdded, activeFileCount, fixCount }) =>
      codeAdded >= 800 && activeFileCount >= 12 && fixCount >= 8,
    ({ codeAdded, activeFileCount, fixCount }) =>
      `因为你新增了 ${codeAdded} 行有效代码，活跃于 ${activeFileCount} 个文件，并完成了 ${fixCount} 次问题修复。`
  ),
  createRule(
    'firefighter',
    910,
    ({ activeFileCount, fixCount }) => activeFileCount >= 18 && fixCount >= 12,
    ({ activeFileCount, fixCount }) =>
      `因为你活跃于 ${activeFileCount} 个文件，并完成了 ${fixCount} 次问题修复。`
  ),
  createRule(
    'debug_survivor',
    880,
    ({ fixCount, codingDurationMinutes }) => fixCount >= 15 && codingDurationMinutes >= 360,
    ({ fixCount, codingDurationMinutes }) =>
      `因为你完成了 ${fixCount} 次问题修复，并专注开发 ${formatHours(codingDurationMinutes)}。`
  ),
  createRule(
    'code_archaeologist',
    840,
    ({ activeFileCount, codeAdded }) => activeFileCount >= 20 && codeAdded < 300,
    ({ activeFileCount }) => `因为你在 ${activeFileCount} 个文件之间认真巡查。`
  ),
  createRule(
    'one_shot_hero',
    820,
    ({ codeAdded, fixCount }) => codeAdded >= 500 && fixCount === 0,
    ({ codeAdded }) => `因为你新增了 ${codeAdded} 行有效代码，且没有留下新的修复记录。`
  ),
  createRule(
    'requirement_finisher',
    815,
    ({ codeAdded, activeFileCount, fixCount }) =>
      codeAdded >= 800 && activeFileCount >= 6 && fixCount >= 3,
    ({ codeAdded, activeFileCount, fixCount }) =>
      `因为你新增了 ${codeAdded} 行有效代码，活跃于 ${activeFileCount} 个文件，并完成了 ${fixCount} 次问题修复。`
  ),
  createRule(
    'release_officer',
    805,
    ({ codeAdded, activeFileCount, fixCount, codingDurationMinutes }) =>
      codeAdded >= 300 && activeFileCount >= 5 && fixCount >= 2 && codingDurationMinutes >= 180,
    ({ codeAdded, activeFileCount, fixCount, codingDurationMinutes }) =>
      `因为你新增了 ${codeAdded} 行有效代码，活跃于 ${activeFileCount} 个文件，完成 ${fixCount} 次问题修复，并专注开发 ${formatHours(codingDurationMinutes)}。`
  ),
  createRule(
    'refactor_artist',
    795,
    ({ activeFileCount, codeAdded, fixCount, codingDurationMinutes }) =>
      activeFileCount >= 8 && codeAdded <= 200 && fixCount >= 2 && codingDurationMinutes >= 60,
    ({ activeFileCount, codeAdded, fixCount, codingDurationMinutes }) =>
      `因为你活跃于 ${activeFileCount} 个文件，新增 ${codeAdded} 行有效代码，完成 ${fixCount} 次问题修复，并专注开发 ${formatHours(codingDurationMinutes)}。`
  ),
  createRule(
    'project_tourist',
    760,
    ({ activeFileCount, codeAdded }) => activeFileCount >= 10 && codeAdded <= 80,
    ({ activeFileCount }) => `因为你浏览并修改了 ${activeFileCount} 个活跃文件。`
  ),
  createRule(
    'code_generator',
    700,
    ({ codeAdded }) => codeAdded >= 1800,
    ({ codeAdded }) => `因为你新增了 ${codeAdded} 行有效代码。`
  ),
  createRule(
    'hardcore_coder',
    680,
    ({ codeAdded }) => codeAdded >= 1200,
    ({ codeAdded }) => `因为你在这个节气新增了 ${codeAdded} 行有效代码。`
  ),
  createRule(
    'construction_team',
    650,
    ({ codeAdded }) => codeAdded >= 800,
    ({ codeAdded }) => `因为你持续推进，新增了 ${codeAdded} 行有效代码。`
  ),
  createRule(
    'productive_dev',
    620,
    ({ codeAdded }) => codeAdded >= 300,
    ({ codeAdded }) => `因为你新增了 ${codeAdded} 行有效代码。`
  ),
  createRule(
    'code_sower',
    590,
    ({ codeAdded }) => codeAdded > 0,
    ({ codeAdded }) => `因为你为项目种下了 ${codeAdded} 行新代码。`
  ),
  createRule(
    'bug_tamer',
    560,
    ({ fixCount }) => fixCount >= 20,
    ({ fixCount }) => `因为你完成了 ${fixCount} 次问题修复。`
  ),
  createRule(
    'compiler_therapist',
    540,
    ({ fixCount }) => fixCount >= 12,
    ({ fixCount }) => `因为你耐心处理了 ${fixCount} 次问题修复。`
  ),
  createRule(
    'code_doctor',
    520,
    ({ fixCount }) => fixCount >= 8,
    ({ fixCount }) => `因为你完成了 ${fixCount} 次问题修复。`
  ),
  createRule(
    'red_line_expert',
    500,
    ({ fixCount }) => fixCount >= 4,
    ({ fixCount }) => `因为你拆除了 ${fixCount} 处问题隐患。`
  ),
  createRule(
    'bug_healer',
    480,
    ({ fixCount }) => fixCount > 0,
    ({ fixCount }) => `因为你完成了 ${fixCount} 次问题修复。`
  ),
  createRule(
    'code_cartographer',
    450,
    ({ activeFileCount }) => activeFileCount >= 25,
    ({ activeFileCount }) => `因为你活跃于 ${activeFileCount} 个文件。`
  ),
  createRule(
    'fullstack_ranger',
    430,
    ({ activeFileCount }) => activeFileCount >= 18,
    ({ activeFileCount }) => `因为你穿梭在 ${activeFileCount} 个活跃文件之间。`
  ),
  createRule(
    'project_roamer',
    410,
    ({ activeFileCount }) => activeFileCount >= 12,
    ({ activeFileCount }) => `因为你活跃于 ${activeFileCount} 个文件。`
  ),
  createRule(
    'module_walker',
    390,
    ({ activeFileCount }) => activeFileCount >= 6,
    ({ activeFileCount }) => `因为你修改了 ${activeFileCount} 个活跃文件。`
  ),
  createRule(
    'file_inspector',
    370,
    ({ activeFileCount }) => activeFileCount > 0,
    ({ activeFileCount }) => `因为你记录了 ${activeFileCount} 个活跃文件。`
  ),
  createRule(
    'no_sleep_human',
    340,
    ({ codingDurationMinutes }) => codingDurationMinutes >= 900,
    ({ codingDurationMinutes }) => `因为你累计专注开发 ${formatHours(codingDurationMinutes)}。`
  ),
  createRule(
    'liver_candidate',
    320,
    ({ codingDurationMinutes }) => codingDurationMinutes >= 480,
    ({ codingDurationMinutes }) => `因为你累计专注开发 ${formatHours(codingDurationMinutes)}。`
  ),
  createRule(
    'time_master',
    300,
    ({ codingDurationMinutes }) => codingDurationMinutes >= 240,
    ({ codingDurationMinutes }) => `因为你稳定专注了 ${formatHours(codingDurationMinutes)}。`
  ),
  createRule(
    'night_farmer',
    280,
    ({ codingDurationMinutes }) => codingDurationMinutes >= 120,
    ({ codingDurationMinutes }) => `因为你累计专注开发 ${formatHours(codingDurationMinutes)}。`
  ),
  createRule(
    'focus_gardener',
    260,
    ({ codingDurationMinutes }) => codingDurationMinutes > 0,
    ({ codingDurationMinutes }) => `因为你认真专注了 ${formatHours(codingDurationMinutes)}。`
  )
]

export function resolveSolarTermReportTitle(stats) {
  const normalizedStats = {
    codeAdded: Math.max(0, Number(stats?.codeAdded) || 0),
    activeFileCount: Math.max(0, Number(stats?.activeFileCount) || 0),
    fixCount: Math.max(0, Number(stats?.fixCount) || 0),
    codingDurationMinutes: Math.max(0, Number(stats?.codingDurationMinutes) || 0)
  }

  const matchedRule = titleRules
    .filter((rule) => rule.match(normalizedStats))
    .sort((a, b) => b.priority - a.priority)[0]

  const rule = matchedRule || defaultTitle

  return {
    id: rule.id,
    title: rule.title,
    slogan: rule.slogan,
    reason: rule.reason(normalizedStats)
  }
}
