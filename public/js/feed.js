/* ================================================================
   feed.js — Aether v2 Feed Page
================================================================ */

let currentUser = null;
let currentTab = 'feed';
let currentPage = 1;
let hasMore = false;
let isLoading = false;
let openCommentSections = new Set();
let uploadedImageUrl = '';
let uploadedImagePublicId = '';
let notifPollInterval = null;

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
    renderSidebarUser();
    loadFeed();
    loadSuggestions();
    pollNotifications();
  } catch {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
    window.location.href = '/index.html';
  }
})();

function renderSidebarUser() {
  if (!currentUser) return;
  renderAvatar(document.getElementById('sidebar-avatar'), currentUser);
  renderAvatar(document.getElementById('composer-avatar'), currentUser);
  const n = document.getElementById('sidebar-name');
  const h = document.getElementById('sidebar-handle');
  if (n) n.textContent = currentUser.name;
  if (h) h.textContent = '@' + currentUser.username;
  loadUserStats();
}

async function loadUserStats() {
  try {
    const [r1, r2] = await Promise.all([
      apiFetch('/api/users/' + currentUser._id + '/followers'),
      apiFetch('/api/users/' + currentUser._id + '/following'),
    ]);
    const d1 = await r1.json();
    const d2 = await r2.json();
    const el1 = document.getElementById('sidebar-followers');
    const el2 = document.getElementById('sidebar-following');
    if (el1) el1.textContent = d1.followers?.length || 0;
    if (el2) el2.textContent = d2.following?.length || 0;
  } catch {}
}

function setActiveNav(navId) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const el = document.getElementById(navId);
  if (el) el.classList.add('active');
}

function setMobileActiveNav(navId) {
  document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById(navId);
  if (el) el.classList.add('active');
}

function goToMyProfile() {
  if (currentUser) window.location.href = '/profile.html?username=' + currentUser.username;
}

function logout() {
  if (notifPollInterval) clearInterval(notifPollInterval);
  localStorage.removeItem('cs_token');
  localStorage.removeItem('cs_user');
  window.location.href = '/index.html';
}

function viewProfile(username) {
  window.location.href = '/profile.html?username=' + username;
}

// ── Tab Switching ─────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  currentPage = 1;
  hasMore = false;
  openCommentSections.clear();

  ['feed-panel','search-panel','notif-panel','bookmarks-panel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const composer = document.getElementById('composer');
  const headerTitle = document.querySelector('.feed-header-title');
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });

  if (tab === 'feed') {
    document.getElementById('feed-panel').style.display = 'block';
    if (composer) composer.style.display = 'block';
    if (headerTitle) headerTitle.textContent = 'Home';
    document.getElementById('tab-feed')?.classList.add('active');
    document.getElementById('posts-list').innerHTML = '';
    loadFeed();
  } else if (tab === 'search') {
    document.getElementById('search-panel').style.display = 'block';
    if (composer) composer.style.display = 'none';
    if (headerTitle) headerTitle.textContent = 'Search';
    document.getElementById('tab-search')?.classList.add('active');
    setTimeout(() => document.getElementById('search-input')?.focus(), 100);
  } else if (tab === 'notifications') {
    document.getElementById('notif-panel').style.display = 'block';
    if (composer) composer.style.display = 'none';
    if (headerTitle) headerTitle.textContent = 'Notifications';
    loadNotifications();
  } else if (tab === 'bookmarks') {
    document.getElementById('bookmarks-panel').style.display = 'block';
    if (composer) composer.style.display = 'none';
    if (headerTitle) headerTitle.textContent = 'Saved Posts';
    loadBookmarks();
  }
}

