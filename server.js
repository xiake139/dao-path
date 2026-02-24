const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'dao-path-secret-key-2024-mongodb';
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'dao-path';

let db;
let mongoClient;

// Connect to MongoDB with better error handling
async function connectDB() {
  try {
    mongoClient = new MongoClient(MONGO_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
    
    await mongoClient.connect();
    await mongoClient.db("admin").command({ ping: 1 });
    console.log('Connected to MongoDB successfully');
    
    db = mongoClient.db(DB_NAME);
    
    // Create indexes
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('characters').createIndex({ user_id: 1 });
    await db.collection('characters').createIndex({ name: 1 });
    await db.collection('inventory').createIndex({ char_id: 1 });
    
    console.log('Database indexes created');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.error('Please check:');
    console.error('1. MONGO_URI is set correctly');
    console.error('2. Network access allows 0.0.0.0/0');
    console.error('3. Database user credentials are correct');
    process.exit(1);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '登录已过期，请重新登录' });
    }
    req.user = user;
    next();
  });
};

// Game Constants
const SPIRIT_ROOTS = [
  { name: '天灵根', bonus: 2.0, description: '修炼速度极快' },
  { name: '单灵根', bonus: 1.5, description: '修炼速度较快' },
  { name: '双灵根', bonus: 1.2, description: '修炼速度一般' },
  { name: '三灵根', bonus: 1.0, description: '修炼速度较慢' },
  { name: '五行灵根', bonus: 0.7, description: '修炼速度很慢' }
];

const REALMS = [
  { level: 1, name: '炼气期一层', maxQi: 100, reqQi: 0 },
  { level: 2, name: '炼气期二层', maxQi: 200, reqQi: 150 },
  { level: 3, name: '炼气期三层', maxQi: 350, reqQi: 300 },
  { level: 4, name: '炼气期四层', maxQi: 550, reqQi: 500 },
  { level: 5, name: '炼气期五层', maxQi: 800, reqQi: 750 },
  { level: 6, name: '炼气期六层', maxQi: 1100, reqQi: 1000 },
  { level: 7, name: '炼气期七层', maxQi: 1500, reqQi: 1350 },
  { level: 8, name: '炼气期八层', maxQi: 2000, reqQi: 1800 },
  { level: 9, name: '炼气期九层', maxQi: 2600, reqQi: 2300 },
  { level: 10, name: '炼气期十层', maxQi: 3300, reqQi: 3000 },
  { level: 11, name: '筑基期', maxQi: 5000, reqQi: 4500 },
  { level: 12, name: '金丹期', maxQi: 10000, reqQi: 8000 },
  { level: 13, name: '元婴期', maxQi: 20000, reqQi: 15000 }
];

const LOCATIONS = [
  { id: 1, name: '青云宗', description: '你所在的宗门，灵气充沛，适合修炼', danger: 1 },
  { id: 2, name: '青云山脚', description: '宗门外的山脚，有一些低阶妖兽', danger: 2 },
  { id: 3, name: '青云森林', description: '密林中常有修士历练，危机四伏', danger: 3 },
  { id: 4, name: '落日峡谷', description: '峡谷中弥漫着诡异的气息', danger: 4 },
  { id: 5, name: '万魔渊', description: '魔气纵横，是修士的禁地', danger: 5 }
];

const ENEMIES = [
  { name: '野兔', hp: 20, attack: 3, defense: 1, qi: 10, gold: 5 },
  { name: '野狼', hp: 40, attack: 8, defense: 3, qi: 25, gold: 15 },
  { name: '毒蛇', hp: 35, attack: 12, defense: 2, qi: 30, gold: 20 },
  { name: '山贼', hp: 60, attack: 15, defense: 5, qi: 50, gold: 35 },
  { name: '妖狐', hp: 80, attack: 20, defense: 8, qi: 80, gold: 50 },
  { name: '骷髅', hp: 100, attack: 25, defense: 10, qi: 120, gold: 80 },
  { name: '僵尸', hp: 150, attack: 30, defense: 15, qi: 180, gold: 120 },
  { name: '魔狼', hp: 200, attack: 40, defense: 20, qi: 250, gold: 180 }
];

