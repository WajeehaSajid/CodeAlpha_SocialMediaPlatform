/* ================================================================
   auth.js — Aether Login / Register Page
================================================================ */

// ── Utilities ─────────────────────────────────────────────────
function showToast(message, type) {
  type = type || 'info';
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  const icon = document.createElement('span');
  icon.textContent = icons[type] || 'ℹ️';
  const msg = document.createElement('span');
  msg.textContent = message;
  toast.appendChild(icon);
  toast.appendChild(msg);
  container.appendChild(toast);
  setTimeout(function () {
    toast.classList.add('dismissing');
    setTimeout(function () { toast.remove(); }, 300);
  }, 3000);
}

function showFormError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
}

function hideFormError(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.classList.remove('show');
}

function setButtonLoading(btnId, loading, text) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div>';
  } else {
    btn.textContent = text || btn.dataset.originalText || 'Submit';
  }
}

// ── Tab Switch ────────────────────────────────────────────────
function switchAuthTab(tab) {
  const loginSection = document.getElementById('login-section');
  const registerSection = document.getElementById('register-section');
  const loginTabBtn = document.getElementById('login-tab-btn');
  const registerTabBtn = document.getElementById('register-tab-btn');

  if (tab === 'login') {
    loginSection.classList.add('active');
    registerSection.classList.remove('active');
    loginTabBtn.classList.add('active');
    loginTabBtn.setAttribute('aria-selected', 'true');
    registerTabBtn.classList.remove('active');
    registerTabBtn.setAttribute('aria-selected', 'false');
    hideFormError('login-error');
  } else {
    registerSection.classList.add('active');
    loginSection.classList.remove('active');
    registerTabBtn.classList.add('active');
    registerTabBtn.setAttribute('aria-selected', 'true');
    loginTabBtn.classList.remove('active');
    loginTabBtn.setAttribute('aria-selected', 'false');
    hideFormError('register-error');
  }
}

// ── Login ─────────────────────────────────────────────────────
async function handleLogin(event) {
  event.preventDefault();
  hideFormError('login-error');

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showFormError('login-error', 'Please fill in all fields.');
    return;
  }

  setButtonLoading('login-submit-btn', true);

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      showFormError('login-error', data.message || 'Login failed. Please try again.');
      return;
    }

    localStorage.setItem('cs_token', data.token);
    localStorage.setItem('cs_user', JSON.stringify(data.user));
    showToast('Welcome back! Redirecting...', 'success');
    setTimeout(function () { window.location.href = '/feed.html'; }, 800);
  } catch (err) {
    showFormError('login-error', 'Network error. Please check your connection and try again.');
  } finally {
    setButtonLoading('login-submit-btn', false, 'Sign In');
  }
}

// ── Register ──────────────────────────────────────────────────
async function handleRegister(event) {
  event.preventDefault();
  hideFormError('register-error');

  const name = document.getElementById('register-name').value.trim();
  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  if (!name || !username || !email || !password) {
    showFormError('register-error', 'All fields are required.');
    return;
  }
  if (username.length < 3) {
    showFormError('register-error', 'Username must be at least 3 characters.');
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showFormError('register-error', 'Username can only contain letters, numbers, and underscores.');
    return;
  }
  if (password.length < 6) {
    showFormError('register-error', 'Password must be at least 6 characters.');
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showFormError('register-error', 'Please enter a valid email address.');
    return;
  }

  setButtonLoading('register-submit-btn', true);

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, username: username, email: email, password: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      showFormError('register-error', data.message || 'Registration failed. Please try again.');
      return;
    }

    localStorage.setItem('cs_token', data.token);
    localStorage.setItem('cs_user', JSON.stringify(data.user));
    showToast('Account created! Welcome to Aether 🎉', 'success');
    setTimeout(function () { window.location.href = '/feed.html'; }, 900);
  } catch (err) {
    showFormError('register-error', 'Network error. Please check your connection and try again.');
  } finally {
    setButtonLoading('register-submit-btn', false, 'Create Account');
  }
}

// ── Init ──────────────────────────────────────────────────────
(function init() {
  // If already logged in, go to feed
  var token = localStorage.getItem('cs_token');
  if (token) {
    fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (res) {
        if (res.ok) {
          window.location.href = '/feed.html';
        } else {
          localStorage.removeItem('cs_token');
          localStorage.removeItem('cs_user');
        }
      })
      .catch(function () { /* stay on page */ });
  }

  // Attach form submit listeners via JS (avoids CSP issues with inline onsubmit)
  var loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  var registerForm = document.getElementById('register-form');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  // Tab buttons
  var loginTabBtn = document.getElementById('login-tab-btn');
  if (loginTabBtn) loginTabBtn.addEventListener('click', function () { switchAuthTab('login'); });

  var registerTabBtn = document.getElementById('register-tab-btn');
  if (registerTabBtn) registerTabBtn.addEventListener('click', function () { switchAuthTab('register'); });

  // "Create one" / "Sign in" links
  var switchToRegister = document.getElementById('switch-to-register');
  if (switchToRegister) switchToRegister.addEventListener('click', function (e) { e.preventDefault(); switchAuthTab('register'); });

  var switchToLogin = document.getElementById('switch-to-login');
  if (switchToLogin) switchToLogin.addEventListener('click', function (e) { e.preventDefault(); switchAuthTab('login'); });

  // Hash-based tab
  if (window.location.hash === '#register') {
    switchAuthTab('register');
  }
})();