// ── Feed ──────────────────────────────────────────────────────
async function loadFeed(page) {
  page = page || 1;
  if (isLoading) return;
  isLoading = true;
  const skeleton = document.getElementById('feed-skeleton');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  if (page === 1 && skeleton) skeleton.style.display = 'block';
  if (loadMoreWrap) loadMoreWrap.style.display = 'none';
  try {
    const res = await apiFetch('/api/posts/feed?page=' + page);
    const data = await res.json();
    if (skeleton) skeleton.style.display = 'none';
    if (!res.ok) { showToast(data.message || 'Failed to load.', 'error'); return; }
    const list = document.getElementById('posts-list');
    if (!list) return;
    if (page === 1) list.innerHTML = '';
    if (data.posts.length === 0 && page === 1) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">🌟</div><h3>Feed is quiet</h3><p>Search for users to follow or explore!</p></div>';
      return;
    }
    data.posts.forEach(p => list.appendChild(createPostCard(p)));
    currentPage = data.currentPage;
    hasMore = data.hasMore;
    if (hasMore && loadMoreWrap) loadMoreWrap.style.display = 'block';
  } catch {
    if (skeleton) skeleton.style.display = 'none';
    showToast('Failed to load posts.', 'error');
  } finally { isLoading = false; }
}

function loadMorePosts() {
  if (!hasMore || isLoading) return;
  loadFeed(currentPage + 1);
}

// ── Search ────────────────────────────────────────────────────
let searchTimeout = null;

function handleSearchInput(e) {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (!q) { document.getElementById('search-results').innerHTML = ''; return; }
  searchTimeout = setTimeout(() => doSearch(q), 350);
}

async function doSearch(q) {
  const results = document.getElementById('search-results');
  results.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner" style="margin:0 auto;"></div></div>';
  try {
    const res = await apiFetch('/api/search?q=' + encodeURIComponent(q) + '&type=users');
    const data = await res.json();
    results.innerHTML = '';
    if (!data.users || data.users.length === 0) {
      results.innerHTML = '<div class="search-empty"><div class="icon">🔍</div><p>No users found for "<strong>' + escapeHtml(q) + '</strong>"</p></div>';
      return;
    }
    data.users.forEach(user => {
      const card = document.createElement('div');
      card.className = 'search-user-card';
      card.onclick = () => { window.location.href = '/profile.html?username=' + user.username; };
      const av = document.createElement('div');
      av.className = 'avatar avatar-sm';
      renderAvatar(av, user);
      card.innerHTML = '<div class="search-user-info">' +
        '<div class="search-user-name">' + escapeHtml(user.name) + '</div>' +
        '<div class="search-user-handle">@' + escapeHtml(user.username) + '</div>' +
        (user.bio ? '<div class="search-user-bio">' + escapeHtml(user.bio) + '</div>' : '') +
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">' + user.followerCount + ' follower' + (user.followerCount !== 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<button class="follow-btn-small ' + (user.isFollowing ? 'following' : '') + '" id="search-follow-' + user._id + '" onclick="event.stopPropagation();searchFollowToggle(\'' + user._id + '\',this)">' +
        (user.isFollowing ? 'Following' : 'Follow') + '</button>';
      card.prepend(av);
      results.appendChild(card);
    });
  } catch {
    results.innerHTML = '<div class="search-empty"><p>Search failed.</p></div>';
  }
}

async function searchFollowToggle(userId, btn) {
  const isFollowing = btn.classList.contains('following');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/users/' + userId + '/follow', { method: isFollowing ? 'DELETE' : 'POST' });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Error', 'error'); return; }
    if (isFollowing) { btn.classList.remove('following'); btn.textContent = 'Follow'; showToast('Unfollowed.', 'info'); }
    else { btn.classList.add('following'); btn.textContent = 'Following'; showToast('Followed! 🎉', 'success'); }
    loadUserStats();
  } catch { showToast('Network error.', 'error'); }
  finally { btn.disabled = false; }
}

// ── Notifications ─────────────────────────────────────────────
async function pollNotifications() {
  await fetchNotifCount();
  notifPollInterval = setInterval(fetchNotifCount, 30000);
}

