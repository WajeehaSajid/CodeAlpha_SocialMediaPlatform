/* ================================================================
   utils.js — Shared Utilities for Aether
================================================================ */

// ── API Helper ────────────────────────────────────────────────
function getToken() { return localStorage.getItem('cs_token'); }

function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, { ...options, headers });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('dismissing');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Time ──────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const s = Math.floor((now - date) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── Misc ──────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function updateCharCounter(textarea, counterId, maxLen) {
  const counter = document.getElementById(counterId);
  if (!counter) return;
  const remaining = maxLen - textarea.value.length;
  counter.textContent = remaining;
  counter.className = 'char-counter';
  if (remaining <= 20) counter.classList.add('warning');
  if (remaining <= 0) counter.classList.add('danger');
}

// ── Avatar Renderer ───────────────────────────────────────────
function renderAvatar(container, user, sizeClass = '') {
  if (!container) return;
  if (user?.avatar?.url) {
    container.innerHTML = `<img src="${escapeHtml(user.avatar.url)}" alt="${escapeHtml(user.name)}'s avatar" loading="lazy">`;
  } else {
    container.textContent = getInitials(user?.name || '?');
  }
}

// ── Lightbox ──────────────────────────────────────────────────
function openLightbox(src) {
  const existing = document.getElementById('lightbox');
  if (existing) existing.remove();
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.id = 'lightbox';
  lb.innerHTML = `<button class="lightbox-close" aria-label="Close image">✕</button><img src="${escapeHtml(src)}" alt="Post image">`;
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('lightbox-close')) lb.remove();
  });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(lb);
}

// ── Emoji Picker ──────────────────────────────────────────────
const EMOJI_CATEGORIES = {
  '😊': ['😊','😂','🤣','❤️','😍','🥰','😘','😁','😎','🤩','🥳','😜','🤪','😏','😒','🙄','😢','😭','😤','😡','🤬','🥺','😳','🤯','😱','😰','😅','🤗','🤔','😐','😑','🤤','😴','😷','🤒','🤕','🤑','🤠','👻','🤖','🤡','💩','☠️','🙃','😋','😛','😝','🤓','🥸','🧐','😔','😟','😦','😧','😮','😲','🥱','😪','🤢','🤮','🤧','🥵','🥶','😈','👿'],
  '👍': ['👍','👎','👏','🙌','🤝','🤜','🤛','✊','👊','🤚','🖐','✋','🤙','💪','🦾','🖖','☝️','👆','👇','👉','👈','🤞','🤟','🤘','👌','🤌','🤏','✌️','🤙','🙏','💅','🤳','💃','🕺','👶','🧒','👦','👧','🧑','👱','👩','🧔','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷'],
  '❤️': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','✡️','🔯','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫'],
  '🎉': ['🎉','🎊','🎈','🎁','🎀','🎗','🎟','🎫','🎖','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🥎','🏐','🏉','🎾','🏸','🏒','🏑','🏓','🏏','🎿','🛷','🥌','🎯','🎱','🔫','🎮','🕹','🎲','♟','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎤','📻','📱','📲','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🧭','⏱','⏲','⏰','🕰','⌛','⏳','📡','🔋','🔌','💻','🖥','🖨','⌨️','🖱','🖲','💾','💿','📀','🧮'],
  '🌸': ['🌸','🌺','🌻','🌹','🌷','💐','🌿','☘️','🍀','🎋','🎍','🍃','🍂','🍁','🍄','🌾','💮','🌱','🌲','🌳','🌴','🌵','🎄','🌊','🌀','🌈','🌂','☂️','⛱','⚡','❄️','☃️','⛄','🌤','⛅','🌥','🌦','🌧','⛈','🌩','🌨','🌫','🌬','🌀','🌈','🌂','🌡','⭐','🌟','💫','✨','🌙','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌝','🌞','☀️','🌤','⛅','🌥','🌦','🌧','⛈','🌩','🌨','⛅'],
  '🍕': ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥖','🥨','🥯','🧀','🥗','🥙','🌮','🌯','🫔','🥪','🫕','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'],
};

