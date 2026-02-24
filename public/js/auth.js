// ==================== Auth Module ====================

const AUTH_API = '/api/auth';

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const charCreateScreen = document.getElementById('char-create-screen');
const gameScreen = document.getElementById('game-screen');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const charCreateForm = document.getElementById('char-create-form');

const tabBtns = document.querySelectorAll('.tab-btn');
const authMessage = document.getElementById('auth-message');
const charCreateMessage = document.getElementById('char-create-message');

// Get token from localStorage
let authToken = localStorage.getItem('dao_path_token');
let currentUser = localStorage.getItem('dao_path_user');

// Check if user is already logged in
if (authToken) {
  checkAuth();
}

// Tab switching
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if (tab === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    }
    
    hideMessage(authMessage);
  });
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!username || !password) {
    showMessage(authMessage, '请填写用户名和密码', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${AUTH_API}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      authToken = data.token;
      currentUser = data.username;
      localStorage.setItem('dao_path_token', authToken);
      localStorage.setItem('dao_path_user', currentUser);
      
      // Check if user has character
      checkCharacter();
    } else {
      showMessage(authMessage, data.error || '登录失败', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showMessage(authMessage, '网络错误，请稍后重试', 'error');
  }
});

// Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  
  if (!username || !password) {
    showMessage(authMessage, '请填写用户名和密码', 'error');
    return;
  }
  
  if (username.length < 3 || username.length > 20) {
    showMessage(authMessage, '用户名长度需在3-20个字符之间', 'error');
    return;
  }
  
  if (password.length < 6) {
    showMessage(authMessage, '密码长度至少6个字符', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${AUTH_API}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      authToken = data.token;
      currentUser = data.username;
      localStorage.setItem('dao_path_token', authToken);
      localStorage.setItem('dao_path_user', currentUser);
      
      showMessage(authMessage, '注册成功！请创建你的角色', 'success');
      
      // Switch to character creation after a short delay
      setTimeout(() => {
        showCharCreateScreen();
      }, 1000);
    } else {
      showMessage(authMessage, data.error || '注册失败', 'error');
    }
  } catch (error) {
    console.error('Register error:', error);
    showMessage(authMessage, '网络错误，请稍后重试', 'error');
  }
});

// Character Creation
charCreateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('char-name').value.trim();
  const gender = document.querySelector('input[name="gender"]:checked').value;
  const spiritRoot = document.querySelector('input[name="spiritRoot"]:checked').value;
  
  if (!name || name.length < 2 || name.length > 10) {
    showMessage(charCreateMessage, '名字长度需在2-10个字符之间', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${AUTH_API}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        username: currentUser, 
        password: 'temp_password_for_char_creation' 
      })
    });
    
    // Actually we need to use the character create endpoint
    const charResponse = await fetch('/api/character/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ name, gender, spiritRoot })
    });
    
    const charData = await charResponse.json();
    
    if (charResponse.ok) {
      // Successfully created character, go to game
      showGameScreen();
    } else {
      // Need to register first, then create character
      if (charResponse.status === 401 || charResponse.status === 403) {
        showMessage(charCreateMessage, '会话已过期，请重新登录', 'error');
        setTimeout(() => {
          showAuthScreen();
        }, 1500);
        return;
      }
      showMessage(charCreateMessage, charData.error || '创建角色失败', 'error');
    }
  } catch (error) {
    console.error('Create character error:', error);
    showMessage(charCreateMessage, '网络错误，请稍后重试', 'error');
  }
});

// Check authentication
async function checkAuth() {
  if (!authToken) {
    showAuthScreen();
    return;
  }
  
  try {
    const response = await fetch('/api/character', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.hasCharacter) {
        showGameScreen();
      } else {
        showCharCreateScreen();
      }
    } else {
      // Token invalid
      logout();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    showAuthScreen();
  }
}

// Check if user has character
async function checkCharacter() {
  try {
    const response = await fetch('/api/character', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    
    if (data.hasCharacter) {
      showGameScreen();
    } else {
      showCharCreateScreen();
    }
  } catch (error) {
    console.error('Check character error:', error);
    showAuthScreen();
  }
}

// Logout
function logout() {
  localStorage.removeItem('dao_path_token');
  localStorage.removeItem('dao_path_user');
  authToken = null;
  currentUser = null;
  showAuthScreen();
}

// Screen management
function showAuthScreen() {
  authScreen.classList.remove('hidden');
  charCreateScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
}

function showCharCreateScreen() {
  authScreen.classList.add('hidden');
  charCreateScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');
}

function showGameScreen() {
  authScreen.classList.add('hidden');
  charCreateScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
}

// Message helper
function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
}

function hideMessage(element) {
  element.className = 'message hidden';
}

// Export for use in other modules
window.authModule = {
  getToken: () => authToken,
  getUser: () => currentUser,
  logout,
  checkCharacter
};
