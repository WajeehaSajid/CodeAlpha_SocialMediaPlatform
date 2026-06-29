/* ================================================================
   profile.js — Aether v2 Profile Page
================================================================ */

let currentUser = null;
let profileUser = null;
let isOwnProfile = false;
let currentTab = 'posts';
let postsPage = 1, postsHasMore = false, postsLoading = false;
let likedPage = 1, likedHasMore = false, likedLoading = false;

// ── Init ──────────────────────────────────────────────────────
(async function init() {
  const token = localStorage.getItem('cs_token');
  if (!token) { window.location.href = '/index.html'; return; }
  try {
    const res = await apiFetch('/api/auth/me');
    if (!res.ok) throw new Error();
    const data = await res.json();
    currentUser = data.user;
    localStorage.setItem('cs_user', JSON.stringify(currentUser));
  } catch {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
    window.location.href = '/index.html';
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const username = params.get('username');
  if (!username) { window.location.href = '/profile.html?username=' + currentUser.username; return; }
  await loadProfile(username);
})();

function getToken() { return localStorage.getItem('cs_token'); }

function apiFetch(url, options) {
  options = options || {};
  const token = getToken();
  const headers = Object.assign({}, options.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(url, Object.assign({}, options, { headers }));
}

function showToast(message, type) {
  type = type || 'info';
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span>' + (icons[type] || 'ℹ️') + '</span><span>' + escapeHtml(message) + '</span>';
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('dismissing'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}

function timeAgo(dateStr) {
  const date = new Date(dateStr), now = new Date();
  const s = Math.floor((now - date) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s/60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m/60); if (h < 24) return h + 'h ago';
  const d = Math.floor(h/24); if (d < 7) return d + 'd ago';
  const w = Math.floor(d/7); if (w < 5) return w + 'w ago';
  const mo = Math.floor(d/30); if (mo < 12) return mo + 'mo ago';
  return Math.floor(d/365) + 'y ago';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

function renderAvatar(container, user) {
  if (!container) return;
  if (user && user.avatar && user.avatar.url) {
    container.innerHTML = '<img src="' + escapeHtml(user.avatar.url) + '" alt="' + escapeHtml(user.name || '') + '" loading="lazy">';
  } else {
    container.textContent = getInitials(user ? user.name : '?');
  }
}

function openLightbox(src) {
  const existing = document.getElementById('lightbox');
  if (existing) existing.remove();
  const lb = document.createElement('div');
  lb.className = 'lightbox'; lb.id = 'lightbox';
  lb.innerHTML = '<button class="lightbox-close">✕</button><img src="' + escapeHtml(src) + '" alt="Post image">';
  lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lightbox-close')) lb.remove(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); } });
  document.body.appendChild(lb);
}

function goBack() {
  if (document.referrer && document.referrer !== window.location.href) window.history.back();
  else window.location.href = '/feed.html';
}
function goToFeed() { window.location.href = '/feed.html'; }
function viewProfile(username) { window.location.href = '/profile.html?username=' + username; }
function logout() { localStorage.removeItem('cs_token'); localStorage.removeItem('cs_user'); window.location.href = '/index.html'; }

// ── Load Profile ──────────────────────────────────────────────
async function loadProfile(username) {
  try {
    const res = await apiFetch('/api/users/' + username.toLowerCase());
    const data = await res.json();
    if (!res.ok) {
      document.getElementById('profile-header-skeleton').innerHTML =
        '<div class="empty-state"><div class="empty-icon">👤</div><h3>User not found</h3><p>This account doesn\'t exist or has been removed.</p></div>';
      return;
    }
    profileUser = data.user;
    isOwnProfile = currentUser && currentUser._id === profileUser._id;
    renderProfileHeader();
    loadProfilePosts(1);
  } catch { showToast('Failed to load profile.', 'error'); }
}

// ── Render Profile Header ─────────────────────────────────────
async function renderProfileHeader() {
  const user = profileUser;
  document.getElementById('profile-header-skeleton').style.display = 'none';
  const header = document.getElementById('profile-header');
  header.style.display = 'block';
  document.getElementById('profile-content').style.display = 'block';
  document.title = user.name + ' (@' + user.username + ') — Aether';

  // Avatar
  const avatarEl = document.getElementById('profile-avatar');
  renderAvatar(avatarEl, user);

  // Add upload overlay for own profile
  if (isOwnProfile) {
    const overlay = document.createElement('div');
    overlay.className = 'avatar-upload-overlay';
    overlay.innerHTML = '📷';
    overlay.onclick = () => document.getElementById('avatar-upload-input').click();
    avatarEl.appendChild(overlay);
  }

  document.getElementById('profile-name').textContent = user.name;
  document.getElementById('profile-handle').textContent = '@' + user.username;

  const bioEl = document.getElementById('profile-bio');
  if (user.bio) { bioEl.textContent = user.bio; bioEl.style.color = ''; bioEl.style.fontStyle = ''; }
  else { bioEl.textContent = isOwnProfile ? 'Add a bio to tell people about yourself.' : 'No bio yet.'; bioEl.style.color = 'var(--text-muted)'; bioEl.style.fontStyle = 'italic'; }

  document.getElementById('profile-join-date').textContent = formatDate(user.createdAt);
  document.getElementById('profile-posts-count').textContent = user.postCount || 0;
  document.getElementById('profile-followers-count').textContent = user.followerCount || 0;
  document.getElementById('profile-following-count').textContent = user.followingCount || 0;

  // Make stats clickable for follower/following modal
  const followerStat = document.getElementById('stat-followers');
  const followingStat = document.getElementById('stat-following');
  if (followerStat) { followerStat.setAttribute('data-clickable','1'); followerStat.style.cursor = 'pointer'; followerStat.onclick = () => openFollowModal(user._id, 'followers'); }
  if (followingStat) { followingStat.setAttribute('data-clickable','1'); followingStat.style.cursor = 'pointer'; followingStat.onclick = () => openFollowModal(user._id, 'following'); }

  // Action buttons
  const actionsEl = document.getElementById('profile-actions');
  actionsEl.innerHTML = '';

  if (isOwnProfile) {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.id = 'edit-profile-btn';
    editBtn.textContent = '✏️ Edit Profile';
    editBtn.onclick = toggleEditProfile;
    actionsEl.appendChild(editBtn);

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'btn btn-ghost';
    settingsBtn.textContent = '⚙️ Settings';
    settingsBtn.onclick = openSettings;
    actionsEl.appendChild(settingsBtn);

    document.getElementById('edit-name').value = user.name;
    document.getElementById('edit-bio').value = user.bio || '';
    updateCharCounter(document.getElementById('edit-bio'), 'bio-char-counter', 160);
  } else {
    let isFollowing = false;
    try {
      const followRes = await apiFetch('/api/users/' + user._id + '/followers');
      const followData = await followRes.json();
      isFollowing = followData.followers?.some(f => f && f._id === currentUser._id);
    } catch {}

    const followBtn = document.createElement('button');
    followBtn.className = 'btn ' + (isFollowing ? 'btn-secondary' : 'btn-primary');
    followBtn.id = 'follow-btn';
    followBtn.textContent = isFollowing ? '✅ Following' : '➕ Follow';
    followBtn.onclick = () => toggleFollow(user._id, followBtn);
    actionsEl.appendChild(followBtn);

    const msgBtn = document.createElement('button');
    msgBtn.className = 'btn btn-ghost';
    msgBtn.textContent = '💬 Message';
    msgBtn.onclick = () => showToast('Messaging coming soon!', 'info');
    actionsEl.appendChild(msgBtn);
  }
}

// ── Avatar Upload ─────────────────────────────────────────────
async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Only image files allowed.', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB.', 'error'); return; }

  const avatarEl = document.getElementById('profile-avatar');
  const sidebarAv = document.getElementById('sidebar-avatar');

  // Show loading
  showToast('Uploading avatar...', 'info');

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const res = await apiFetch('/api/upload/avatar', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Upload failed.', 'error'); return; }

    // Update UI
    profileUser.avatar = { url: data.url };
    currentUser.avatar = { url: data.url };
    localStorage.setItem('cs_user', JSON.stringify(currentUser));

    renderAvatar(avatarEl, profileUser);
    // Re-add overlay
    const overlay = document.createElement('div');
    overlay.className = 'avatar-upload-overlay';
    overlay.innerHTML = '📷';
    overlay.onclick = () => document.getElementById('avatar-upload-input').click();
    avatarEl.appendChild(overlay);

    showToast('Avatar updated! 📸', 'success');
  } catch { showToast('Upload failed.', 'error'); }
  finally { e.target.value = ''; }
}

// ── Edit Profile ──────────────────────────────────────────────
function toggleEditProfile() {
  const form = document.getElementById('edit-profile-form');
  form.classList.toggle('show');
  const btn = document.getElementById('edit-profile-btn');
  if (form.classList.contains('show')) { btn.textContent = '✕ Cancel Edit'; form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  else btn.textContent = '✏️ Edit Profile';
}

function cancelEditProfile() {
  const form = document.getElementById('edit-profile-form');
  form.classList.remove('show');
  const btn = document.getElementById('edit-profile-btn');
  if (btn) btn.textContent = '✏️ Edit Profile';
  document.getElementById('edit-name').value = profileUser?.name || '';
  document.getElementById('edit-bio').value = profileUser?.bio || '';
  const errorEl = document.getElementById('edit-profile-error');
  if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('show'); }
}

async function saveProfile() {
  const name = document.getElementById('edit-name').value.trim();
  const bio = document.getElementById('edit-bio').value.trim();
  const errorEl = document.getElementById('edit-profile-error');
  if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('show'); }
  if (!name) { if (errorEl) { errorEl.textContent = 'Name cannot be empty.'; errorEl.classList.add('show'); } return; }

  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    const res = await apiFetch('/api/users/me', { method: 'PUT', body: JSON.stringify({ name, bio }) });
    const data = await res.json();
    if (!res.ok) { if (errorEl) { errorEl.textContent = data.message || 'Failed.'; errorEl.classList.add('show'); } return; }

    profileUser = Object.assign({}, profileUser, { name: data.user.name, bio: data.user.bio });
    currentUser = Object.assign({}, currentUser, { name: data.user.name, bio: data.user.bio });
    localStorage.setItem('cs_user', JSON.stringify(currentUser));

    document.getElementById('profile-name').textContent = data.user.name;
    renderAvatar(document.getElementById('profile-avatar'), profileUser);
    // Re-add upload overlay
    const overlay = document.createElement('div');
    overlay.className = 'avatar-upload-overlay';
    overlay.innerHTML = '📷';
    overlay.onclick = () => document.getElementById('avatar-upload-input').click();
    document.getElementById('profile-avatar').appendChild(overlay);

    const bioEl = document.getElementById('profile-bio');
    if (data.user.bio) { bioEl.textContent = data.user.bio; bioEl.style.color = ''; bioEl.style.fontStyle = ''; }
    else { bioEl.textContent = 'Add a bio to tell people about yourself.'; bioEl.style.color = 'var(--text-muted)'; bioEl.style.fontStyle = 'italic'; }

    cancelEditProfile();
    showToast('Profile updated! ✨', 'success');
  } catch { if (errorEl) { errorEl.textContent = 'Network error.'; errorEl.classList.add('show'); } }
  finally { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; } }
}

