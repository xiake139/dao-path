// ==================== Game Module ====================

const GAME_API = '/api/game';
let socket = null;
let characterData = null;

// DOM Elements
const gameLog = document.getElementById('game-log');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const logoutBtn = document.getElementById('logout-btn');

// Initialize game when screen is shown
function initGame() {
  connectWebSocket();
  loadCharacterData();
  loadLeaderboard();
  
  // Setup event listeners
  setupActionButtons();
  setupChat();
  setupLogout();
  
  // Logout button
  logoutBtn.addEventListener('click', () => {
    if (socket) {
      socket.disconnect();
    }
    window.authModule.logout();
  });
}

// WebSocket Connection
function connectWebSocket() {
  const token = window.authModule.getToken();
  if (!token) return;
  
  socket = io();
  
  socket.on('connect', () => {
    console.log('WebSocket connected');
    socket.emit('authenticate', token);
  });
  
  socket.on('user_online', (data) => {
    addOnlineUser(data);
    addLogEntry(`${data.characterName} (${data.realmName}) 进入了游戏`, 'system');
  });
  
  socket.on('user_offline', (data) => {
    removeOnlineUser(data.username);
    addLogEntry(`${data.username} 退出了游戏`, 'system');
  });
  
  socket.on('online_list', (users) => {
    updateOnlineList(users);
  });
  
  socket.on('chat_message', (data) => {
    addChatMessage(data);
  });
  
  socket.on('game_event', (data) => {
    if (data.type === 'duel') {
      addLogEntry(data.message, 'combat');
    }
  });
  
  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });
}

// Load Character Data
async function loadCharacterData() {
  const token = window.authModule.getToken();
  if (!token) return;
  
  try {
    const response = await fetch('/api/character', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.hasCharacter) {
      characterData = data.character;
      updateCharacterUI(characterData);
      addLogEntry(`欢迎回来，${characterData.name}！`, 'system');
      addLogEntry(`当前位于：${getLocationName(characterData.location_id)}`, 'system');
    }
  } catch (error) {
    console.error('Load character error:', error);
  }
}

// Load Leaderboard
async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    const data = await response.json();
    
    const leaderboardEl = document.getElementById('leaderboard');
    leaderboardEl.innerHTML = '';
    
    data.leaderboard.forEach((entry, index) => {
      const div = document.createElement('div');
      div.className = 'leader-entry';
      div.innerHTML = `
        <span class="leader-rank">${index + 1}</span>
        <span class="leader-name">${entry.name}</span>
        <span class="leader-realm">${entry.realm_name}</span>
      `;
      leaderboardEl.appendChild(div);
    });
  } catch (error) {
    console.error('Load leaderboard error:', error);
  }
}

// Update Character UI
function updateCharacterUI(char) {
  // Header
  document.getElementById('player-name').textContent = char.name;
  
  // Character info
  document.getElementById('char-display-name').textContent = char.name;
  document.getElementById('char-realm').textContent = char.realm_name;
  
  // Status bars
  const hpPercent = (char.hp / char.max_hp) * 100;
  const qiPercent = (char.current_qi / char.max_qi) * 100;
  
  document.getElementById('hp-bar').style.width = `${hpPercent}%`;
  document.getElementById('hp-text').textContent = `${char.hp}/${char.max_hp}`;
  
  document.getElementById('qi-bar').style.width = `${qiPercent}%`;
  document.getElementById('qi-text').textContent = `${char.current_qi}/${char.max_qi}`;
  
  // Status details
  document.getElementById('spirit-root').textContent = char.spirit_root;
  document.getElementById('realm-level').textContent = char.realm_name;
  document.getElementById('attack').textContent = char.attack;
  document.getElementById('defense').textContent = char.defense;
  document.getElementById('gold').textContent = char.gold;
  document.getElementById('prestige').textContent = char.prestige;
  
  // Location
  const location = getLocationById(char.location_id);
  if (location) {
    document.getElementById('location-name').textContent = location.name;
    document.getElementById('location-desc').textContent = location.description;
  }
}

// Get location name by ID
function getLocationName(id) {
  const locations = {
    1: '青云宗',
    2: '青云山脚',
    3: '青云森林',
    4: '落日峡谷',
    5: '万魔渊'
  };
  return locations[id] || '未知地点';
}

function getLocationById(id) {
  const locations = {
    1: { name: '青云宗', description: '你所在的宗门，灵气充沛，适合修炼' },
    2: { name: '青云山脚', description: '宗门外的山脚，有一些低阶妖兽' },
    3: { name: '青云森林', description: '密林中常有修士历练，危机四伏' },
    4: { name: '落日峡谷', description: '峡谷中弥漫着诡异的气息' },
    5: { name: '万魔渊', description: '魔气纵横，是修士的禁地' }
  };
  return locations[id];
}

