const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  totalCodeLines: { type: Number, default: 0 },
  catFood: { type: Number, default: 0 },
  waterDrops: { type: Number, default: 0 },
  plantStage: { type: Number, default: 1 },
  lastSyncTime: { type: Date, default: Date.now }
})

module.exports = mongoose.model('User', userSchema)
