require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const bcrypt = require('bcryptjs'); // 负责密码加密
const jwt = require('jsonwebtoken'); // 负责颁发身份令牌

// 这是一个极其重要的绝密字符串，随便敲一段乱码，只有你的服务器知道！
const JWT_SECRET = 'CodeSprout_Valley_Super_Secret_Key_888!';

// 引入刚才定义的模型
const User = require('./models/User');

const app = express();

// 中间件配置
app.use(cors());          // 允许 Electron 前端跨域访问
app.use(express.json());  // 允许服务器解析 JSON 格式的请求体

// 🚀 数据库连接逻辑 (针对本地 MongoDB 优化)
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000 // 如果 5 秒连不上就报错，不用傻等
})
.then(() => console.log('🎉 太棒了！本地数据库连接成功！'))
.catch(err => console.error('❌ 数据库连接失败，请检查 MongoDB Compass 是否已 Connect:', err.message));

// --- 业务接口区 ---

// 1. 基础测试接口
app.get('/', (req, res) => {
  res.send('CS Valley 后端服务器已就绪 ✅');
});

// ==========================================
// 🚀 核心功能 1：用户注册接口 (/api/register)
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. 查重：看看数据库里有没有人叫这个名字了
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: '哎呀，这个用户名已经被注册啦！' });
    }

    // 2. 加密：给密码撒盐并进行哈希运算（绝对不能存明文！）
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. 存盘：把新用户和加密后的密码存进 MongoDB，并初始化资源
    const newUser = new User({
      username: username,
      password: hashedPassword, // 存的是长长的一串乱码
      totalCodeLines: 0,
      catFood: 0,
      waterDrops: 0,
      plantStage: 1
    });
    await newUser.save();

    res.status(201).json({ success: true, message: '注册成功！欢迎来到 CodeSprout Valley！' });
  } catch (error) {
    console.error('注册失败详情:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ==========================================
// 🔐 核心功能 2：用户登录接口 (/api/login)
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. 找人：去数据库里把这个用户翻出来
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ success: false, message: '找不到这个用户哦，是不是名字打错了？' });
    }

    // 2. 验明正身：对比输入的密码和数据库里的乱码能不能对上
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: '密码错误！' });
    }

    // 3. 颁发门票：密码对了，发一张 JWT 令牌给前端
    const token = jwt.sign(
      { userId: user._id, username: user.username }, // 把用户身份信息塞进门票里
      JWT_SECRET, // 盖上服务器的公章
      { expiresIn: '7d' } // 门票有效期：7天免登录
    );

    res.json({ 
      success: true,
      message: '登录成功！',
      token: token, // 前端拿到这个 token 后，要保存在本地
      username: user.username
    });
  } catch (error) {
    console.error('登录失败详情:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ==========================================
// 🔄 核心功能 3：云端数据同步接口 (/api/sync)
// ==========================================
app.post('/api/sync', async (req, res) => {
  try {
    const { username, addedLines, catFood, waterDrops, plantStage } = req.body;

    // A. 基础防作弊校验：单次同步行数超过 5000 行视为异常
    if (addedLines > 5000) {
      return res.status(400).json({ success: false, message: '数据异常：单次增量过大' });
    }

    // B. 更新用户存档
    const updatedUser = await User.findOneAndUpdate(
      { username: username }, 
      { 
        $inc: { totalCodeLines: addedLines },
        $set: { 
          catFood: catFood,
          waterDrops: waterDrops,
          plantStage: plantStage,
          lastSyncTime: Date.now()
        }
      },
      { upsert: true, new: true } 
    );

    console.log(`📡 同步成功: 用户 ${username} 刚刚贡献了 ${addedLines} 行代码`);

    // C. 返回结果给前端
    res.json({
      success: true,
      message: '云端同步完成',
      data: updatedUser
    });

  } catch (error) {
    console.error('同步失败详情:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ==========================================
// 📥 核心功能 4：拉取用户存档接口 (/api/user/:username)
// ==========================================
app.get('/api/user/:username', async (req, res) => {
  try {
    // 从请求的 URL 路径中提取用户名
    const targetUsername = req.params.username;

    // 1. 去数据库里精确查找这个用户
    const user = await User.findOne({ username: targetUsername });
    
    if (!user) {
      // 状态码 404 表示 Not Found (未找到)
      return res.status(404).json({ success: false, message: '找不到该用户存档' });
    }

    // 2. 找到后，把他的核心资产数据打包发给前端
    // 使用 || 0 是为了防止旧账号某些字段缺失导致报错，提供一个默认值兜底
    res.json({
      success: true,
      data: {
        totalCodeLines: user.totalCodeLines || 0,
        catFood: user.catFood || 0,
        waterDrops: user.waterDrops || 0,
        plantStage: user.plantStage || 1
      }
    });

  } catch (error) {
    console.error('拉取存档失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 后端服务器已启动：http://localhost:${PORT}`);
});