const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  nickname: { type: String, default: '' },
  birthday: { type: String, default: '' },
  totalCodeLines: { type: Number, default: 0 },
  catFood: { type: Number, default: 0 },
  waterDrops: { type: Number, default: 0 },
  plantStage: { type: Number, default: 1 },
  lastSyncTime: { type: Date, default: Date.now }
}, {
  timestamps: true //  新增：开启自动时间戳
})

module.exports = mongoose.model('User', userSchema)
