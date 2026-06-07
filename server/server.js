require('dotenv').config()

// 新增：2026 年二十四节气标准时间表 (已统一使用北京时间 +08:00 防止时区偏差)
const SOLAR_TERMS_2026 = {
  '小寒': { start: '2026-01-05T00:00:00+08:00', end: '2026-01-20T00:00:00+08:00' },
  '大寒': { start: '2026-01-20T00:00:00+08:00', end: '2026-02-04T00:00:00+08:00' },
  '立春': { start: '2026-02-04T00:00:00+08:00', end: '2026-02-18T00:00:00+08:00' },
  '雨水': { start: '2026-02-18T00:00:00+08:00', end: '2026-03-05T00:00:00+08:00' },
  '惊蛰': { start: '2026-03-05T00:00:00+08:00', end: '2026-03-20T00:00:00+08:00' },
  '春分': { start: '2026-03-20T00:00:00+08:00', end: '2026-04-04T00:00:00+08:00' },
  '清明': { start: '2026-04-04T00:00:00+08:00', end: '2026-04-19T00:00:00+08:00' },
  '谷雨': { start: '2026-04-19T00:00:00+08:00', end: '2026-05-05T00:00:00+08:00' },
  '立夏': { start: '2026-05-05T00:00:00+08:00', end: '2026-05-21T00:00:00+08:00' },
  '小满': { start: '2026-05-21T00:00:00+08:00', end: '2026-06-05T00:00:00+08:00' },
  '芒种': { start: '2026-06-05T00:00:00+08:00', end: '2026-06-21T00:00:00+08:00' },
  '夏至': { start: '2026-06-21T00:00:00+08:00', end: '2026-07-07T00:00:00+08:00' },
  '小暑': { start: '2026-07-07T00:00:00+08:00', end: '2026-07-23T00:00:00+08:00' },
  '大暑': { start: '2026-07-23T00:00:00+08:00', end: '2026-08-07T00:00:00+08:00' },
  '立秋': { start: '2026-08-07T00:00:00+08:00', end: '2026-08-23T00:00:00+08:00' },
  '处暑': { start: '2026-08-23T00:00:00+08:00', end: '2026-09-07T00:00:00+08:00' },
  '白露': { start: '2026-09-07T00:00:00+08:00', end: '2026-09-23T00:00:00+08:00' },
  '秋分': { start: '2026-09-23T00:00:00+08:00', end: '2026-10-08T00:00:00+08:00' },
  '寒露': { start: '2026-10-08T00:00:00+08:00', end: '2026-10-23T00:00:00+08:00' },
  '霜降': { start: '2026-10-23T00:00:00+08:00', end: '2026-11-07T00:00:00+08:00' },
  '立冬': { start: '2026-11-07T00:00:00+08:00', end: '2026-11-22T00:00:00+08:00' },
  '小雪': { start: '2026-11-22T00:00:00+08:00', end: '2026-12-07T00:00:00+08:00' },
  '大雪': { start: '2026-12-07T00:00:00+08:00', end: '2026-12-21T00:00:00+08:00' },
  '冬至': { start: '2026-12-21T00:00:00+08:00', end: '2027-01-05T00:00:00+08:00' }
}

// 🌟 新增：获取北京时间的 YYYY-MM-DD 字符串 (用于判断是否跨天)
function getBeijingDateStr(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp + 8 * 3600000);
  return d.toISOString().split('T')[0];
}

// 🌟 新增：根据时间戳获取对应的节气名称 (用于判断是否跨节气)
function getSolarTermByTime(timestamp) {
  for (const [term, schedule] of Object.entries(SOLAR_TERMS_2026)) {
    const start = new Date(schedule.start).getTime();
    const end = new Date(schedule.end).getTime();
    if (timestamp >= start && timestamp < end) {
      return term;
    }
  }
  return null;
}

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const User = require('./models/User')
const TermDailyStat = require('./models/TermDailyStat')
const TermReport = require('./models/TermReport')

