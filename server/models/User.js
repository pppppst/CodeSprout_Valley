const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  nickname: { type: String, default: '' },
  birthday: { type: String, default: '' },
  totalCodeLines: { type: Number, default: 0 }, // 🌟 保持不变：节气总代码（周报用）
  todayCodeLines: { type: Number, default: 0 }, // 🌟 新增：今日代码（主界面用）
  catFood: { type: Number, default: 0 },
  waterDrops: { type: Number, default: 0 },
  plantStage: { type: Number, default: 1 },
  lastSyncTime: { type: Date, default: Date.now },
  lastCodeDate: { type: String, default: '' },   // 记录最后同步代码的日期(YYYY-MM-DD)，用于每日代码行清零
  lastTermReset: { type: String, default: '' }    // 记录当前节气名，用于按节气清零猫粮/水滴
}, {
  timestamps: true //  新增：开启自动时间戳
})

module.exports = mongoose.model('User', userSchema)