// ── Follow / Unfollow ─────────────────────────────────────────
async function toggleFollow(userId, btn) {
  const isFollowing = btn.textContent.includes('Following');
  btn.disabled = true;
  try {
    const method = isFollowing ? 'DELETE' : 'POST';
    const res = await apiFetch('/api/users/' + userId + '/follow', { method });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    if (isFollowing) { btn.className = 'btn btn-primary'; btn.textContent = '➕ Follow'; showToast('Unfollowed.', 'info'); }
    else { btn.className = 'btn btn-secondary'; btn.textContent = '✅ Following'; showToast('Followed! 🎉', 'success'); }
    const fc = document.getElementById('profile-followers-count');
    if (fc) fc.textContent = data.followerCount;
    if (profileUser) profileUser.followerCount = data.followerCount;
  } catch { showToast('Network error.', 'error'); }
  finally { btn.disabled = false; }
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
  box.innerHTML =
    '<div class="modal-header"><span class="modal-title">' + (type === 'followers' ? 'Followers' : 'Following') + '</span>' +
    '<button class="modal-close" onclick="document.getElementById(\'follow-modal-overlay\').remove()">✕</button></div>' +
    '<div class="modal-body" id="follow-modal-body"><div style="text-align:center;padding:30px;"><div class="spinner" style="margin:0 auto;"></div></div></div>';
  overlay.appendChild(box);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  try {
    const res = await apiFetch('/api/users/' + userId + '/' + type);
    const data = await res.json();
    const users = type === 'followers' ? data.followers : data.following;
    const body = document.getElementById('follow-modal-body');

    if (!users || users.length === 0) {
      body.innerHTML = '<div class="search-empty"><div class="icon">' + (type === 'followers' ? '👥' : '👤') + '</div><p>No ' + type + ' yet.</p></div>';
      return;
    }

    body.innerHTML = '';
    users.forEach(u => {
      if (!u) return;
      const item = document.createElement('div');
      item.className = 'modal-user-item';
      item.onclick = () => { overlay.remove(); window.location.href = '/profile.html?username=' + u.username; };
      const av = document.createElement('div');
      av.className = 'avatar avatar-sm';
      renderAvatar(av, u);
      item.innerHTML = '<div class="modal-user-info"><div class="modal-user-name">' + escapeHtml(u.name) + '</div><div class="modal-user-handle">@' + escapeHtml(u.username) + '</div></div>';
      item.prepend(av);
      body.appendChild(item);
    });
  } catch {
    const body = document.getElementById('follow-modal-body');
    if (body) body.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Failed to load.</p>';
  }
}