const app = express()
const PORT = process.env.PORT || 3000
const MONGO_URI = process.env.MONGO_URI
const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || '').trim()
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '')

app.use(cors())
app.use(express.json())

if (!MONGO_URI) {
  console.error('Missing required environment variable: MONGO_URI')
  process.exit(1)
}

if (!JWT_SECRET) {
  console.error('Missing required environment variable: JWT_SECRET')
  process.exit(1)
}

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(async () => {
    console.log('MongoDB connected')
    await ensureAdminAccount()
    await migrateOldUsers()
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })

async function ensureAdminAccount() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn('Admin account is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD to enable admin login.')
    return
  }

  if (ADMIN_PASSWORD.length < 6) {
    console.warn('Admin account is not configured. ADMIN_PASSWORD must be at least 6 chars.')
    return
  }

  const existingAdmin = await User.findOne({ username: ADMIN_USERNAME })
  const salt = await bcrypt.genSalt(10)

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt)
    await User.create({
      username: ADMIN_USERNAME,
      password: hashedPassword,
      role: 'admin',
      totalCodeLines: 0,
      catFood: 0,
      waterDrops: 0,
      plantStage: 1
    })
    console.log(`Admin account ready: ${ADMIN_USERNAME}`)
    return
  }

  let shouldSave = false
  if (existingAdmin.role !== 'admin') {
    existingAdmin.role = 'admin'
    shouldSave = true
  }

  const passwordMatches = await bcrypt.compare(ADMIN_PASSWORD, existingAdmin.password)
  if (!passwordMatches) {
    existingAdmin.password = await bcrypt.hash(ADMIN_PASSWORD, salt)
    shouldSave = true
  }

  if (shouldSave) {
    await existingAdmin.save()
  }

  console.log(`Admin account ready: ${ADMIN_USERNAME}`)
}

function sanitizeUser(user) {
  const registrationDate = user.createdAt || user._id.getTimestamp()
  
  const now = Date.now()
  const todayStr = getBeijingDateStr(now)
  const currentTerm = getSolarTermByTime(now)

  // 🌟 核心解耦：今日清今日的，节气清节气的！
  const displayTodayLines = (user.lastCodeDate !== todayStr) ? 0 : (user.todayCodeLines || 0)
  const displayTotalLines = (user.lastTermReset !== currentTerm) ? 0 : (user.totalCodeLines || 0)

  const displayCatFood = (user.lastTermReset !== currentTerm) ? 0 : (user.catFood || 0)
  const displayWaterDrops = (user.lastTermReset !== currentTerm) ? 0 : (user.waterDrops || 0)
  const displayPlantStage = (user.lastTermReset !== currentTerm) ? 1 : (user.plantStage || 1)

  // 🌟 新增：每日清零字段
  const displayTodayActiveFiles = (user.lastCodeDate !== todayStr) ? 0 : (user.todayActiveFiles || 0)
  const displayTodayFixCount = (user.lastCodeDate !== todayStr) ? 0 : (user.todayFixCount || 0)
  const displayTodayFeedCount = (user.lastCodeDate !== todayStr) ? 0 : (user.todayFeedCount || 0)
  const displayTodayWaterCount = (user.lastCodeDate !== todayStr) ? 0 : (user.todayWaterCount || 0)

  // 🌟 新增：节气清零字段
  const displayTotalActiveFiles = (user.lastTermReset !== currentTerm) ? 0 : (user.totalActiveFiles || 0)
  const displayTotalFixCount = (user.lastTermReset !== currentTerm) ? 0 : (user.totalFixCount || 0)

  return {
    username: user.username,
    role: user.role || 'user',
    isAdmin: user.role === 'admin',
    nickname: user.nickname || '',
    birthday: user.birthday || '',
    totalCodeLines: displayTotalLines, // 这个继续给你们的【节气周报】用
    todayCodeLines: displayTodayLines, // 🌟 这个给前端的【实时主界面】用！
    todayActiveFiles: displayTodayActiveFiles, // 🌟 今日活跃文件
    todayFixCount: displayTodayFixCount, // 🌟 今日修复次数
    todayFeedCount: displayTodayFeedCount, // 🌟 今日喂食次数
    todayWaterCount: displayTodayWaterCount, // 🌟 今日浇水次数
    totalActiveFiles: displayTotalActiveFiles, // 🌟 节气活跃文件总数
    totalFixCount: displayTotalFixCount, // 🌟 节气修复总次数
    catFood: displayCatFood,
    waterDrops: displayWaterDrops,
    plantStage: displayPlantStage,
    lastSyncTime: user.lastSyncTime,
    registeredAt: registrationDate.toISOString(),
    pastTermArchive: user.pastTermArchive || null // 🌟 把遗产暴露给前端周报用
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Please log in first.' })
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Login expired, please log in again.' })
  }
}

