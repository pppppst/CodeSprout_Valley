const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  nickname: { type: String, default: '' },
  birthday: { type: String, default: '' },
  totalCodeLines: { type: Number, default: 0 }, // 🌟 保持不变：节气总代码（周报用）
  todayCodeLines: { type: Number, default: 0 }, // 🌟 新增：今日代码（主界面用）
  todayActiveFiles: { type: Number, default: 0 }, // 🌟 今日活跃文件数（每日清零）
  todayFixCount: { type: Number, default: 0 }, // 🌟 今日修复次数（每日清零）
  todayFeedCount: { type: Number, default: 0 }, // 🌟 今日喂食次数（每日清零）
  todayWaterCount: { type: Number, default: 0 }, // 🌟 今日浇水次数（每日清零）
  totalActiveFiles: { type: Number, default: 0 }, // 🌟 节气活跃文件数（节气清零）
  totalFixCount: { type: Number, default: 0 }, // 🌟 节气修复次数（节气清零）
  catFood: { type: Number, default: 0 },
  waterDrops: { type: Number, default: 0 },
  plantStage: { type: Number, default: 1 },
  lastSyncTime: { type: Date, default: Date.now },
  lastCodeDate: { type: String, default: '' },   // 记录最后同步代码的日期(YYYY-MM-DD)，用于每日代码行清零
  lastTermReset: { type: String, default: '' },   // 记录当前节气名，用于按节气清零猫粮/水滴
  pastTermArchive: { type: Object, default: null } // 🌟 新增：上个节气的快照存档
}, {
  timestamps: true //  新增：开启自动时间戳
})

module.exports = mongoose.model('User', userSchema)