// ── Settings Panel ────────────────────────────────────────────
function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-panel').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-panel').classList.remove('open');
}

async function changePassword() {
  const currentPwd = document.getElementById('current-password').value;
  const newPwd = document.getElementById('new-password').value;
  const confirmPwd = document.getElementById('confirm-password').value;
  const errorEl = document.getElementById('password-error');
  if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('show'); }

  if (!currentPwd || !newPwd || !confirmPwd) {
    if (errorEl) { errorEl.textContent = 'All fields required.'; errorEl.classList.add('show'); } return;
  }
  if (newPwd !== confirmPwd) {
    if (errorEl) { errorEl.textContent = 'New passwords do not match.'; errorEl.classList.add('show'); } return;
  }
  if (newPwd.length < 6) {
    if (errorEl) { errorEl.textContent = 'Password must be at least 6 characters.'; errorEl.classList.add('show'); } return;
  }

  const btn = document.getElementById('change-password-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Changing...'; }
  try {
    const res = await apiFetch('/api/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }) });
    const data = await res.json();
    if (!res.ok) { if (errorEl) { errorEl.textContent = data.message || 'Failed.'; errorEl.classList.add('show'); } return; }
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    showToast('Password changed successfully! 🔒', 'success');
  } catch { if (errorEl) { errorEl.textContent = 'Network error.'; errorEl.classList.add('show'); } }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Change Password'; } }
}