async function fetchNotifCount() {
  try {
    const res = await apiFetch('/api/notifications');
    const data = await res.json();
    const badge = document.getElementById('notif-badge');
    const mb = document.getElementById('mobile-notif-badge');
    if (badge) { badge.textContent = data.unreadCount || ''; badge.style.display = data.unreadCount > 0 ? 'inline' : 'none'; }
    if (mb) { mb.textContent = data.unreadCount || ''; mb.style.display = data.unreadCount > 0 ? 'inline' : 'none'; }
  } catch {}
}

async function loadNotifications() {
  const list = document.getElementById('notif-list');
  list.innerHTML = '<div style="text-align:center;padding:30px;"><div class="spinner" style="margin:0 auto;"></div></div>';
  try {
    const res = await apiFetch('/api/notifications');
    const data = await res.json();
    apiFetch('/api/notifications/read-all', { method: 'PUT' });
    const badge = document.getElementById('notif-badge');
    const mb = document.getElementById('mobile-notif-badge');
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
    if (mb) { mb.textContent = ''; mb.style.display = 'none'; }
    if (!data.notifications || data.notifications.length === 0) {
      list.innerHTML = '<div class="search-empty"><div class="icon">🔔</div><p>No notifications yet.</p></div>';
      return;
    }
    list.innerHTML = '';
    const icons = { like: '❤️', comment: '💬', follow: '👤' };
    data.notifications.forEach(n => {
      const item = document.createElement('div');
      item.className = 'notif-item ' + (n.read ? '' : 'unread');
      const av = document.createElement('div');
      av.className = 'avatar avatar-sm';
      renderAvatar(av, n.sender);
      const msg = n.type === 'like' ? '<strong>' + escapeHtml(n.sender?.name || 'Someone') + '</strong> liked your post'
        : n.type === 'comment' ? '<strong>' + escapeHtml(n.sender?.name || 'Someone') + '</strong> commented on your post'
        : '<strong>' + escapeHtml(n.sender?.name || 'Someone') + '</strong> started following you';
      item.innerHTML = '<div class="notif-icon">' + (icons[n.type] || '🔔') + '</div>' +
        '<div class="notif-text">' + msg +
        (n.post?.content ? '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:2px;">"' + escapeHtml(n.post.content.substring(0,60)) + (n.post.content.length > 60 ? '…' : '') + '"</div>' : '') +
        '<div class="notif-time">' + timeAgo(n.createdAt) + '</div></div>';
      item.prepend(av);
      if (n.type === 'follow' && n.sender?.username) { item.style.cursor = 'pointer'; item.onclick = () => { window.location.href = '/profile.html?username=' + n.sender.username; }; }
      list.appendChild(item);
    });
  } catch {
    list.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Failed to load notifications.</p>';
  }
}

// ── Bookmarks ─────────────────────────────────────────────────
let bookmarkPage = 1, bookmarkHasMore = false, bookmarkLoading = false;

async function loadBookmarks(page) {
  page = page || 1;
  if (bookmarkLoading) return;
  bookmarkLoading = true;
  const list = document.getElementById('bookmarks-list');
  const lmw = document.getElementById('bookmarks-load-more-wrap');
  if (page === 1) list.innerHTML = '<div style="text-align:center;padding:30px;"><div class="spinner" style="margin:0 auto;"></div></div>';
  if (lmw) lmw.style.display = 'none';
  try {
    const res = await apiFetch('/api/posts/bookmarks?page=' + page);
    const data = await res.json();
    if (page === 1) list.innerHTML = '';
    if (!data.posts || (data.posts.length === 0 && page === 1)) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔖</div><h3>No saved posts</h3><p>Tap the bookmark icon on posts to save them here.</p></div>';
      return;
    }
    data.posts.forEach(p => list.appendChild(createPostCard(p)));
    bookmarkPage = data.currentPage; bookmarkHasMore = data.hasMore;
    if (bookmarkHasMore && lmw) lmw.style.display = 'block';
  } catch {
    list.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Failed to load saved posts.</p>';
  } finally { bookmarkLoading = false; }
}
function loadMoreBookmarks() { if (!bookmarkHasMore || bookmarkLoading) return; loadBookmarks(bookmarkPage + 1); }