// ==================== REST API Routes ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度需在3-20个字符之间' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6个字符' });
    }

    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: '用户名已被注册' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.collection('users').insertOne({
      username,
      password: hashedPassword,
      created_at: new Date()
    });

    const token = jwt.sign({ userId: result.insertedId.toString(), username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '注册成功', token, username });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const user = await db.collection('users').findOne({ username });
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user._id.toString(), username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '登录成功', token, username });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// Get Character Info
app.get('/api/character', authenticateToken, async (req, res) => {
  try {
    const character = await db.collection('characters').findOne({ user_id: req.user.userId });

    if (!character) {
      return res.json({ hasCharacter: false });
    }

    const inventory = await db.collection('inventory').find({ char_id: character._id.toString() }).toArray();

    res.json({
      hasCharacter: true,
      character: {
        ...character,
        inventory,
        id: character._id.toString()
      }
    });

  } catch (error) {
    console.error('Get character error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// Create Character
app.post('/api/character/create', authenticateToken, async (req, res) => {
  try {
    const { name, gender, spiritRoot } = req.body;

    if (!name || !gender || !spiritRoot) {
      return res.status(400).json({ error: '请填写所有字段' });
    }

    if (name.length < 2 || name.length > 10) {
      return res.status(400).json({ error: '名字长度需在2-10个字符之间' });
    }

    const existingChar = await db.collection('characters').findOne({ user_id: req.user.userId });
    if (existingChar) {
      return res.status(400).json({ error: '每个账号只能创建一个角色' });
    }

    const result = await db.collection('characters').insertOne({
      user_id: req.user.userId,
      name,
      gender,
      spirit_root: spiritRoot,
      realm_level: 1,
      realm_name: '炼气期一层',
      current_qi: 0,
      max_qi: 100,
      hp: 100,
      max_hp: 100,
      attack: 10,
      defense: 5,
      gold: 0,
      prestige: 0,
      location_id: 1,
      created_at: new Date(),
      last_meditate: new Date()
    });

    // Give starter items
    await db.collection('inventory').insertOne({
      char_id: result.insertedId.toString(),
      item_id: 'starter_sword',
      item_name: '新手剑',
      quantity: 1,
      is_equipped: true
    });

    res.json({ message: '角色创建成功', success: true });

  } catch (error) {
    console.error('Create character error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// Perform Action (Meditate, Explore, etc.)
app.post('/api/game/action', authenticateToken, async (req, res) => {
  try {
    const { action, target } = req.body;
    const character = await db.collection('characters').findOne({ user_id: req.user.userId });

    if (!character) {
      return res.status(400).json({ error: '请先创建角色' });
    }

    let result = {};

    switch (action) {
      case 'meditate':
        // Calculate Qi gain based on spirit root and realm
        const rootInfo = SPIRIT_ROOTS.find(r => r.name === character.spirit_root) || SPIRIT_ROOTS[4];
        const realmInfo = REALMS.find(r => r.level === character.realm_level) || REALMS[0];
        const qiGain = Math.floor((5 + character.realm_level * 2) * rootInfo.bonus);

        const newQi = Math.min(character.current_qi + qiGain, realmInfo.maxQi);
        const leveledUp = newQi >= realmInfo.reqQi && character.current_qi < realmInfo.reqQi;

        let newRealmLevel = character.realm_level;
        let newRealmName = character.realm_name;
        let newMaxQi = realmInfo.maxQi;

        if (leveledUp && character.realm_level < 13) {
          newRealmLevel = character.realm_level + 1;
          const nextRealm = REALMS.find(r => r.level === newRealmLevel);
          if (nextRealm) {
            newRealmName = nextRealm.name;
            newMaxQi = nextRealm.maxQi;
          }
        }

        await db.collection('characters').updateOne(
          { _id: character._id },
          {
            $set: {
              current_qi: newQi,
              realm_level: newRealmLevel,
              realm_name: newRealmName,
              max_qi: newMaxQi,
              last_meditate: new Date()
            }
          }
        );

        result = {
          action: 'meditate',
          qiGain,
          currentQi: newQi,
          maxQi: newMaxQi,
          realmName: newRealmName,
          leveledUp,
          message: `打坐修炼中获得${qiGain}点灵气！${leveledUp ? '境界突破到' + newRealmName + '！' : ''}`
        };
        break;

      case 'explore':
        // Random encounter
        const location = LOCATIONS.find(l => l.id === character.location_id) || LOCATIONS[0];
        const encounterChance = Math.random();

        if (encounterChance < 0.4) {
          // Combat!
          const enemyIndex = Math.min(Math.floor(Math.random() * location.danger * 2), ENEMIES.length - 1);
          const enemy = { ...ENEMIES[enemyIndex] };

          // Simple combat calculation
          let charDamage = Math.max(1, character.attack - enemy.defense + Math.floor(Math.random() * 5));
          let enemyDamage = Math.max(1, enemy.attack - character.defense + Math.floor(Math.random() * 3));

          const charWins = character.hp > enemyDamage;

          if (charWins) {
            const qiReward = Math.floor(enemy.qi * (1 + character.realm_level * 0.1));
            const goldReward = Math.floor(enemy.gold * (1 + character.realm_level * 0.1));

            await db.collection('characters').updateOne(
              { _id: character._id },
              {
                $inc: {
                  current_qi: qiReward,
                  gold: goldReward
                },
                $set: { hp: character.hp }
              }
            );

            result = {
              action: 'explore',
              type: 'combat',
              won: true,
              enemy: enemy.name,
              qiReward,
              goldReward,
              message: `遇到${enemy.name}，经过激战你获胜了！获得${qiReward}点灵气和${goldReward}枚金币`
            };
          } else {
            const hpLoss = Math.floor(enemyDamage * 0.3);
            await db.collection('characters').updateOne(
              { _id: character._id },
              { $inc: { hp: -hpLoss } }
            );

            result = {
              action: 'explore',
              type: 'combat',
              won: false,
              enemy: enemy.name,
              hpLoss,
              message: `遇到${enemy.name}，你被打败了！损失${hpLoss}点生命值`
            };
          }
        } else if (encounterChance < 0.7) {
          // Find treasure
          const goldFound = Math.floor(Math.random() * 20 * character.realm_level);
          await db.collection('characters').updateOne(
            { _id: character._id },
            { $inc: { gold: goldFound } }
          );

          result = {
            action: 'explore',
            type: 'treasure',
            goldFound,
            message: `在探索中发现了一个宝箱，里面有${goldFound}枚金币！`
          };
        } else {
          result = {
            action: 'explore',
            type: 'nothing',
            message: '你四处探索，但什么都没有发现...'
          };
        }
        break;

      case 'heal':
        if (character.gold < 10) {
          return res.status(400).json({ error: '金币不足，需要10枚金币' });
        }

        await db.collection('characters').updateOne(
          { _id: character._id },
          {
            $set: { hp: character.max_hp },
            $inc: { gold: -10 }
          }
        );

        result = {
          action: 'heal',
          message: '花费10枚金币，生命值已回满'
        };
        break;

      case 'change_location':
        const newLocationId = parseInt(target);
        if (!LOCATIONS.find(l => l.id === newLocationId)) {
          return res.status(400).json({ error: '无效的地点' });
        }

        await db.collection('characters').updateOne(
          { _id: character._id },
          { $set: { location_id: newLocationId } }
        );

        result = {
          action: 'change_location',
          location: LOCATIONS.find(l => l.id === newLocationId),
          message: `你来到了${LOCATIONS.find(l => l.id === newLocationId).name}`
        };
        break;

      default:
        return res.status(400).json({ error: '无效的操作' });
    }

    // Get updated character data
    const updatedChar = await db.collection('characters').findOne({ user_id: req.user.userId });
    result.character = { ...updatedChar, id: updatedChar._id.toString() };

    res.json(result);

  } catch (error) {
    console.error('Game action error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// Get Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaders = await db.collection('characters')
      .find({})
      .sort({ realm_level: -1, prestige: -1 })
      .limit(10)
      .project({ name: 1, realm_level: 1, realm_name: 1, prestige: 1, gold: 1 })
      .toArray();

    res.json({ leaderboard: leaders });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== WebSocket (Socket.io) ====================

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  let currentUser = null;
  let currentCharacter = null;

  // User login to socket
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      currentUser = decoded;

      currentCharacter = await db.collection('characters').findOne({ user_id: decoded.userId });

      if (currentCharacter) {
        connectedUsers.set(socket.id, {
          user: currentUser,
          character: currentCharacter,
          socketId: socket.id
        });

        // Broadcast user online
        io.emit('user_online', {
          username: currentUser.username,
          characterName: currentCharacter.name,
          realmName: currentCharacter.realm_name
        });

        // Send online users list
        const onlineUsers = Array.from(connectedUsers.values()).map(u => ({
          username: u.user.username,
          characterName: u.character.name,
          realmName: u.character.realm_name
        }));
        socket.emit('online_list', onlineUsers);
      }
    } catch (error) {
      console.log('Socket auth error:', error.message);
    }
  });

  // Chat message
  socket.on('chat_message', (data) => {
    if (!currentUser || !currentCharacter) return;

    const message = {
      id: Date.now(),
      username: currentUser.username,
      characterName: currentCharacter.name,
      realmName: currentCharacter.realm_name,
      message: data.message.substring(0, 200), // Limit message length
      timestamp: new Date().toISOString()
    };

    io.emit('chat_message', message);
  });

  // Challenge player to duel
  socket.on('challenge_duel', (data) => {
    if (!currentUser || !currentCharacter) return;

    // Find target socket
    for (const [socketId, user] of connectedUsers) {
      if (user.character.name === data.targetName) {
        socket.to(socketId).emit('duel_request', {
          from: currentCharacter.name,
          fromRealm: currentCharacter.realm_name,
          fromUser: currentUser.username
        });
        break;
      }
    }
  });

  // Accept duel
  socket.on('accept_duel', async (data) => {
    if (!currentUser || !currentCharacter) return;

    const challenger = connectedUsers.get(data.challengerSocketId);
    if (!challenger) return;

    // Simple duel calculation
    const char1 = currentCharacter;
    const char2 = challenger.character;

    const damage1 = Math.max(1, char1.attack - char2.defense + Math.floor(Math.random() * 10));
    const damage2 = Math.max(1, char2.attack - char1.defense + Math.floor(Math.random() * 10));

    let winner, loser, winnerDamage;
    if (damage1 > damage2) {
      winner = char1;
      loser = char2;
      winnerDamage = damage1;
    } else {
      winner = char2;
      loser = char1;
      winnerDamage = damage2;
    }

    // Update prestige
    await db.collection('characters').updateOne(
      { _id: winner._id },
      { $inc: { prestige: 1 } }
    );

    const duelResult = {
      type: 'duel',
      winner: winner.name,
      loser: loser.name,
      damage: winnerDamage,
      message: `【切磋】${winner.name}击败了${loser.name}，获得1点声望！`
    };

    io.emit('game_event', duelResult);
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (currentUser) {
      connectedUsers.delete(socket.id);
      io.emit('user_offline', { username: currentUser.username });
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Start Server
async function startServer() {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🌟 道途 (Dao Path) - 文字修仙游戏 🌟                   ║
║                                                           ║
║     服务器已启动: http://localhost:${PORT}                  ║
║     数据库: MongoDB Cloud                                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

startServer();