async function authenticateAdmin(req, res, next) {
  authenticateToken(req, res, async () => {
    try {
      const user = await User.findById(req.auth.userId)
      if (!user) {
        return res.status(404).json({ success: false, message: 'User save not found.' })
      }

      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin permission required.' })
      }

      req.adminUser = user
      next()
    } catch (error) {
      console.error('Admin auth failed:', error)
      res.status(500).json({ success: false, message: 'Server error.' })
    }
  })
}

function isNonNegativeFiniteNumber(value) {
  return Number.isFinite(value) && value >= 0
}

function readNonNegativeMetric(primaryValue, legacyValue) {
  const rawValue = primaryValue !== undefined ? primaryValue : legacyValue
  const value = Number(rawValue || 0)
  return Number.isFinite(value) ? value : NaN
}

function readStoredMetric(primaryValue, legacyValue) {
  const rawValue = primaryValue ?? legacyValue ?? 0
  const value = Number(rawValue || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

function summarizeTermDailyStats(stats) {
  const summary = {
    totalCodeLines: 0,
    totalActiveFileCount: 0,
    totalFixCount: 0,
    totalFeedCount: 0,
    totalWaterCount: 0,
    totalCareActionCount: 0,
    totalCommitCount: 0,
    totalErrorCount: 0
  }

  stats.forEach((stat) => {
    summary.totalCodeLines += readStoredMetric(stat.codeLines, 0)
    summary.totalActiveFileCount = Math.max(
      summary.totalActiveFileCount,
      readStoredMetric(stat.activeFileCount, stat.commitCount)
    )
    summary.totalFixCount = Math.max(
      summary.totalFixCount,
      readStoredMetric(stat.fixCount, stat.errorCount)
    )
    const feedCount = readStoredMetric(stat.feedCount, 0)
    const waterCount = readStoredMetric(stat.waterCount, 0)
    summary.totalFeedCount += feedCount
    summary.totalWaterCount += waterCount
    summary.totalCareActionCount += feedCount + waterCount
    summary.totalCommitCount = Math.max(
      summary.totalCommitCount,
      readStoredMetric(stat.commitCount, stat.activeFileCount)
    )
    summary.totalErrorCount = Math.max(
      summary.totalErrorCount,
      readStoredMetric(stat.errorCount, stat.fixCount)
    )
  })

  return summary
}

app.get('/', (req, res) => {
  res.send('CS Valley server is ready.')
})

app.post('/api/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' })
    }

    if (username.length > 32 || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Username must be at most 32 chars and password at least 6 chars.' })
    }

    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists.' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const newUser = new User({
      username,
      password: hashedPassword,
      totalCodeLines: 0,
      catFood: 0,
      waterDrops: 0,
      plantStage: 1
    })

    await newUser.save()
    res.status(201).json({ success: true, message: 'Registered successfully, please log in.' })
  } catch (error) {
    console.error('Register failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' })
    }

    const user = await User.findOne({ username })
    if (!user) {
      return res.status(400).json({ success: false, message: 'User does not exist.' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect password.' })
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      username: user.username,
      data: sanitizeUser(user)
    })
  } catch (error) {
    console.error('Login failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

app.post('/api/sync', authenticateToken, async (req, res) => {
  try {
    const addedLines = Number(req.body.addedLines || 0);
    const addedActiveFiles = Number(req.body.addedActiveFiles || 0); // 🌟 新增
    const addedFixes = Number(req.body.addedFixes || 0); // 🌟 新增
    let catFood = Number(req.body.catFood || 0);
    let waterDrops = Number(req.body.waterDrops || 0);
    let plantStage = Number(req.body.plantStage || 1);
    const todayFeedCount = Number(req.body.todayFeedCount || 0); // 🌟 新增
    const todayWaterCount = Number(req.body.todayWaterCount || 0); // 🌟 新增

    if (!Number.isFinite(addedLines) || addedLines < 0 || addedLines > 5000) {
      return res.status(400).json({ success: false, message: 'Invalid addedLines value.' });
    }
    if (![catFood, waterDrops, plantStage, addedActiveFiles, addedFixes, todayFeedCount, todayWaterCount].every(Number.isFinite)) {
      return res.status(400).json({ success: false, message: 'Invalid sync payload.' });
    }

    const user = await User.findById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User save not found.' });
    }

    const now = Date.now();
    const todayStr = getBeijingDateStr(now);
    const currentTerm = getSolarTermByTime(now);

    // 🌟 轨道 1：【每日清零逻辑】针对 today 系字段
    if (user.lastCodeDate !== todayStr) {
      user.todayCodeLines = addedLines;
      user.todayActiveFiles = addedActiveFiles; // 🌟 跨天重置
      user.todayFixCount = addedFixes; // 🌟 跨天重置
      user.todayFeedCount = todayFeedCount; // 🌟 跨天重置
      user.todayWaterCount = todayWaterCount; // 🌟 跨天重置
      user.lastCodeDate = todayStr;
    } else {
      user.todayCodeLines = (user.todayCodeLines || 0) + addedLines;
      user.todayActiveFiles = (user.todayActiveFiles || 0) + addedActiveFiles; // 🌟 累加
      user.todayFixCount = (user.todayFixCount || 0) + addedFixes; // 🌟 累加
      if (todayFeedCount !== undefined) user.todayFeedCount = todayFeedCount; // 🌟 用最新值覆盖
      if (todayWaterCount !== undefined) user.todayWaterCount = todayWaterCount; // 🌟 用最新值覆盖
    }

    // 🌟 轨道 2：【节气清零逻辑】针对 total 系字段 + 猫粮等
    if (user.lastTermReset !== currentTerm) {

      // ⚠️ 核心修复：自动快照！在清零前，把上个节气的所有心血封存！
      if (user.lastTermReset) {
        const previousTermStats = await TermDailyStat.find({ userId: user._id, solarTerm: user.lastTermReset })
        const previousTermSummary = summarizeTermDailyStats(previousTermStats)
        const hasPreviousTermStats = previousTermStats.length > 0
        user.pastTermArchive = {
          solarTerm: user.lastTermReset,
          totalCodeLines: user.totalCodeLines || 0,
          totalActiveFiles: hasPreviousTermStats ? previousTermSummary.totalActiveFileCount : (user.totalActiveFiles || 0), // 🌟 封存上赛季单日峰值活跃文件
          totalFixCount: hasPreviousTermStats ? previousTermSummary.totalFixCount : (user.totalFixCount || 0), // 🌟 封存上赛季单日峰值修复次数
          plantStage: user.plantStage || 1,
          catFood: user.catFood || 0,
          waterDrops: user.waterDrops || 0
        };
      }

      user.totalCodeLines = addedLines;
      user.totalActiveFiles = addedActiveFiles; // 🌟 跨节气重置
      user.totalFixCount = addedFixes; // 🌟 跨节气重置
      user.catFood = 0;
      user.waterDrops = 0;
      user.plantStage = 1;
      user.lastTermReset = currentTerm;
    } else {
      user.totalCodeLines = (user.totalCodeLines || 0) + addedLines;
      user.totalActiveFiles = (user.totalActiveFiles || 0) + addedActiveFiles; // 🌟 累加
      user.totalFixCount = (user.totalFixCount || 0) + addedFixes; // 🌟 累加
      user.catFood = Math.max(0, catFood);
      user.waterDrops = Math.max(0, waterDrops);
      user.plantStage = Math.max(1, Math.min(4, plantStage));
    }

    user.lastSyncTime = now;
    await user.save();

    console.log(`[sync] ${user.username}: lines=${user.totalCodeLines}, files=${user.totalActiveFiles}, fixes=${user.totalFixCount}, term=${currentTerm}`);
    res.json({ success: true, message: 'Cloud sync completed.', data: sanitizeUser(user) });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
})

app.get('/api/user/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User save not found.' })
    }

    res.json({ success: true, data: sanitizeUser(user) })
  } catch (error) {
    console.error('Fetch user failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

app.patch('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const nickname = String(req.body.nickname || '').trim().slice(0, 20)
    const birthday = String(req.body.birthday || '').trim()

    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      return res.status(400).json({ success: false, message: 'Birthday must use YYYY-MM-DD.' })
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.auth.userId,
      { $set: { nickname, birthday } },
      { new: true }
    )

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User profile not found.' })
    }

    res.json({ success: true, message: 'Profile saved.', data: sanitizeUser(updatedUser) })
  } catch (error) {
    console.error('Update profile failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

app.get('/api/user/:username', authenticateToken, async (req, res) => {
  if (req.params.username !== req.auth.username) {
    return res.status(403).json({ success: false, message: 'Cannot read another user save.' })
  }

  const user = await User.findById(req.auth.userId)
  if (!user) {
    return res.status(404).json({ success: false, message: 'User save not found.' })
  }

  res.json({ success: true, data: sanitizeUser(user) })
})

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select('username role nickname birthday totalCodeLines todayCodeLines todayActiveFiles todayFixCount todayFeedCount todayWaterCount totalActiveFiles totalFixCount catFood waterDrops plantStage lastSyncTime createdAt updatedAt')
      .sort({ createdAt: -1 })

    const data = users.map((user) => ({
      username: user.username,
      role: user.role || 'user',
      isAdmin: user.role === 'admin',
      nickname: user.nickname || '',
      birthday: user.birthday || '',
      totalCodeLines: user.totalCodeLines || 0,
      todayCodeLines: user.todayCodeLines || 0,
      todayActiveFiles: user.todayActiveFiles || 0,
      todayFixCount: user.todayFixCount || 0,
      todayFeedCount: user.todayFeedCount || 0,
      todayWaterCount: user.todayWaterCount || 0,
      totalActiveFiles: user.totalActiveFiles || 0,
      totalFixCount: user.totalFixCount || 0,
      catFood: user.catFood || 0,
      waterDrops: user.waterDrops || 0,
      plantStage: user.plantStage || 1,
      lastSyncTime: user.lastSyncTime,
      registeredAt: (user.createdAt || user._id.getTimestamp()).toISOString(),
      updatedAt: user.updatedAt
    }))

    res.json({ success: true, data })
  } catch (error) {
    console.error('Fetch admin users failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

app.post('/api/term-stats', authenticateToken, async (req, res) => {
  try {
    const date = String(req.body.date || '').trim()
    const solarTerm = String(req.body.solarTerm || '').trim()
    const codeLines = Number(req.body.codeLines || 0)
    const activeFileCount = readNonNegativeMetric(req.body.activeFileCount, req.body.commitCount)
    const fixCount = readNonNegativeMetric(req.body.fixCount, req.body.errorCount)
    const feedCount = readNonNegativeMetric(req.body.feedCount, req.body.todayFeedCount)
    const waterCount = readNonNegativeMetric(req.body.waterCount, req.body.todayWaterCount)
    const userId = req.auth.userId

    if (!date || !solarTerm) {
      return res.status(400).json({ success: false, message: 'date and solarTerm are required.' })
    }

    if (![codeLines, activeFileCount, fixCount, feedCount, waterCount].every(isNonNegativeFiniteNumber)) {
      return res.status(400).json({ success: false, message: 'Term stats values must be non-negative numbers.' })
    }

    // 白名单拦截：无效节气名称直接拒绝
    const termSchedule = SOLAR_TERMS_2026[solarTerm]
    if (!termSchedule) {
      return res.status(400).json({ success: false, message: '无效的节气标识' })
    }

    const updatedStat = await TermDailyStat.findOneAndUpdate(
      { userId, date, solarTerm },
      {
        $inc: {
          codeLines,
          activeFileCount,
          fixCount,
          commitCount: activeFileCount,
          errorCount: fixCount
        },
        $max: {
          feedCount,
          waterCount
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({ success: true, data: updatedStat })
  } catch (error) {
    console.error('Update term stats failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

app.get('/api/term-stats', authenticateToken, async (req, res) => {
  try {
    const solarTerm = String(req.query.solarTerm || '').trim()
    const userId = req.auth.userId

    if (!solarTerm) {
      return res.status(400).json({ success: false, message: 'Missing solarTerm.' })
    }

    const stats = await TermDailyStat.find({ userId, solarTerm }).sort({ date: 1 })

    const {
      totalCodeLines,
      totalActiveFileCount,
      totalFixCount,
      totalFeedCount,
      totalWaterCount,
      totalCareActionCount,
      totalCommitCount,
      totalErrorCount
    } = summarizeTermDailyStats(stats)

    res.json({
      success: true,
      data: {
        solarTerm,
        dailyStats: stats,
        totalCodeLines,
        totalActiveFileCount,
        totalFixCount,
        totalFeedCount,
        totalWaterCount,
        totalCareActionCount,
        totalCommitCount,
        totalErrorCount
      }
    })
  } catch (error) {
    console.error('Fetch term stats failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

app.post('/api/reports', authenticateToken, async (req, res) => {
  try {
    const solarTerm = String(req.body.solarTerm || '').trim()
    const periodStart = String(req.body.periodStart || '').trim()
    const periodEnd = String(req.body.periodEnd || '').trim()
    const summary = String(req.body.summary || '')
    const userId = req.auth.userId
    const rawPlantStage = Number(req.body.plantStage || 1)
    const rawHarvestStage = Number(req.body.harvestStage || 1)
    const plantStage = Number.isFinite(rawPlantStage) ? Math.max(1, Math.min(4, rawPlantStage)) : 1
    const harvestStage = Number.isFinite(rawHarvestStage) ? Math.max(1, Math.min(3, rawHarvestStage)) : 1
    const harvestTier = String(req.body.harvestTier || '').trim().slice(0, 32)
    const harvestItemName = String(req.body.harvestItemName || '').trim().slice(0, 64)

    if (!solarTerm || !periodStart || !periodEnd) {
      return res.status(400).json({ success: false, message: 'Report payload is incomplete.' })
    }

    // 防绕过校验逻辑开始
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    
    // 白名单拦截：非法节气名称直接拒绝
    const termSchedule = SOLAR_TERMS_2026[solarTerm]
    if (!termSchedule) {
      return res.status(400).json({ success: false, message: '非法操作：该节气名称不存在于白名单中' })
    }
    
    const termEndTime = new Date(termSchedule.end).getTime()
    const userRegTime = (user.createdAt || user._id.getTimestamp()).getTime()
    const nowTime = Date.now()

    // 规则1: 节气还没彻底结束，不能提前生成报告
    if (nowTime < termEndTime) {
      return res.status(403).json({ success: false, message: `The solar term [${solarTerm}] has not ended yet. Cannot generate report.` })
    }
    // 规则2: 节气在用户注册前就已经结束了，拒绝蹭历史成就
    if (userRegTime > termEndTime) {
      return res.status(403).json({ success: false, message: `The solar term [${solarTerm}] ended before your account was registered.` })
    }
    // 防绕过校验逻辑结束

    const stats = await TermDailyStat.find({ userId, solarTerm }).sort({ date: 1 })

    const {
      totalCodeLines,
      totalActiveFileCount,
      totalFixCount,
      totalFeedCount,
      totalWaterCount,
      totalCareActionCount,
      totalCommitCount,
      totalErrorCount
    } = summarizeTermDailyStats(stats)

    const report = await TermReport.findOneAndUpdate(
      { userId, solarTerm },
      {
        $set: {
          periodStart, periodEnd, totalCodeLines, totalActiveFileCount, totalFixCount, totalFeedCount, totalWaterCount, totalCareActionCount, totalCommitCount, totalErrorCount,
          plantStage, harvestStage, harvestTier, harvestItemName, dailyStats: stats, summary
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({ success: true, message: 'Report saved.', data: report })
  } catch (error) {
    console.error('Save report failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    const solarTerm = String(req.query.solarTerm || '').trim()
    const query = { userId: req.auth.userId }
    if (solarTerm) query.solarTerm = solarTerm

    const user = await User.findById(req.auth.userId)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    const userRegTime = (user.createdAt || user._id.getTimestamp()).getTime()

    // 修复乱码：恢复正常的数据库查询
    const allReports = await TermReport.find(query).sort({ createdAt: -1 })
    
    // 脏数据过滤：只返回合法且注册后经历过的节气报告
    const validReports = allReports.filter(report => {
      const termSchedule = SOLAR_TERMS_2026[report.solarTerm]
      
      // 白名单防线：找不到时间表的是非法脏数据，坚决丢弃 (return false)
      if (!termSchedule) return false 
      
      const termEndTime = new Date(termSchedule.end).getTime()
      // 如果节气在用户注册之前就结束了，这个报告就是非法历史数据，丢弃
      return userRegTime <= termEndTime
    })

    res.json({ success: true, data: validReports })
  } catch (error) {
    console.error('Fetch reports failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

app.get('/api/reports/:id', authenticateToken, async (req, res) => {
  try {
    const report = await TermReport.findOne({ _id: req.params.id, userId: req.auth.userId })
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' })
    }
    res.json({ success: true, data: report })
  } catch (error) {
    console.error('Fetch report detail failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// 临时数据迁移脚本：无视 Mongoose 规则，使用原生驱动直接修改
async function migrateOldUsers() {
  try {
    // 找出所有没有 createdAt 字段的老用户
    const oldUsers = await User.find({ createdAt: { $exists: false } })
    
    if (oldUsers.length > 0) {
      console.log(`[数据迁移] 发现 ${oldUsers.length} 个老用户，启动原生数据库最高权限写入...`)
      
      for (const user of oldUsers) {
        // 从 _id 提取精确到秒的真实注册时间
        const trueTime = user._id.getTimestamp()
        
        // 终极大招：User.collection 直接调用原生 MongoDB 驱动！
        // 它会彻底无视 Mongoose 的 immutable (不可变) 保护
        await User.collection.updateOne(
          { _id: user._id },
          { $set: { createdAt: trueTime } }
        )
      }
      console.log('[数据迁移] 原生驱动写入成功，老用户时间戳已完美补齐！')
    } else {
      console.log('[数据迁移] 数据库很干净，没有缺失 createdAt 的老用户。')
    }
  } catch (error) {
    console.error('迁移失败:', error)
  }
}
app.listen(PORT, () => {
  console.log(`CS Valley server listening at http://localhost:${PORT}`)
})