async function deleteAccount() {
  const password = document.getElementById('delete-password').value;
  if (!password) { showToast('Enter your password to confirm.', 'error'); return; }

  if (!confirm('Are you absolutely sure? This will permanently delete your account, all posts, and all data. This cannot be undone.')) return;

  const btn = document.getElementById('delete-account-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }
  try {
    const res = await apiFetch('/api/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
    showToast('Account deleted. Goodbye! 👋', 'info');
    setTimeout(() => { window.location.href = '/index.html'; }, 1500);
  } catch { showToast('Network error.', 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Delete My Account'; } }
}

// ── Profile Tabs ──────────────────────────────────────────────
function switchProfileTab(tab) {
  currentTab = tab;
  const tabs = ['posts', 'liked'];
  tabs.forEach(t => {
    const btn = document.getElementById('tab-' + t);
    const panel = document.getElementById('profile-' + t + '-panel');
    if (btn) { btn.classList.toggle('active', t === tab); btn.setAttribute('aria-selected', String(t === tab)); }
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'liked') {
    const likedList = document.getElementById('profile-liked-list');
    if (likedList && likedList.innerHTML.trim() === '') loadLikedPosts(1);
  }
}

// ── Load Posts ────────────────────────────────────────────────
async function loadProfilePosts(page) {
  page = page || 1;
  if (postsLoading || !profileUser) return;
  postsLoading = true;
  const skeleton = document.getElementById('profile-posts-skeleton');
  const lmw = document.getElementById('profile-load-more-wrap');
  const list = document.getElementById('profile-posts-list');
  if (page === 1 && skeleton) skeleton.style.display = 'block';
  if (lmw) lmw.style.display = 'none';
  try {
    const res = await apiFetch('/api/posts/user/' + profileUser._id + '?page=' + page);
    const data = await res.json();
    if (skeleton) skeleton.style.display = 'none';
    if (!res.ok) { showToast('Failed to load posts.', 'error'); return; }
    if (page === 1) list.innerHTML = '';
    if (data.posts.length === 0 && page === 1) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><h3>No posts yet</h3><p>' + (isOwnProfile ? 'Share your first thought!' : escapeHtml(profileUser.name) + " hasn't posted yet.") + '</p></div>';
      return;
    }
    data.posts.forEach(p => list.appendChild(createProfilePostCard(p)));
    postsPage = data.currentPage; postsHasMore = data.hasMore;
    if (postsHasMore && lmw) lmw.style.display = 'block';
  } catch { if (skeleton) skeleton.style.display = 'none'; showToast('Failed to load posts.', 'error'); }
  finally { postsLoading = false; }
}
function loadMoreProfilePosts() { if (!postsHasMore || postsLoading) return; loadProfilePosts(postsPage + 1); }

async function loadLikedPosts(page) {
  page = page || 1;
  if (likedLoading || !profileUser) return;
  likedLoading = true;
  const lmw = document.getElementById('profile-liked-load-more-wrap');
  const list = document.getElementById('profile-liked-list');
  if (page === 1) list.innerHTML = '<div class="spinner" style="margin:30px auto;"></div>';
  if (lmw) lmw.style.display = 'none';
  try {
    const res = await apiFetch('/api/posts/liked/' + profileUser._id + '?page=' + page);
    const data = await res.json();
    if (!res.ok) { list.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Failed to load.</p>'; return; }
    if (page === 1) list.innerHTML = '';
    if (data.posts.length === 0 && page === 1) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">❤️</div><h3>No liked posts</h3><p>' + (isOwnProfile ? 'Posts you like will appear here.' : escapeHtml(profileUser.name) + " hasn't liked any posts.") + '</p></div>';
      return;
    }
    data.posts.forEach(p => list.appendChild(createProfilePostCard(p)));
    likedPage = data.currentPage; likedHasMore = data.hasMore;
    if (likedHasMore && lmw) lmw.style.display = 'block';
  } catch { list.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Error loading.</p>'; }
  finally { likedLoading = false; }
}
function loadMoreLikedPosts() { if (!likedHasMore || likedLoading) return; loadLikedPosts(likedPage + 1); }

// ── Profile Post Card ─────────────────────────────────────────
function createProfilePostCard(post) {
  const isOwn = currentUser && post.author._id === currentUser._id;
  const card = document.createElement('div');
  card.className = 'glass-card profile-post-card';
  card.dataset.postId = post._id;

  const av = document.createElement('div');
  av.className = 'avatar avatar-sm';
  renderAvatar(av, post.author);

  card.innerHTML =
    '<div class="post-header" style="margin-bottom:10px;">' +
    '<div class="post-header-avatar-slot"></div>' +
    '<div class="post-meta"><div class="post-author-row">' +
    '<span class="post-author-name" onclick="viewProfile(\'' + escapeHtml(post.author.username) + '\')" style="cursor:pointer;">' + escapeHtml(post.author.name) + '</span>' +
    '<span class="post-author-handle">@' + escapeHtml(post.author.username) + '</span>' +
    '<span class="post-timestamp">' + timeAgo(post.createdAt) + '</span>' +
    '</div></div>' +
    (isOwn ? '<button class="delete-post-btn" onclick="deleteProfilePost(\'' + post._id + '\', this)" title="Delete" aria-label="Delete post">🗑️</button>' : '') +
    '</div>' +
    '<div class="post-content" id="profile-post-content-' + post._id + '">' + escapeHtml(post.content || '') + '</div>' +
    (post.image?.url ? '<img class="post-image" src="' + escapeHtml(post.image.url) + '" alt="Post image" loading="lazy" onclick="openLightbox(\'' + escapeHtml(post.image.url) + '\')">' : '') +
    '<div class="post-actions">' +
    '<button class="post-action-btn like-btn ' + (post.isLiked ? 'liked' : '') + '" id="profile-like-btn-' + post._id + '" onclick="toggleProfileLike(\'' + post._id + '\', this)" aria-pressed="' + post.isLiked + '">' +
    '<span class="icon">' + (post.isLiked ? '❤️' : '🤍') + '</span><span id="profile-like-count-' + post._id + '">' + post.likeCount + '</span></button>' +
    '<button class="post-action-btn comment-btn" onclick="toggleProfileComments(\'' + post._id + '\', this)" aria-expanded="false" aria-label="Comments">' +
    '<span class="icon">💬</span><span id="profile-comment-count-' + post._id + '">' + post.commentCount + '</span></button>' +
    '</div>' +
    '<div class="comments-section" id="profile-comments-' + post._id + '">' +
    '<div class="comments-inner">' +
    '<div class="comment-input-row">' +
    '<div class="avatar avatar-sm" id="profile-comment-avatar-' + post._id + '"></div>' +
    '<div class="comment-input-wrap">' +
    '<textarea class="comment-input" id="profile-comment-input-' + post._id + '" placeholder="Write a comment..." maxlength="200" rows="2" oninput="updateCharCounter(this,\'profile-comment-counter-' + post._id + '\',200)"></textarea>' +
    '<div class="comment-footer"><span class="char-counter" id="profile-comment-counter-' + post._id + '">200</span>' +
    '<button class="btn btn-primary btn-sm" onclick="submitProfileComment(\'' + post._id + '\')">Reply</button></div>' +
    '</div></div>' +
    '<div class="comments-list" id="profile-comments-list-' + post._id + '"></div>' +
    '</div></div>';
  const slot = card.querySelector('.post-header-avatar-slot');
  if (slot) slot.replaceWith(av);
  setTimeout(() => {
    const ca = card.querySelector('#profile-comment-avatar-' + post._id);
    if (ca) renderAvatar(ca, currentUser);
  }, 0);
  return card;
}

async function toggleProfileLike(postId, btn) {
  btn.disabled = true;
  const lc = document.getElementById('profile-like-count-' + postId);
  const liked = btn.classList.contains('liked');
  btn.classList.toggle('liked', !liked);
  btn.querySelector('.icon').textContent = liked ? '🤍' : '❤️';
  if (lc) lc.textContent = parseInt(lc.textContent) + (liked ? -1 : 1);
  try {
    const res = await apiFetch('/api/posts/' + postId + '/like', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      btn.classList.toggle('liked', liked);
      btn.querySelector('.icon').textContent = liked ? '❤️' : '🤍';
      if (lc) lc.textContent = parseInt(lc.textContent) + (liked ? 1 : -1);
      showToast(data.message || 'Failed.', 'error'); return;
    }
    if (lc) lc.textContent = data.likeCount;
    btn.classList.toggle('liked', data.liked);
    btn.querySelector('.icon').textContent = data.liked ? '❤️' : '🤍';
  } catch { showToast('Network error.', 'error'); }
  finally { btn.disabled = false; }
}

// ── Profile Comments ──────────────────────────────────────────
let openProfileCommentSections = new Set();

async function toggleProfileComments(postId, btn) {
  const section = document.getElementById('profile-comments-' + postId);
  if (!section) return;
  if (section.classList.contains('open')) {
    section.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    openProfileCommentSections.delete(postId);
    return;
  }
  section.classList.add('open');
  btn.setAttribute('aria-expanded', 'true');
  openProfileCommentSections.add(postId);
  await loadProfileComments(postId);
}

async function loadProfileComments(postId) {
  const list = document.getElementById('profile-comments-list-' + postId);
  if (!list) return;
  list.innerHTML = '<div class="spinner" style="margin:12px auto;"></div>';
  try {
    const res = await apiFetch('/api/comments/' + postId);
    const data = await res.json();
    if (!res.ok) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Failed to load.</p>'; return; }
    if (data.comments.length === 0) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">No comments yet. Be the first!</p>'; return; }
    list.innerHTML = '';
    data.comments.forEach(c => list.appendChild(createProfileCommentItem(c, postId)));
  } catch { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Error.</p>'; }
}

function createProfileCommentItem(comment, postId) {
  const isOwn = currentUser && comment.author._id === currentUser._id;
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.dataset.commentId = comment._id;
  const av = document.createElement('div');
  av.className = 'avatar';
  av.style.cssText = 'width:30px;height:30px;font-size:11px;flex-shrink:0;cursor:pointer;';
  av.onclick = () => viewProfile(comment.author.username);
  renderAvatar(av, comment.author);
  item.innerHTML = '<div class="comment-body">' +
    '<div class="comment-author-row">' +
    '<span class="comment-author-name" onclick="viewProfile(\'' + escapeHtml(comment.author.username) + '\')" style="cursor:pointer;">' + escapeHtml(comment.author.name) + '</span>' +
    '<span class="comment-author-handle">@' + escapeHtml(comment.author.username) + '</span>' +
    '<span class="comment-time">' + timeAgo(comment.createdAt) + '</span>' +
    (isOwn ? '<button class="comment-delete-btn" onclick="deleteProfileComment(\'' + comment._id + '\',\'' + postId + '\')" aria-label="Delete">🗑️</button>' : '') +
    '</div><div class="comment-text">' + escapeHtml(comment.content) + '</div></div>';
  item.prepend(av);
  return item;
}

async function submitProfileComment(postId) {
  const input = document.getElementById('profile-comment-input-' + postId);
  const content = input?.value.trim();
  if (!content) { showToast('Write a comment first.', 'error'); return; }
  if (content.length > 200) { showToast('Comment too long.', 'error'); return; }
  try {
    const res = await apiFetch('/api/comments/' + postId, { method: 'POST', body: JSON.stringify({ content }) });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    if (input) input.value = '';
    const counter = document.getElementById('profile-comment-counter-' + postId);
    if (counter) { counter.textContent = '200'; counter.className = 'char-counter'; }
    const cc = document.getElementById('profile-comment-count-' + postId);
    if (cc) cc.textContent = data.commentCount;
    const list = document.getElementById('profile-comments-list-' + postId);
    if (list) { const p = list.querySelector('p'); if (p) p.remove(); list.appendChild(createProfileCommentItem(data.comment, postId)); }
  } catch { showToast('Network error.', 'error'); }
}

async function deleteProfileComment(commentId, postId) {
  if (!confirm('Delete comment?')) return;
  try {
    const res = await apiFetch('/api/comments/' + commentId, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    const item = document.querySelector('[data-comment-id="' + commentId + '"]');
    if (item) { item.style.opacity = '0'; item.style.transition = 'opacity 0.2s'; setTimeout(() => item.remove(), 200); }
    const count = document.getElementById('profile-comment-count-' + postId);
    if (count && data.commentCount !== undefined) count.textContent = data.commentCount;
  } catch { showToast('Network error.', 'error'); }
}

async function deleteProfilePost(postId) {
  if (!confirm('Delete this post?')) return;
  const card = document.querySelector('[data-post-id="' + postId + '"]');
  try {
    const res = await apiFetch('/api/posts/' + postId, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    if (card) { card.style.opacity = '0'; card.style.transform = 'scale(0.95)'; card.style.transition = 'all 0.3s'; setTimeout(() => card.remove(), 300); }
    const pc = document.getElementById('profile-posts-count');
    if (pc) pc.textContent = Math.max(0, parseInt(pc.textContent) - 1);
    showToast('Post deleted.', 'success');
  } catch { showToast('Network error.', 'error'); }
}