// ── Image Upload ──────────────────────────────────────────────
function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Only image files allowed.', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB.', 'error'); return; }
  uploadPostImage(file);
}

async function uploadPostImage(file) {
  const progress = document.getElementById('upload-progress');
  if (progress) progress.classList.add('show');
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await apiFetch('/api/upload/post', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Upload failed.', 'error'); return; }
    uploadedImageUrl = data.url;
    uploadedImagePublicId = data.publicId;
    const preview = document.getElementById('composer-preview');
    if (preview) {
      preview.innerHTML = '<div class="composer-image-preview"><img src="' + escapeHtml(data.url) + '" alt="Preview"><button class="composer-image-remove" onclick="removeComposerImage()" aria-label="Remove image">✕</button></div>';
    }
    showToast('Image ready! 📸', 'success');
  } catch { showToast('Upload failed.', 'error'); }
  finally {
    if (progress) progress.classList.remove('show');
    const input = document.getElementById('post-image-input');
    if (input) input.value = '';
  }
}

function removeComposerImage() {
  uploadedImageUrl = ''; uploadedImagePublicId = '';
  const preview = document.getElementById('composer-preview');
  if (preview) preview.innerHTML = '';
}

// ── Submit Post ───────────────────────────────────────────────
async function submitPost() {
  const input = document.getElementById('post-input');
  const content = input?.value.trim();
  if (!content && !uploadedImageUrl) { showToast('Write something or add an image!', 'error'); return; }
  if (content && content.length > 500) { showToast('Post exceeds 500 characters.', 'error'); return; }
  const btn = document.getElementById('post-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const body = { content };
    if (uploadedImageUrl) { body.imageUrl = uploadedImageUrl; body.imagePublicId = uploadedImagePublicId; }
    const res = await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    if (input) input.value = '';
    const counter = document.getElementById('post-char-counter');
    if (counter) { counter.textContent = '500'; counter.className = 'char-counter'; }
    removeComposerImage();
    const list = document.getElementById('posts-list');
    if (list) {
      const card = createPostCard(data.post);
      list.firstChild ? list.insertBefore(card, list.firstChild) : list.appendChild(card);
    }
    showToast('Post published! 🎉', 'success');
  } catch { showToast('Network error.', 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Post'; } }
}

// ── Post Card ─────────────────────────────────────────────────
function createPostCard(post) {
  const isOwn = currentUser && post.author._id === currentUser._id;
  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.postId = post._id;

  const av = document.createElement('div');
  av.className = 'avatar avatar-sm';
  av.style.cursor = 'pointer';
  av.onclick = () => viewProfile(post.author.username);
  renderAvatar(av, post.author);

  const ownControls = isOwn ? '<div style="display:flex;gap:6px;margin-left:auto;">' +
    '<button class="delete-post-btn" title="Edit" onclick="toggleEditPost(\'' + post._id + '\', this)" aria-label="Edit post">✏️</button>' +
    '<button class="delete-post-btn" title="Delete" onclick="deletePost(\'' + post._id + '\', this)" aria-label="Delete post">🗑️</button>' +
    '</div>' : '';

  card.innerHTML =
    '<div class="post-header">' +
    '<div class="post-header-avatar-slot"></div>' +
    '<div class="post-meta"><div class="post-author-row">' +
    '<span class="post-author-name" onclick="viewProfile(\'' + escapeHtml(post.author.username) + '\')" style="cursor:pointer;">' + escapeHtml(post.author.name) + '</span>' +
    '<span class="post-author-handle">@' + escapeHtml(post.author.username) + '</span>' +
    '<span class="post-timestamp">' + timeAgo(post.createdAt) + '</span>' +
    '</div></div>' + ownControls + '</div>' +

    '<div class="post-content" id="post-content-' + post._id + '">' + escapeHtml(post.content || '') + '</div>' +

    (post.image?.url ? '<img class="post-image" src="' + escapeHtml(post.image.url) + '" alt="Post image" loading="lazy" onclick="openLightbox(\'' + escapeHtml(post.image.url) + '\')">' : '') +

    '<div class="edit-post-form" id="edit-form-' + post._id + '">' +
    '<textarea class="edit-post-textarea" id="edit-textarea-' + post._id + '" maxlength="500">' + escapeHtml(post.content || '') + '</textarea>' +
    '<div class="edit-post-footer">' +
    '<button class="btn btn-ghost btn-sm" onclick="cancelEditPost(\'' + post._id + '\')">Cancel</button>' +
    '<button class="btn btn-primary btn-sm" onclick="saveEditPost(\'' + post._id + '\')">Save</button>' +
    '</div></div>' +

    '<div class="post-actions">' +
    '<button class="post-action-btn like-btn ' + (post.isLiked ? 'liked' : '') + '" id="like-btn-' + post._id + '" onclick="toggleLike(\'' + post._id + '\', this)" aria-label="Like" aria-pressed="' + post.isLiked + '">' +
    '<span class="icon">' + (post.isLiked ? '❤️' : '🤍') + '</span><span id="like-count-' + post._id + '">' + post.likeCount + '</span></button>' +
    '<button class="post-action-btn comment-btn" onclick="toggleComments(\'' + post._id + '\', this)" aria-expanded="false" aria-label="Comments">' +
    '<span class="icon">💬</span><span id="comment-count-' + post._id + '">' + post.commentCount + '</span></button>' +
    '<button class="post-action-btn bookmark-btn ' + (post.isBookmarked ? 'bookmarked' : '') + '" id="bookmark-btn-' + post._id + '" onclick="toggleBookmark(\'' + post._id + '\', this)" aria-label="Bookmark">' +
    '<span class="icon">' + (post.isBookmarked ? '🔖' : '🏷️') + '</span></button>' +
    '</div>' +

    '<div class="comments-section" id="comments-' + post._id + '">' +
    '<div class="comments-inner">' +
    '<div class="comment-input-row">' +
    '<div class="avatar avatar-sm" id="comment-avatar-' + post._id + '"></div>' +
    '<div class="comment-input-wrap">' +
    '<div class="composer-toolbar"><div class="emoji-picker-wrap">' +
    '<button class="toolbar-btn" id="comment-emoji-btn-' + post._id + '" onclick="createEmojiPicker(\'comment-input-' + post._id + '\',\'comment-emoji-btn-' + post._id + '\')" title="Emoji">😊</button>' +
    '</div></div>' +
    '<textarea class="comment-input" id="comment-input-' + post._id + '" placeholder="Write a comment..." maxlength="200" rows="2" oninput="updateCharCounter(this,\'comment-counter-' + post._id + '\',200)"></textarea>' +
    '<div class="comment-footer"><span class="char-counter" id="comment-counter-' + post._id + '">200</span>' +
    '<button class="btn btn-primary btn-sm" onclick="submitComment(\'' + post._id + '\')">Reply</button></div>' +
    '</div></div>' +
    '<div class="comments-list" id="comments-list-' + post._id + '"><div class="spinner" style="margin:12px auto;"></div></div>' +
    '</div></div>';

  const slot = card.querySelector('.post-header-avatar-slot');
  if (slot) slot.replaceWith(av);

  setTimeout(() => {
    const ca = card.querySelector('#comment-avatar-' + post._id);
    if (ca) renderAvatar(ca, currentUser);
  }, 0);

  return card;
}

// ── Edit Post ─────────────────────────────────────────────────
function toggleEditPost(postId) {
  const form = document.getElementById('edit-form-' + postId);
  if (!form) return;
  form.classList.toggle('open');
  if (form.classList.contains('open')) document.getElementById('edit-textarea-' + postId)?.focus();
}
function cancelEditPost(postId) {
  const form = document.getElementById('edit-form-' + postId);
  if (form) form.classList.remove('open');
  const orig = document.getElementById('post-content-' + postId)?.textContent || '';
  const ta = document.getElementById('edit-textarea-' + postId);
  if (ta) ta.value = orig;
}
async function saveEditPost(postId) {
  const ta = document.getElementById('edit-textarea-' + postId);
  const content = ta?.value.trim();
  if (!content) { showToast('Post cannot be empty.', 'error'); return; }
  if (content.length > 500) { showToast('Post exceeds 500 chars.', 'error'); return; }
  try {
    const res = await apiFetch('/api/posts/' + postId, { method: 'PUT', body: JSON.stringify({ content }) });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    const contentEl = document.getElementById('post-content-' + postId);
    if (contentEl) contentEl.textContent = content;
    cancelEditPost(postId);
    showToast('Post updated! ✨', 'success');
  } catch { showToast('Network error.', 'error'); }
}

// ── Like ──────────────────────────────────────────────────────
async function toggleLike(postId, btn) {
  btn.disabled = true;
  const lc = document.getElementById('like-count-' + postId);
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

// ── Bookmark ──────────────────────────────────────────────────
async function toggleBookmark(postId, btn) {
  btn.disabled = true;
  const bk = btn.classList.contains('bookmarked');
  btn.classList.toggle('bookmarked', !bk);
  btn.querySelector('.icon').textContent = bk ? '🏷️' : '🔖';
  try {
    const res = await apiFetch('/api/posts/' + postId + '/bookmark', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      btn.classList.toggle('bookmarked', bk);
      btn.querySelector('.icon').textContent = bk ? '🔖' : '🏷️';
      showToast(data.message || 'Failed.', 'error'); return;
    }
    showToast(data.bookmarked ? 'Post saved! 🔖' : 'Post removed from Saved Posts.', 'info');
  } catch { showToast('Network error.', 'error'); }
  finally { btn.disabled = false; }
}

// ── Delete Post ───────────────────────────────────────────────
async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  const card = document.querySelector('[data-post-id="' + postId + '"]');
  try {
    const res = await apiFetch('/api/posts/' + postId, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    if (card) { card.style.opacity = '0'; card.style.transform = 'scale(0.95)'; card.style.transition = 'all 0.3s'; setTimeout(() => card.remove(), 300); }
    showToast('Post deleted.', 'success');
  } catch { showToast('Network error.', 'error'); }
}

// ── Comments ──────────────────────────────────────────────────
async function toggleComments(postId, btn) {
  const section = document.getElementById('comments-' + postId);
  if (!section) return;
  if (section.classList.contains('open')) { section.classList.remove('open'); btn.setAttribute('aria-expanded','false'); openCommentSections.delete(postId); return; }
  section.classList.add('open'); btn.setAttribute('aria-expanded','true'); openCommentSections.add(postId);
  await loadComments(postId);
}

async function loadComments(postId) {
  const list = document.getElementById('comments-list-' + postId);
  if (!list) return;
  list.innerHTML = '<div class="spinner" style="margin:12px auto;"></div>';
  try {
    const res = await apiFetch('/api/comments/' + postId);
    const data = await res.json();
    if (!res.ok) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Failed to load.</p>'; return; }
    if (data.comments.length === 0) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">No comments yet. Be the first!</p>'; return; }
    list.innerHTML = '';
    data.comments.forEach(c => list.appendChild(createCommentItem(c, postId)));
  } catch { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Error.</p>'; }
}

function createCommentItem(comment, postId) {
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
    (isOwn ? '<button class="comment-delete-btn" onclick="deleteComment(\'' + comment._id + '\',\'' + postId + '\',this)" aria-label="Delete">🗑️</button>' : '') +
    '</div><div class="comment-text">' + escapeHtml(comment.content) + '</div></div>';
  item.prepend(av);
  return item;
}

async function submitComment(postId) {
  const input = document.getElementById('comment-input-' + postId);
  const content = input?.value.trim();
  if (!content) { showToast('Write a comment first.', 'error'); return; }
  if (content.length > 200) { showToast('Comment too long.', 'error'); return; }
  try {
    const res = await apiFetch('/api/comments/' + postId, { method: 'POST', body: JSON.stringify({ content }) });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    if (input) input.value = '';
    const counter = document.getElementById('comment-counter-' + postId);
    if (counter) { counter.textContent = '200'; counter.className = 'char-counter'; }
    const cc = document.getElementById('comment-count-' + postId);
    if (cc) cc.textContent = data.commentCount;
    const list = document.getElementById('comments-list-' + postId);
    if (list) { const p = list.querySelector('p'); if (p) p.remove(); list.appendChild(createCommentItem(data.comment, postId)); }
  } catch { showToast('Network error.', 'error'); }
}

async function deleteComment(commentId, postId) {
  if (!confirm('Delete comment?')) return;
  try {
    const res = await apiFetch('/api/comments/' + commentId, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed.', 'error'); return; }
    const item = document.querySelector('[data-comment-id="' + commentId + '"]');
    if (item) { item.style.opacity = '0'; item.style.transition = 'opacity 0.2s'; setTimeout(() => item.remove(), 200); }
    const count = document.getElementById('comment-count-' + postId);
    if (count && data.commentCount !== undefined) count.textContent = data.commentCount;
  } catch { showToast('Network error.', 'error'); }
}

// ── Suggestions ───────────────────────────────────────────────
async function loadSuggestions() {
  const list = document.getElementById('suggestions-list');
  if (!list) return;
  try {
    const res = await apiFetch('/api/users/suggestions');
    const data = await res.json();
    if (!res.ok || !data.suggestions?.length) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No suggestions.</p>'; return; }
    list.innerHTML = '';
    data.suggestions.forEach(user => {
      const item = document.createElement('div');
      item.className = 'suggested-user-item';
      const av = document.createElement('div');
      av.className = 'avatar avatar-sm';
      av.style.cursor = 'pointer';
      av.onclick = () => viewProfile(user.username);
      renderAvatar(av, user);
      item.innerHTML = '<div class="suggested-user-info">' +
        '<div class="suggested-user-name" onclick="viewProfile(\'' + escapeHtml(user.username) + '\')" style="cursor:pointer;">' + escapeHtml(user.name) + '</div>' +
        '<div class="suggested-user-handle">@' + escapeHtml(user.username) + '</div></div>' +
        '<button class="follow-btn-small" id="suggest-follow-' + user._id + '" onclick="followSuggested(\'' + user._id + '\', this)">Follow</button>';
      item.prepend(av);
      list.appendChild(item);
    });
  } catch { if (list) list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Failed.</p>'; }
}

async function followSuggested(userId, btn) {
  const following = btn.classList.contains('following');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/users/' + userId + '/follow', { method: following ? 'DELETE' : 'POST' });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Error', 'error'); return; }
    if (following) { btn.classList.remove('following'); btn.textContent = 'Follow'; showToast('Unfollowed.', 'info'); }
    else { btn.classList.add('following'); btn.textContent = 'Following'; showToast('Followed! 🎉', 'success'); if (currentTab === 'feed') { currentPage = 1; document.getElementById('posts-list').innerHTML = ''; loadFeed(); } }
    loadUserStats();
  } catch { showToast('Network error.', 'error'); }
  finally { btn.disabled = false; }
}