// Setup Action Buttons
function setupActionButtons() {
  const actionBtns = document.querySelectorAll('.action-btn');
  
  actionBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      
      if (action === 'refresh') {
        loadCharacterData();
        loadLeaderboard();
        addLogEntry('刷新了角色状态', 'system');
        return;
      }
      
      if (action === 'heal') {
        const token = window.authModule.getToken();
        try {
          const response = await fetch(`${GAME_API}/action`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action })
          });
          
          const data = await response.json();
          
          if (response.ok) {
            updateCharacterUI(data.character);
            addLogEntry(data.message, 'heal');
          } else {
            addLogEntry(data.error || '操作失败', 'system');
          }
        } catch (error) {
          console.error('Heal error:', error);
        }
        return;
      }
      
      // For meditate and explore, send request
      const token = window.authModule.getToken();
      
      try {
        const response = await fetch(`${GAME_API}/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Update UI
          updateCharacterUI(data.character);
          
          // Add log entry based on action type
          let logType = 'system';
          if (data.action === 'meditate') {
            logType = data.leveledUp ? 'levelup' : 'system';
          } else if (data.action === 'explore') {
            if (data.type === 'combat') {
              logType = data.won ? 'combat' : 'combat';
            } else if (data.type === 'treasure') {
              logType = 'treasure';
            }
          }
          
          addLogEntry(data.message, logType);
          
          // If location changed
          if (data.location) {
            document.getElementById('location-name').textContent = data.location.name;
            document.getElementById('location-desc').textContent = data.location.description;
          }
        } else {
          addLogEntry(data.error || '操作失败', 'system');
        }
      } catch (error) {
        console.error('Game action error:', error);
        addLogEntry('网络错误，请稍后重试', 'system');
      }
    });
  });
  
  // Travel buttons
  const travelBtns = document.querySelectorAll('.travel-btn');
  travelBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const locationId = btn.dataset.location;
      const token = window.authModule.getToken();
      
      try {
        const response = await fetch(`${GAME_API}/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'change_location', target: locationId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          updateCharacterUI(data.character);
          addLogEntry(data.message, 'system');
        } else {
          addLogEntry(data.error || '移动失败', 'system');
        }
      } catch (error) {
        console.error('Travel error:', error);
      }
    });
  });
}

// Setup Chat
function setupChat() {
  sendChatBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
}

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message || !socket) return;
  
  socket.emit('chat_message', { message });
  chatInput.value = '';
}

function addChatMessage(data) {
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `
    <span class="chat-sender">${data.characterName}</span>
    <span class="chat-realm"> [${data.realmName}]</span>
    <div class="chat-text">${escapeHtml(data.message)}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Setup Logout
function setupLogout() {
  logoutBtn.addEventListener('click', () => {
    if (socket) {
      socket.disconnect();
    }
    window.authModule.logout();
  });
}

// Add log entry
function addLogEntry(message, type = 'system') {
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.textContent = message;
  gameLog.appendChild(div);
  gameLog.scrollTop = gameLog.scrollHeight;
}

// Online users management
function addOnlineUser(user) {
  const onlineList = document.getElementById('online-list');
  const countEl = document.getElementById('online-count');
  
  // Check if user already exists
  const existing = document.querySelector(`.online-user[data-username="${user.username}"]`);
  if (existing) return;
  
  const div = document.createElement('div');
  div.className = 'online-user';
  div.dataset.username = user.username;
  div.innerHTML = `
    <span class="online-dot"></span>
    <span class="online-name">${user.characterName}</span>
    <span class="online-realm">${user.realmName}</span>
  `;
  onlineList.appendChild(div);
  
  // Update count
  countEl.textContent = document.querySelectorAll('.online-user').length;
}

function removeOnlineUser(username) {
  const user = document.querySelector(`.online-user[data-username="${username}"]`);
  if (user) {
    user.remove();
  }
  
  // Update count
  const countEl = document.getElementById('online-count');
  countEl.textContent = document.querySelectorAll('.online-user').length;
}

function updateOnlineList(users) {
  const onlineList = document.getElementById('online-list');
  const countEl = document.getElementById('online-count');
  
  onlineList.innerHTML = '';
  
  users.forEach(user => {
    const div = document.createElement('div');
    div.className = 'online-user';
    div.dataset.username = user.username;
    div.innerHTML = `
      <span class="online-dot"></span>
      <span class="online-name">${user.characterName}</span>
      <span class="online-realm">${user.realmName}</span>
    `;
    onlineList.appendChild(div);
  });
  
  countEl.textContent = users.length;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Auto-init when game screen is shown
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.target.id === 'game-screen' && !mutation.target.classList.contains('hidden')) {
      initGame();
      observer.disconnect();
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });
