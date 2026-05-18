require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const User = require('./models/User')
// 👇 新增：引入节气统计和历史报告模型
const TermDailyStat = require('./models/TermDailyStat')
const TermReport = require('./models/TermReport')

const app = express()
const PORT = process.env.PORT || 3000
const MONGO_URI = process.env.MONGO_URI
const JWT_SECRET = process.env.JWT_SECRET

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

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })

function sanitizeUser(user) {
  return {
    username: user.username,
    totalCodeLines: user.totalCodeLines || 0,
    catFood: user.catFood || 0,
    waterDrops: user.waterDrops || 0,
    plantStage: user.plantStage || 1,
    lastSyncTime: user.lastSyncTime
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: '请先登录后再访问云端存档' })
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ success: false, message: '登录已过期，请重新登录' })
  }
}

app.get('/', (req, res) => {
  res.send('CS Valley 后端服务器已就绪 ✅')
})

// ==========================================
// 1. 用户认证与基础存档模块
// ==========================================

app.post('/api/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' })
    }

    if (username.length > 32 || password.length < 6) {
      return res.status(400).json({ success: false, message: '用户名最多 32 个字符，密码至少 6 位' })
    }

    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return res.status(400).json({ success: false, message: '这个用户名已经被注册了' })
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

    res.status(201).json({ success: true, message: '注册成功，请登录' })
  } catch (error) {
    console.error('Register failed:', error)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' })
    }

    const user = await User.findOne({ username })
    if (!user) {
      return res.status(400).json({ success: false, message: '用户不存在' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ success: false, message: '密码错误' })
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      message: '登录成功',
      token,
      username: user.username,
      data: sanitizeUser(user)
    })
  } catch (error) {
    console.error('Login failed:', error)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

app.post('/api/sync', authenticateToken, async (req, res) => {
  try {
    const addedLines = Number(req.body.addedLines || 0)
    const catFood = Number(req.body.catFood || 0)
    const waterDrops = Number(req.body.waterDrops || 0)
    const plantStage = Number(req.body.plantStage || 1)

    if (!Number.isFinite(addedLines) || addedLines < 0 || addedLines > 5000) {
      return res.status(400).json({ success: false, message: '单次同步代码行数异常' })
    }

    if (![catFood, waterDrops, plantStage].every(Number.isFinite)) {
      return res.status(400).json({ success: false, message: '同步数据格式异常' })
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.auth.userId,
      {
        $inc: { totalCodeLines: addedLines },
        $set: {
          catFood: Math.max(0, catFood),
          waterDrops: Math.max(0, waterDrops),
          plantStage: Math.max(1, Math.min(4, plantStage)),
          lastSyncTime: Date.now()
        }
      },
      { new: true }
    )

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: '找不到该用户存档' })
    }

    console.log(`[sync] ${updatedUser.username}: +${addedLines} lines`)
    res.json({ success: true, message: '云端同步完成', data: sanitizeUser(updatedUser) })
  } catch (error) {
    console.error('Sync failed:', error)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

app.get('/api/user/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId)
    if (!user) {
      return res.status(404).json({ success: false, message: '找不到该用户存档' })
    }

    res.json({ success: true, data: sanitizeUser(user) })
  } catch (error) {
    console.error('Fetch user failed:', error)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

app.get('/api/user/:username', authenticateToken, async (req, res) => {
  if (req.params.username !== req.auth.username) {
    return res.status(403).json({ success: false, message: '不能读取其他用户的云端存档' })
  }

  const user = await User.findById(req.auth.userId)
  if (!user) {
    return res.status(404).json({ success: false, message: '找不到该用户存档' })
  }

  res.json({ success: true, data: sanitizeUser(user) })
})

// ==========================================
// 2. 节气每日统计模块 (Term Daily Stats)
// ==========================================

// 上传/累加当天节气数据
app.post('/api/term-stats', authenticateToken, async (req, res) => {
  try {
    const { date, solarTerm } = req.body
    const codeLines = Number(req.body.codeLines || 0)
    const commitCount = Number(req.body.commitCount || 0)
    const errorCount = Number(req.body.errorCount || 0)
    const userId = req.auth.userId

    if (!date || !solarTerm) {
      return res.status(400).json({ success: false, message: '日期和节气名称不能为空' })
    }

    const updatedStat = await TermDailyStat.findOneAndUpdate(
      { userId, date, solarTerm },
      {
        $inc: { 
          codeLines: codeLines, 
          commitCount: commitCount, 
          errorCount: errorCount 
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({ success: true, data: updatedStat })
  } catch (error) {
    console.error('Update term stats failed:', error)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 获取某节气的统计明细和汇总
app.get('/api/term-stats', authenticateToken, async (req, res) => {
  try {
    const { solarTerm } = req.query
    const userId = req.auth.userId

    if (!solarTerm) {
      return res.status(400).json({ success: false, message: '缺少参数 solarTerm' })
    }

    const stats = await TermDailyStat.find({ userId, solarTerm }).sort({ date: 1 })

    let totalCodeLines = 0, totalCommitCount = 0, totalErrorCount = 0
    stats.forEach(s => {
      totalCodeLines += (s.codeLines || 0)
      totalCommitCount += (s.commitCount || 0)
      totalErrorCount += (s.errorCount || 0)
    })

    res.json({
      success: true,
      data: {
        solarTerm,
        dailyStats: stats,
        totalCodeLines,
        totalCommitCount,
        totalErrorCount
      }
    })
  } catch (error) {
    console.error('Fetch term stats failed:', error)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// ==========================================
// 3. 历史报告模块 (Term Reports)
// ==========================================

// 保存节气总结报告
app.post('/api/reports', authenticateToken, async (req, res) => {
  try {
    const { solarTerm, periodStart, periodEnd, summary } = req.body
    const userId = req.auth.userId

    if (!solarTerm || !periodStart || !periodEnd) {
      return res.status(400).json({ success: false, message: '报告参数不完整' })
    }

    // 先查出这个节气所有的每日统计（作为历史快照保存）
    const stats = await TermDailyStat.find({ userId, solarTerm }).sort({ date: 1 })
    
    let totalCodeLines = 0, totalCommitCount = 0, totalErrorCount = 0
    stats.forEach(s => {
      totalCodeLines += (s.codeLines || 0)
      totalCommitCount += (s.commitCount || 0)
      totalErrorCount += (s.errorCount || 0)
    })

    // 同一用户、同一节气、同一周期重复保存时，覆盖旧记录
    const report = await TermReport.findOneAndUpdate(
      { userId, solarTerm, periodStart, periodEnd },
      {
        $set: {
          totalCodeLines,
          totalCommitCount,
          totalErrorCount,
          dailyStats: stats,
          summary: summary || ''
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({ success: true, message: '报告保存成功', data: report })
  } catch (error) {
    console.error('Save report failed:', error)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 查询我的所有历史报告列表 (可选传 ?solarTerm=立夏)
app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    const { solarTerm } = req.query
    const userId = req.auth.userId

    const query = { userId }
    if (solarTerm) query.solarTerm = solarTerm

    // 按创建时间倒序排列（最新的在最上面）
    const reports = await TermReport.find(query).sort({ createdAt: -1 })
    res.json({ success: true, data: reports })
  } catch (error) {
    console.error('Fetch reports failed:', error)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// 查看某份具体的报告详情
app.get('/api/reports/:id', authenticateToken, async (req, res) => {
  try {
    const report = await TermReport.findOne({ _id: req.params.id, userId: req.auth.userId })
    if (!report) {
      return res.status(404).json({ success: false, message: '找不到该报告，或无权访问' })
    }
    res.json({ success: true, data: report })
  } catch (error) {
    console.error('Fetch report detail failed:', error)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

app.listen(PORT, () => {
  console.log(`CS Valley server listening at http://localhost:${PORT}`)
})
