const mongoose = require('mongoose');

const termDailyStatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // 例如："2026-05-16"
  solarTerm: { type: String, required: true }, // 例如："立夏"
  codeLines: { type: Number, default: 0 },
  activeFileCount: { type: Number, default: 0 },
  fixCount: { type: Number, default: 0 },
  feedCount: { type: Number, default: 0 },
  waterCount: { type: Number, default: 0 },
  commitCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 }
}, { 
  timestamps: true // 自动加上 createdAt 和 updatedAt
});

// 🌟 核心：建立联合唯一索引。确保“同一个用户、同一天、同一个节气”只能有一条记录，防止数据重复录入
termDailyStatSchema.index({ userId: 1, date: 1, solarTerm: 1 }, { unique: true });

module.exports = mongoose.model('TermDailyStat', termDailyStatSchema);
