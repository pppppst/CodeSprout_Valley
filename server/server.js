require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const User = require('./models/User')

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

app.listen(PORT, () => {
  console.log(`CS Valley server listening at http://localhost:${PORT}`)
})
