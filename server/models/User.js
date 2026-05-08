const mongoose = require('mongoose');

// 定义用户实体模型（对应需求文档中的 User 实体）
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // 用户名
  password: { type: String, required: true },               // 密码
  totalCodeLines: { type: Number, default: 0 },             // 累计总代码行数
  catFood: { type: Number, default: 0 },                    // 猫粮余额
  waterDrops: { type: Number, default: 0 },                 // 水滴余额
  plantStage: { type: String, default: 'seedling' },        // 植物阶段 (幼苗/抽枝/开花结果)
  lastSyncTime: { type: Date, default: Date.now }           // 最后同步时间
});

module.exports = mongoose.model('User', userSchema);