function createEmojiPicker(targetTextareaId, triggerBtnId) {
  const existing = document.getElementById(`emoji-picker-${targetTextareaId}`);
  if (existing) {
    existing.classList.toggle('open');
    return;
  }

  const wrap = document.getElementById(triggerBtnId)?.parentElement;
  if (!wrap) return;

  const picker = document.createElement('div');
  picker.className = 'emoji-picker open';
  picker.id = `emoji-picker-${targetTextareaId}`;

  const categories = Object.keys(EMOJI_CATEGORIES);

  // Tabs
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'emoji-picker-tabs';
  categories.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'emoji-tab-btn' + (i === 0 ? ' active' : '');
    btn.textContent = cat;
    btn.title = cat;
    btn.onclick = () => {
      picker.querySelectorAll('.emoji-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid(cat);
    };
    tabsDiv.appendChild(btn);
  });
  picker.appendChild(tabsDiv);

  const grid = document.createElement('div');
  grid.className = 'emoji-grid';
  picker.appendChild(grid);

  function renderGrid(cat) {
    grid.innerHTML = '';
    EMOJI_CATEGORIES[cat].forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'emoji-btn';
      btn.textContent = emoji;
      btn.title = emoji;
      btn.onclick = () => {
        const textarea = document.getElementById(targetTextareaId);
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.slice(0, start) + emoji + textarea.value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
        textarea.dispatchEvent(new Event('input'));
      };
      grid.appendChild(btn);
    });
  }
  renderGrid(categories[0]);

  wrap.style.position = 'relative';
  wrap.appendChild(picker);

  // Close on outside click
  function handleOutside(e) {
    if (!picker.contains(e.target) && e.target.id !== triggerBtnId) {
      picker.classList.remove('open');
      document.removeEventListener('mousedown', handleOutside);
    }
  }
  setTimeout(() => document.addEventListener('mousedown', handleOutside), 10);
}

// ── Followers/Following Modal ─────────────────────────────────
async function openFollowModal(userId, type) {
  const existing = document.getElementById('follow-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'follow-modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">${type === 'followers' ? 'Followers' : 'Following'}</span>
      <button class="modal-close" onclick="document.getElementById('follow-modal-overlay').remove()">✕</button>
    </div>
    <div class="modal-body" id="follow-modal-body">
      <div style="text-align:center;padding:30px;"><div class="spinner" style="margin:0 auto;"></div></div>
    </div>`;

  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  try {
    const res = await apiFetch(`/api/users/${userId}/${type}`);
    const data = await res.json();
    const users = type === 'followers' ? data.followers : data.following;
    const body = document.getElementById('follow-modal-body');

    if (!users || users.length === 0) {
      body.innerHTML = `<div class="search-empty"><div class="icon">${type === 'followers' ? '👥' : '👤'}</div><p>No ${type} yet.</p></div>`;
      return;
    }

    body.innerHTML = '';
    users.forEach(u => {
      if (!u) return;
      const item = document.createElement('div');
      item.className = 'modal-user-item';
      item.onclick = () => { overlay.remove(); window.location.href = `/profile.html?username=${u.username}`; };

      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'avatar avatar-sm';
      if (u.avatar?.url) {
        avatarDiv.innerHTML = `<img src="${escapeHtml(u.avatar.url)}" alt="${escapeHtml(u.name)}">`;
      } else {
        avatarDiv.textContent = getInitials(u.name);
      }

      item.innerHTML = `
        <div class="modal-user-info">
          <div class="modal-user-name">${escapeHtml(u.name)}</div>
          <div class="modal-user-handle">@${escapeHtml(u.username)}</div>
        </div>`;
      item.prepend(avatarDiv);
      body.appendChild(item);
    });
  } catch {
    document.getElementById('follow-modal-body').innerHTML = '<p style="padding:20px;color:var(--text-muted);">Failed to load.</p>';
  }
}
