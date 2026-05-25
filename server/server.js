require('dotenv').config()

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
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })

function sanitizeUser(user) {
  return {
    username: user.username,
    nickname: user.nickname || '',
    birthday: user.birthday || '',
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
    return res.status(401).json({ success: false, message: 'Please log in first.' })
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Login expired, please log in again.' })
  }
}

function isNonNegativeFiniteNumber(value) {
  return Number.isFinite(value) && value >= 0
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
      { userId: user._id.toString(), username: user.username },
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
    const addedLines = Number(req.body.addedLines || 0)
    const catFood = Number(req.body.catFood || 0)
    const waterDrops = Number(req.body.waterDrops || 0)
    const plantStage = Number(req.body.plantStage || 1)

    if (!Number.isFinite(addedLines) || addedLines < 0 || addedLines > 5000) {
      return res.status(400).json({ success: false, message: 'Invalid addedLines value.' })
    }

    if (![catFood, waterDrops, plantStage].every(Number.isFinite)) {
      return res.status(400).json({ success: false, message: 'Invalid sync payload.' })
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
      return res.status(404).json({ success: false, message: 'User save not found.' })
    }

    console.log(`[sync] ${updatedUser.username}: +${addedLines} lines`)
    res.json({ success: true, message: 'Cloud sync completed.', data: sanitizeUser(updatedUser) })
  } catch (error) {
    console.error('Sync failed:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
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

app.post('/api/term-stats', authenticateToken, async (req, res) => {
  try {
    const date = String(req.body.date || '').trim()
    const solarTerm = String(req.body.solarTerm || '').trim()
    const codeLines = Number(req.body.codeLines || 0)
    const commitCount = Number(req.body.commitCount || 0)
    const errorCount = Number(req.body.errorCount || 0)
    const userId = req.auth.userId

    if (!date || !solarTerm) {
      return res.status(400).json({ success: false, message: 'date and solarTerm are required.' })
    }

    if (![codeLines, commitCount, errorCount].every(isNonNegativeFiniteNumber)) {
      return res.status(400).json({ success: false, message: 'Term stats values must be non-negative numbers.' })
    }

    const updatedStat = await TermDailyStat.findOneAndUpdate(
      { userId, date, solarTerm },
      {
        $inc: {
          codeLines,
          commitCount,
          errorCount
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

    let totalCodeLines = 0
    let totalCommitCount = 0
    let totalErrorCount = 0
    stats.forEach((stat) => {
      totalCodeLines += stat.codeLines || 0
      totalCommitCount += stat.commitCount || 0
      totalErrorCount += stat.errorCount || 0
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

    const stats = await TermDailyStat.find({ userId, solarTerm }).sort({ date: 1 })

    let totalCodeLines = 0
    let totalCommitCount = 0
    let totalErrorCount = 0
    stats.forEach((stat) => {
      totalCodeLines += stat.codeLines || 0
      totalCommitCount += stat.commitCount || 0
      totalErrorCount += stat.errorCount || 0
    })

    const report = await TermReport.findOneAndUpdate(
      { userId, solarTerm },
      {
        $set: {
          periodStart,
          periodEnd,
          totalCodeLines,
          totalCommitCount,
          totalErrorCount,
          plantStage,
          harvestStage,
          harvestTier,
          harvestItemName,
          dailyStats: stats,
          summary
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

    const reports = await TermReport.find(query).sort({ createdAt: -1 })
    res.json({ success: true, data: reports })
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

app.listen(PORT, () => {
  console.log(`CS Valley server listening at http://localhost:${PORT}`)
})
