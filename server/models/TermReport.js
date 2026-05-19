const mongoose = require('mongoose');

const termReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  solarTerm: { type: String, required: true },
  periodStart: { type: String, required: true },
  periodEnd: { type: String, required: true },
  totalCodeLines: { type: Number, default: 0 },
  totalCommitCount: { type: Number, default: 0 },
  totalErrorCount: { type: Number, default: 0 },
  plantStage: { type: Number, default: 1 },
  harvestStage: { type: Number, default: 1 },
  harvestTier: { type: String, default: "" },
  harvestItemName: { type: String, default: "" },
  dailyStats: { type: Array, default: [] }, // 保存生成报告时的快照，防止以后历史数据被篡改
  summary: { type: String, default: "" }
}, { 
  timestamps: true
});

module.exports = mongoose.model('TermReport', termReportSchema);
