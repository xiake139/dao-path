#途途(Dao路径)-文字修仙游戏

##游戏简介

这是一款多人在线文字修仙游戏，玩家可以创建角色、修炼境界、探索世界、与其他玩家交流和切磋。

##功能特点

-用户注册和登录系统
-角色创建（选择灵根、性别、名字）
-修炼系统（打坐提升境界）
-探索系统（打怪、寻宝）
-多人在线聊天
-玩家切磋PK
-排行榜

##技术栈

- **后端**：Node.js+Express
- **数据库**：MongoDB(云端)
- **实时通信**：Socket.io
- **前端**：HTML+CSS+JavaScript

##部署指南

###前置要求

1.GitHub账户
2.MongoDB地图集账户（免费）
3.铁路账户（免费）

###步骤1：创建MongoDB地图集数据库

1.访问[MongoDB地图集](https://www.mongodb.com/cloud/atlas)
2.点击"开始免费"注册账户
3.选择**自由层**(M0)免费集群
4.选择区域：**新加坡**或**悉尼**（延迟较低）
5.点击"创建群集“”等待创建完成

6. 创建数据库：
   - 点击 "Database" → "Browse Collections"
   - 点击 "Create Database"
   - Database Name: `dao-path`
   - Collection Name: `users`

7. 创建数据库用户：
   - 点击 "Database Access" → "Add New Database User"
   - Authentication Method: "Password"
   - User Name: `daopath_user`
   - Password: 设置一个密码（记住它！）
   - Database User Privileges: "Atlas admin"
   - 点击 "Add User"

8. **重要**：允许网络访问：
   - 点击 "Network Access" → "Add IP Address"
   - 选择 "Allow Access from Anywhere" (0.0.0.0/0)
   - 点击 "Confirm"

9. 获取连接字符串：
   - 点击 "Database" → "Connect" → "Drivers"
   - 复制连接字符串，格式如下：
   ```
   mongodb+srv://daopath_user:<password>@cluster0.xxxxx.mongodb.net/dao-path?retryWrites=true&w=majority
   ```
   - 将 `<password>` 替换为您设置的密码

### 步骤 2：上传代码到 GitHub

1. 登录 GitHub
2. 点击 "New repository" 创建新仓库
   - Repository name: `dao-path`
   - 选择 "Public"
   - 点击 "Create repository"

3. 上传文件：
   - 在仓库页面点击 "uploading an existing file"
   - 将 `dao-path` 文件夹中的所有文件拖入
   - 填写 commit 信息，点击 "Commit changes"

### 步骤 3：部署到 Railway

1. 访问 [Railway](https://railway.app)
2. 点击 "Login with GitHub" 登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择刚才创建的 `dao-path` 仓库
6. Railway 会自动检测 Node.js 项目

7. 添加环境变量：
   - 点击 "Variables" 选项卡
   - 添加以下变量：
     - `MONGO_URI`: 您的 MongoDB 连接字符串
     - `DB_NAME`: `dao-path`
     - `PORT`: `3000`
   - 例如：
     ```
     MONGO_URI=mongodb+srv://daopath_user:你的密码@cluster0.xxxxx.mongodb.net/dao-path?retryWrites=true&w=majority
     DB_NAME=dao-path
     PORT=3000
     ```

8. 点击 "Deploy" 开始部署
   - 等待构建完成（大约 2-3 分钟）
   - 部署成功后，点击 "Domains" 查看访问地址

### 步骤 4：开始游戏

1. 复制 Railway 提供的域名
2. 在浏览器中打开
3. 注册账号
4. 创建角色
5. 开始修仙之旅！

## 本地开发

如果您想在本地运行：

1. 安装 Node.js (版本 14+)
2. 安装 MongoDB Community Server 或使用 MongoDB Atlas
3. 克隆仓库
4. 安装依赖：
   ```bash
   cd dao-path
   npm install
   ```
5. 创建 `.env` 文件：
   ```
   MONGO_URI=mongodb://localhost:27017/dao-path
   DB_NAME=dao-path
   PORT=3000
   ```
6. 启动服务器：
   ```bash
   npm start
   ```
7. 访问 http://localhost:3000

## 游戏玩法

### 修炼
- 点击"打坐修炼"获得灵气
- 灵气积累到一定程度会突破境界
- 境界越高，修炼速度越快

### 探索
- 花费10点体力探索各地
- 可能遇到怪物（战斗）
- 可能找到宝箱（获得金币）
- 可能什么都找不到

### 战斗
- 战胜怪物获得灵气和金币
- 战败损失生命值
- 生命值可以通过金币恢复

### 社交
- 在线玩家列表显示当前在线的玩家
- 可以发送聊天消息
- 可以向其他玩家发起切磋邀请

## 目录结构

```
dao-path/
├── public/
│   ├── index.html      # 游戏主页
│   ├── css/
│   │   └── style.css  # 样式文件
│   └── js/
│       ├── auth.js    # 认证相关JS
│       └── game.js   # 游戏逻辑JS
├── server.js          # 后端服务器
├── package.json       # 项目依赖
├── railway.json      # Railway配置
└── README.md         # 说明文档
```

## 注意事项

1. 免费版 Railway 部署后会进入休眠，第一次访问可能需要等待几秒
2. 免费版 MongoDB Atlas 每月有免费额度限制，个人使用足够
3. 如果遇到问题，检查 Railway 日志中的错误信息

## 技术支持

如有问题，请检查：
1. MongoDB 连接字符串是否正确
2. Network Access 是否设置为 0.0.0.0/0
3. Railway 环境变量是否正确配置

---

祝您修仙愉快！🌟
