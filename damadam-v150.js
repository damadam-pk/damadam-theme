/* Damadam v150 — v149 + Stars speed + For Me Clear/Badge fix
   + DOB removed + all Pakistan cities + 1on1 last seen (2026-11-07).
   Stars: flagged fetch deduped, 15-min caches, cards reuse ranking
   counts, stale-while-revalidate, Weekly reads parallelized.
   For Me: Clear really dismisses (card ids), badge counts once.
   1on1: per-chat lastSeen write + header line + Seen tick.
   Generated file: do not hand-edit; the theme is Damadam-v150-Slim.xml. */

/* ===== v147 block (orig theme lines 1239-2437) ===== */

/* ===== CRITICAL FIX: DOMContentLoaded wrapper for Firebase ===== */
document.addEventListener('DOMContentLoaded', function() {
  initFirebase();
});

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase not loaded yet, retrying...');
    setTimeout(initFirebase, 500);
    return;
  }
  
  try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  } catch(e) {
    console.error('Firebase init failed:', e);
  }
}

/* ===== FIREBASE CONFIG ===== */
const firebaseConfig = (function() {
  const _0x4b8f = ['AIzaSyDV-NG1qG54INP-Lt7uiQjhoEsOvjrcqIc', 'damadam-4916b.firebaseapp.com', 'https://damadam-4916b-default-rtdb.firebaseio.com', 'damadam-4916b', 'damadam-4916b.firebasestorage.app', '1048087436900', '1:1048087436900:web:5453c0fe7672463ea4c971'];
  return {
    apiKey: _0x4b8f[0],
    authDomain: _0x4b8f[1],
    databaseURL: _0x4b8f[2],
    projectId: _0x4b8f[3],
    storageBucket: _0x4b8f[4],
    messagingSenderId: _0x4b8f[5],
    appId: _0x4b8f[6]
  };
})();

let auth, db;
let firebaseReady = false;
/* (v55) Simple profile cache - 5 min TTL to speed up repeat loads */
var _profileCache = {};
function getCachedProfile(uid) {
  var c = _profileCache[uid];
  if (c && (Date.now() - c.t) < 300000) return c.d;
  return null;
}
function setCachedProfile(uid, data) {
  _profileCache[uid] = { d: data, t: Date.now() };
}
/* (v53) Silent error logging - console only, no visible UI */
window.addEventListener('error', function(e) {
  var msg = 'JS Error: ' + (e.message || 'unknown') + ' at ' + (e.filename || '').split('/').pop() + ':' + (e.lineno || '?');
  try { console.error(msg); } catch(_e) {}
});
console.log('Damadam theme version: ' + DDP_VERSION);

function getFirebase() {
  if (!firebaseReady && typeof firebase !== 'undefined') {
    auth = firebase.auth();
    db = firebase.database();
    firebaseReady = true;
  }
  return { auth, db };
}

/* ===== IMAGE UPLOAD (imgbb) ===== */
/* v37 2026-10-16: PERMANENT image hosting — imgbb hata kar Cloudinary (free, no card).
   Live-tested 2026-10-16: unsigned upload OK. Purani imgbb URLs kaam karti rahengi; nayi uploads Cloudinary par. */
/* v36 2026-10-16 StabilityFixes (v34 base):
   1. Stars flap-guard: khaali/mashkook recalc par stars revoke nahi honge (daily-reset flap fix) + star cache 2min->5min
   2. Mehfil reply: replyTo ab save hota hai (quote dikhega + mentioned), quote par click = original message par jump + highlight (1on1 me bhi)
   3. Speed: star recalc kam, listener cleanup pehle se OK
   4. Images: compress 960px/q0.65, chhoti file (<=350KB) seedhi upload, timeout 90s->60s, rate-limit par seedha message
   5. Maintenance: imgbb quota honesty + tez failure surfacing (30+ DAU) */

// Android app download link. Paste the direct APK download URL here
// (e.g. a Google Drive direct link: https://drive.google.com/uc?export=download&id=FILE_ID).
// Direct link to the Damadam.Pk APK file (e.g. a Google Drive direct-download link).
// Leave empty ("") to hide the "GET APP" tile in the MORE menu and the
// "Download App" link on the login screen. This same link powers the download
// button on the "Download App" install-guide page (Blogger page titled "Download App").
const APP_DOWNLOAD_URL = "https://drive.google.com/uc?export=download&id=1aAvwqZ1Z6zfII0FqTFkLZolm05TZSt5M";
const CLOUDINARY_CLOUD_NAME = "ldtfcva5";
const CLOUDINARY_UPLOAD_PRESET = "damadam_upload";
async function uploadImageToCloudinary(file, skipLimit) {
  /* (v37) Photo upload limit: 1 photo per 5 min per user (anti-spam, 30+ DAU) */
  /* (v111) skipLimit=true par limit nahi — 1on1 ke liye */
  if (!skipLimit) {
  try {
    const _fb0 = getFirebase(); const _db0 = _fb0 && _fb0.db;
    if (_db0 && typeof currentUserId !== 'undefined' && currentUserId) {
      const _ls = await _db0.ref('users/' + currentUserId + '/lastPhotoAt').once('value');
      const _last = _ls.val() || 0;
      const _gap = 5 * 60 * 1000;
      if (Date.now() - _last < _gap) {
        const _waitMin = Math.max(1, Math.ceil((_gap - (Date.now() - _last)) / 60000));
        throw new Error('LIMIT_HIT:' + _waitMin);
      }
    }
  } catch(_le) {
    if (_le && _le.message && _le.message.indexOf('LIMIT_HIT:') === 0) {
      throw new Error('1 photo har 5 minute me upload ho sakti hai — ' + _le.message.split(':')[1] + ' minute baad dobara try karein.');
    }
    /* read fail ho to block mat karo (fail-open) */
  }
  } /* (v111) end skipLimit guard */
  // Step 1: compress locally. If the photo can't be read (e.g. HEIC from iPhone),
  // fail fast with a clear message — retrying won't help.
  let compressedFile;
  try {
    compressedFile = await compressImage(file);
  } catch (e) {
    throw new Error('Could not read this photo. Please choose a JPEG or PNG image.');
  }
  if (!compressedFile) {
    throw new Error('Could not read this photo. Please choose a JPEG or PNG image.');
  }

  const fd = new FormData();
  fd.append('file', compressedFile);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  // Step 2: upload with retries. Slow mobile connections get 60s per attempt
  // and 3 attempts with backoff before giving up.
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload', {
        method: 'POST',
        body: fd,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      let data = null;
      try { data = await res.json(); } catch (je) { data = null; }
      if (data && data.secure_url) {
        if (!skipLimit) {
        try {
          const _fb1 = getFirebase(); const _db1 = _fb1 && _fb1.db;
          if (_db1 && typeof currentUserId !== 'undefined' && currentUserId) {
            await _db1.ref('users/' + currentUserId + '/lastPhotoAt').set(firebase.database.ServerValue.TIMESTAMP);
          }
        } catch(_se) {}
        }
        return data.secure_url;
      }
      // Server answered but rejected it — retrying won't help.
      let _rejMsg = 'Image server busy hai. Kuch dair baad dobara try karein.';
      try {
        if (data && data.error && data.error.message && /preset/i.test(String(data.error.message))) {
          _rejMsg = 'Upload setting me masla hai. Admin se rabta karein.';
        }
      } catch(_rle) {}
      lastErr = new Error(_rejMsg);
      break;
    } catch (e) {
      clearTimeout(timeoutId);
      lastErr = e;
      if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  if (lastErr && lastErr.name === 'AbortError') {
    throw new Error('Upload timed out — connection too slow. Try again on WiFi or a faster network.');
  }
  throw lastErr || new Error('Upload failed. Please try again.');
}

async function compressImage(file) {
  /* (v36) Chhoti file (<=350KB, JPEG/PNG/WebP) pehle se hi halki hai — canvas ka waqt zaya mat karo, seedhi upload karo */
  try {
    const _ct = (file && file.type) || '';
    if (file && file.size && file.size <= 350 * 1024 && (_ct === 'image/jpeg' || _ct === 'image/png' || _ct === 'image/webp')) {
      return file;
    }
  } catch(e) {}
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      /* (v36) 1200px -> 960px, quality 0.7 -> 0.65: kam size, tez upload, tez loading */
      const MAX_WIDTH = 960;
      const MAX_HEIGHT = 960;
      
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = (width * MAX_HEIGHT) / height;
          height = MAX_HEIGHT;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(function(blob) {
        resolve(blob);
      }, 'image/jpeg', 0.65);
    };
    
    img.onerror = reject;
    reader.onload = function(e) {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ===== CATEGORIES ===== */
const categories = ["Poetry","Romantic","Sad","Funny","Motivational","Islamic","Friendship","Love","Breakup","Birthday","Random"];
const categoryConfig = {
  'Poetry':{icon:'📝',gradient:'linear-gradient(135deg,#6366f1,#8b5cf6)'},
  'Romantic':{icon:'💕',gradient:'linear-gradient(135deg,#ec4899,#f43f5e)'},
  'Sad':{icon:'🥀',gradient:'linear-gradient(135deg,#6b7280,#374151)'},
  'Funny':{icon:'😂',gradient:'linear-gradient(135deg,#fbbf24,#f59e0b)'},
  'Motivational':{icon:'💪',gradient:'linear-gradient(135deg,#14b8a6,#0d9488)'},
  'Islamic':{icon:'🕌',gradient:'linear-gradient(135deg,#10b981,#047857)'},
  'Friendship':{icon:'🤝',gradient:'linear-gradient(135deg,#3b82f6,#2563eb)'},
  'Love':{icon:'💖',gradient:'linear-gradient(135deg,#f43f5e,#e11d48)'},
  'Breakup':{icon:'💔',gradient:'linear-gradient(135deg,#94a3b8,#64748b)'},
  'Birthday':{icon:'🎂',gradient:'linear-gradient(135deg,#ec4899,#be185d)'},
  'Random':{icon:'🎲',gradient:'linear-gradient(135deg,#64748b,#475569)'},
  /* mehfil topics (create-mehfil pills) */
  'Video Games':{icon:'🎮',gradient:'linear-gradient(135deg,#8b5cf6,#6d28d9)'},
  'Shughal & Fun':{icon:'😜',gradient:'linear-gradient(135deg,#fbbf24,#f59e0b)'},
  'Relationships':{icon:'💕',gradient:'linear-gradient(135deg,#ec4899,#f43f5e)'},
  'Poetry & Literature':{icon:'📖',gradient:'linear-gradient(135deg,#6366f1,#8b5cf6)'},
  'Religion':{icon:'🕌',gradient:'linear-gradient(135deg,#10b981,#047857)'},
  'Exam Prep':{icon:'📚',gradient:'linear-gradient(135deg,#3b82f6,#2563eb)'},
  'Mixed interests':{icon:'🧊',gradient:'linear-gradient(135deg,#06b6d4,#0891b2)'}
};

/* ===== USER CACHE ===== */
const UserCache = {
  cache: new Map(),
  maxAge: 300000,
  
  async get(uid) {
    if (!uid) return null;
    const cached = this.cache.get(uid);
    if (cached && Date.now() - cached.time < this.maxAge) {
      return cached.data;
    }
    try {
      const { db } = getFirebase();
      if (!db) return null;
      const snap = await db.ref('users/' + uid).once('value');
      const data = snap.val();
      this.cache.set(uid, { data: data, time: Date.now() });
      return data;
    } catch(e) {
      console.error('UserCache error:', e);
      return null;
    }
  },
  
  set(uid, data) {
    this.cache.set(uid, { data: data, time: Date.now() });
  },
  
  clear() { this.cache.clear(); }
};

async function batchGetUsers(uids) {
  const uniqueUids = [...new Set(uids.filter(Boolean))];
  const results = {};
  const chunks = [];
  for (let i = 0; i < uniqueUids.length; i += 10) {
    chunks.push(uniqueUids.slice(i, i + 10));
  }
  
  /* Perf: fetch all chunks in parallel instead of awaiting one chunk at a time. */
  const chunkResults = await Promise.all(chunks.map(async function(chunk) {
    const users = await Promise.all(chunk.map(uid => UserCache.get(uid)));
    return { chunk: chunk, users: users };
  }));
  chunkResults.forEach(function(cr) {
    cr.chunk.forEach((uid, idx) => { results[uid] = cr.users[idx]; });
  });
  return results;
}

/* ===== POST CACHE ===== */
const postCacheStore = {};
const postCacheTime = {};

function getCachedFeed(key, maxAge) {
  /* Perf: 60s default (was 10s) — tab switches reuse the rendered feed instead of
     re-downloading on every switch. The cache is explicitly cleared on post
     create/delete via clearPostCache(), so fresh content still appears. */
  if (postCacheStore[key] && postCacheTime[key] && Date.now() - postCacheTime[key] < (maxAge || 60000)) {
    return postCacheStore[key];
  }
  return null;
}

function setCachedFeed(key, html) {
  postCacheStore[key] = html;
  postCacheTime[key] = Date.now();
}

function clearPostCache() {
  Object.keys(postCacheStore).forEach(function(k) { delete postCacheStore[k]; });
  Object.keys(postCacheTime).forEach(function(k) { delete postCacheTime[k]; });
}

/* ===== HTML ESCAPE ===== */
function esc(s) {
  if (!s) return '';
  let str = String(s);
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  str = str.replace(/javascript:/gi, '');
  str = str.replace(/onclick=/gi, 'data-onclick=');
  str = str.replace(/onerror=/gi, 'data-onerror=');
  str = str.replace(/onload=/gi, 'data-onload=');
  str = str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
  return str;
}

function escAttr(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
}

/* ===== SAFE: value placed in a JS single-quoted string inside a double-quoted HTML
   attribute (e.g. onclick="fn('...')"). Escapes for JS first, then for the HTML attribute. ===== */
function escAttrJS(s) {
  if (!s) return '';
  let str = String(s);
  str = str.replace(/\\/g, '\\\\')
           .replace(/'/g, "\\'")
           .replace(/"/g, '\\"')
           .replace(/\n/g, '\\n')
           .replace(/\r/g, '\\r')
           .replace(/\u2028/g, '\\u2028')
           .replace(/\u2029/g, '\\u2029');
  str = str.replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;');
  return str;
}

/* ===== SAFE nickname handling (H1/H2): restrict nicknames to a safe charset at rest,
   so quote/backslash payloads can never reach a sink even if an escaper is missed. ===== */
function sanitizeNickname(nick) {
  /* Pure normalizer: lowercase, strip disallowed chars, cap length.
     Never invents a nickname — callers validate raw input first. */
  return String(nick || '').toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '').slice(0, 24);
}

/* ===== Atomically claim usernames/<nick> -> uid. Never overwrites another user's mapping.
   Returns the claimed nickname (random suffix appended if the base was taken). ===== */
async function claimUsername(db, baseNick, uid) {
  let nick = baseNick;
  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt === 7) {
      nick = baseNick + '_' + String(uid).slice(-6); /* deterministic last resort: uid-derived, unique */
    } else if (attempt > 0) {
      nick = baseNick + '_' + Math.random().toString(36).slice(2, 6);
    }
    /* NOTE: the transaction callback may run multiple times on contention — never decide
       from a flag set inside it. Decide from the committed result below. */
    const res = await db.ref('usernames/' + nick).transaction(function(cur) {
      if (cur === null) return uid;  /* free: claim it */
      if (cur === uid) return;       /* already ours: abort is fine, snapshot check below confirms */
      return;                        /* taken by someone else: abort, never overwrite */
    });
    const val = res && res.snapshot ? res.snapshot.val() : null;
    if ((res && res.committed) || val === uid) return nick;
  }
  throw new Error('Nickname claim failed. Please check connection and try again.');
}

/* ===== H5: validate + neutralize URLs before interpolation into HTML/handlers.
   Only http(s) and data:image URLs pass; quotes/backslashes/brackets are stripped
   so the result is safe in both "..." attributes and '...' JS strings. ===== */
function safeUrl(u) {
  let s = String(u || '').trim();
  if (!/^(https?:\/\/|data:image\/(png|jpe?g|gif|webp);)/i.test(s)) return ''; /* (2026-10-12) AUDIT 4.5: svg hata diya */
  return s.replace(/["'`<>\n\r\\]/g, '');
}

/* (v143) Cloudinary thumb: list/feed me chhoti image, kholne par full original.
   Cloudinary URL par w_<width>,c_limit lagata hai (kabhi upscale nahi); already-transformed / non-Cloudinary /
   empty URLs ko jaisa hai waisa chhorta hai. */
function ddpThumbUrl(url, w) {
  try {
    if (!url || typeof url !== 'string') return url;
    var m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/)(.+)$/);
    if (!m) return url;
    if (/^(w_\d+(,[^\/]*)?\/|c_[a-z0-9_]+\/|f_[a-z0-9]+\/|q_[a-z0-9_]+\/)/.test(m[2])) return url;
    return m[1] + 'w_' + w + ',c_limit/' + m[2];
  } catch(e) { return url; }
}

/* ===== M4: atomic comment counter increment (was: read-modify-write, lost increments under concurrency) ===== */
async function incCommentCount(db, postId) {
  try {
    await db.ref('posts/' + postId + '/comment_count').transaction(function(cur) {
      return (cur || 0) + 1;
    });
  } catch (e) { console.error('incCommentCount failed:', e); }
}

/* ===== TIME UTILITIES ===== */
function timeAgo(date) {
  if (!date) return '';
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return mins + ' mins ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

function timeSince(date) {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 30) return days + ' days ago';
  return Math.floor(days / 30) + ' months ago';
}

function isExpired(post) {
  if (!post.expiryTime) return false;
  return Date.now() > post.expiryTime;
}

/* ===== GLOBAL VARS ===== */
let currentView = 'home', currentTab = 'text', currentLang = 'en';
let currentUser = null, currentUserId = null;
let followedUsers = [], currentInboxTab = 'activity';
let currentMehfilId = null, mehfilListener = null;
let _profileUid = null, _profilePostsLoaded = false;
let heartbeatInterval = null;
let userDpCache = {}, userDpCacheTime = {};
let currentChatId = null, chatListener = null, chatInviteListener = null;

let currentTargetUid = "";

/* ===== BLOGGER CACHE CLEANUP ===== */
function startBloggerCacheCleanup() {
  setInterval(() => {
    const now = Date.now();
    const MAX_AGE = 600000;
    /* (2026-10-12) AUDIT 3.6 + 2.1: ye caches pehle saaf nahi hote thay — lambi session me memory leak. */
    try {
      if (typeof _notifSeenIds !== 'undefined' && Object.keys(_notifSeenIds).length > 500) _notifSeenIds = {};
      if (typeof window._chatCache !== 'undefined' && Object.keys(window._chatCache).length > 50) { window._chatCache = {}; window._chatCacheTime = {}; }
      if (typeof _ddpMentionMembers !== 'undefined' && Object.keys(_ddpMentionMembers).length > 30) _ddpMentionMembers = {};
      if (typeof _starCache !== 'undefined') _starCache.time = 0;
    } catch(e) {}
    /* (2026-10-12) AUDIT 3.3: postCacheStore me zyada se zyada 5 entries. */
    try {
      if (typeof postCacheStore !== 'undefined' && typeof postCacheTime !== 'undefined' && Object.keys(postCacheStore).length > 5) {
        const oldest = Object.keys(postCacheTime).sort(function(a,b){ return (postCacheTime[a]||0) - (postCacheTime[b]||0); })[0];
        if (oldest) { delete postCacheStore[oldest]; delete postCacheTime[oldest]; }
      }
    } catch(e) {}
    
    if (typeof postCacheTime !== 'undefined') {
      Object.keys(postCacheTime).forEach(key => {
        if (now - postCacheTime[key] > MAX_AGE) {
          delete postCacheStore[key];
          delete postCacheTime[key];
        }
      });
    }
    
    if (typeof userDpCacheTime !== 'undefined') {
      Object.keys(userDpCacheTime).forEach(key => {
        if (now - userDpCacheTime[key] > MAX_AGE) {
          delete userDpCache[key];
          delete userDpCacheTime[key];
        }
      });
    }
    
    const allKeys = Object.keys(localStorage);
    const rlKeys = allKeys.filter(k => k.startsWith('rl_') || k.startsWith('likes_'));
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    rlKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (key.match(/\d{4}-\d{2}-\d{2}/)) {
        const keyDate = new Date(key.split('_').pop());
        if (keyDate && keyDate.getTime() < sevenDaysAgo) {
          localStorage.removeItem(key);
        }
      }
    });
    
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      totalSize += (key.length + (value ? value.length : 0)) * 2;
    }
    if (totalSize > 1800000) {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        items.push({ key, time: parseInt(localStorage.getItem(key + '_time') || 0) });
      }
      items.sort((a, b) => a.time - b.time);
      const toDelete = items.slice(0, Math.floor(items.length / 2));
      toDelete.forEach(item => {
        localStorage.removeItem(item.key);
        localStorage.removeItem(item.key + '_time');
      });
    }
  }, 600000);
}

/* ===== RATE LIMITER ===== */
const RateLimiter = {
  getKey(action) {
    const today = new Date().toDateString();
    return 'rl_' + (currentUserId || 'anon') + '_' + action + '_' + today;
  },
  
  canPerform(action, limit) {
    const key = this.getKey(action);
    const count = parseInt(localStorage.getItem(key) || '0');
    if (count >= (limit || 20)) {
      alert('Apne aaj ke ' + action + ' limit complete kar li!');
      return false;
    }
    localStorage.setItem(key, count + 1);
    return true;
  }
};

/* ===== CACHE MANAGER ===== */
const CacheManager = {
  store: {},
  maxAge: 300000,
  
  set(key, data) {
    this.store[key] = { data: data, timestamp: Date.now() };
  },
  
  get(key) {
    const cached = this.store[key];
    if (cached && (Date.now() - cached.timestamp) < this.maxAge) {
      return cached.data;
    }
    delete this.store[key];
    return null;
  },
  
  clear() { this.store = {}; }
};

/* ===== GET USER DP WITH CACHE ===== */
async function getUserDp(uid) {
  if (!uid) return '';
  if (userDpCache[uid] && Date.now() - userDpCacheTime[uid] < 300000) return userDpCache[uid];
  try {
    const { db } = getFirebase();
    if (!db) return '';
    const snap = await db.ref('users/' + uid + '/profilePic').once('value');
    userDpCache[uid] = snap.val() || '';
    userDpCacheTime[uid] = Date.now();
    return userDpCache[uid];
  } catch(e) { return ''; }
}

/* ===== SAFE USER GETTER ===== */
function safeUser() {
  return currentUser || { username: 'User', uid: null, profilePic: '', bio: '' };
}

/* ===== INBOX BADGE UPDATE ===== */
/* (v24) text me @mentioned users ko notify karo — shared helper */
async function ddpNotifyMentionedUsers(db, text, extra) {
  if (!db || !text || !currentUserId) return;
  try {
    const _re = /@(\w+)/g;
    let _m; const _names = {};
    while ((_m = _re.exec(text)) !== null) { _names[_m[1]] = true; }
    const _me = (typeof safeUser === 'function') ? safeUser().username : '';
    const _skip = (extra && extra.skipUid) || {};
    for (const _nm in _names) {
      if (!_names.hasOwnProperty(_nm) || _nm === _me) continue;
      try {
        const _us = await db.ref('usernames/' + _nm).once('value');
        const _tuid = _us.val();
        if (!_tuid || typeof _tuid !== 'string' || _tuid === currentUserId || _skip[_tuid]) continue;
        let blocked = false;
        try { blocked = await isBlockedBetween(currentUserId, _tuid); } catch(e) {}
        if (blocked) continue;
        await db.ref('notifications').push({
          toUid: _tuid, fromUid: currentUserId,
          sender_name: _me, type: (extra && extra.type) || 'reply',
          message: _me + ' mentioned you' + ((extra && extra.context) || ''),
          postId: (extra && extra.postId) || '',
          mehfilId: (extra && extra.mehfilId) || '',
          postPreview: (extra && extra.postPreview) || '',
          replyPreview: String(text).substring(0, 100),
          timestamp: Date.now(), read: false
        });
        _skip[_tuid] = true;
      } catch(e) {}
    }
    if (typeof updateInboxBadge === 'function') updateInboxBadge();
  } catch(e) {}
}

const updateInboxBadge = (function() {
  let pending = false;
  let lastCount = -1;
  let timer = null;
  
  function _doUpdate() {
    if (!currentUserId) return;
    try {
      const { db } = getFirebase();
      if (!db) return;
      db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).limitToLast(20).once('value').then(function(snap) {
        let count = 0;
        snap.forEach(function(doc) {
          const n = doc.val();
          if (n.type !== 'mehfil_invite' && !n.read && !n.autoDismissed) count++;
        });
        if (count === lastCount) return;
        lastCount = count;
        const badge = document.getElementById('inboxBadge');
        if (badge) {
          badge.textContent = count > 0 ? '+' + count : '0';
          badge.classList.toggle('hidden', count === 0);
        }
      }).catch(function(){});
    } catch(e) {}
  }
  
  return function() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(_doUpdate, 300);
  };
})();

/* ===== CATEGORY POPULATE ===== */
function populateCategorySelects() {
  let opts = '';
  categories.forEach(function(c) {
    const cfg = categoryConfig[c] || { icon: '📌' };
    opts += '<option value="' + c + '">' + cfg.icon + ' ' + c + '</option>';
  });
  const textCat = document.getElementById('textTopicSelect');
  const imgCat = document.getElementById('imgTopicSelect');
  const _ph = '<option value="">- Select topic -</option>';
  if (textCat) textCat.innerHTML = _ph + opts;
  if (imgCat) imgCat.innerHTML = _ph + opts;
}

/* ===== LANGUAGE SYSTEM ===== */
const translations = {
  'en': {
    'langBtn': 'اردو', 'brand': 'Damadam', 'tagline': 'CHIT CHAT AND FUN POSTS',
    'newAccount': 'NEW ACCOUNT', 'chooseNick': 'Apni pasand ka aik nickname likhein:',
    'placeholderNick': 'Nickname...', 'checking': 'Checking...', 'next': 'NEXT',
    'securePass': 'Ab apna ek secure password likhein:', 'placeholderPass': 'Password...',
    'noteLine2': ', apka password', 'noteLine3': ' hai',
    'noteLine4': 'Ye password note kar lein takey apko yad rahay', 'finish': 'FINISH',
    'login': 'LOGIN', 'placeholderLoginNick': 'Nickname', 'placeholderLoginPass': 'Password',
    'existingAccount': 'EXISTING ACCOUNT', 'createAccount': 'CREATE NEW ACCOUNT', 'or': 'or',
    'about': 'About', 'policy': 'Policy', 'contact': 'Contact'
  },
  'ur': {
    'langBtn': 'English', 'brand': 'دمادم', 'tagline': 'چیٹ چیٹ اور مزےدار پوسٹس',
    'newAccount': 'نیا اکاؤنٹ', 'chooseNick': 'اپنی پسند کا ایک نک نیم لکھیں:',
    'placeholderNick': 'نک نیم...', 'checking': 'چیک ہو رہا ہے...', 'next': 'آگے',
    'securePass': 'اب اپنا ایک محفوظ پاسورڈ لکھیں:', 'placeholderPass': 'پاسورڈ...',
    'noteLine2': '، آپ کا پاسورڈ', 'noteLine3': ' ہے',
    'noteLine4': 'یہ پاسورڈ نوٹ کر لیں تاکہ آپ کو یاد رہے', 'finish': 'ختم',
    'login': 'لاگ ان', 'placeholderLoginNick': 'نک نیم', 'placeholderLoginPass': 'پاسورڈ',
    'existingAccount': 'موجودہ اکاؤنٹ', 'createAccount': 'نیا اکاؤنٹ بنائیں', 'or': 'یا',
    'about': 'ہمارے بارے', 'policy': 'پالیسی', 'contact': 'رابطہ'
  }
};

function t(key) {
  return translations[currentLang] ? (translations[currentLang][key] || translations['en'][key] || key) : key;
}

function toggleLanguage() {
  currentLang = currentLang === 'ur' ? 'en' : 'ur';
  localStorage.setItem('dm_lang', currentLang);
  translateAuthPage();
}

function translateAuthPage() {
  const tr = translations[currentLang];
  const brandEl = document.querySelector('.brand-name');
  if (brandEl) brandEl.textContent = tr.brand;
  const taglineEl = document.querySelector('.tagline');
  if (taglineEl) taglineEl.textContent = tr.tagline;
  const langBtn = document.querySelector('.lang-btn');
  if (langBtn) langBtn.textContent = tr.langBtn;
  
  const signupH2s = document.querySelectorAll('#box-signup-nick h2, #box-signup-pass h2');
  for (let i = 0; i < signupH2s.length; i++) { signupH2s[i].textContent = tr.newAccount; }
  
  const snp = document.querySelector('#box-signup-nick p');
  if (snp) snp.textContent = tr.chooseNick;
  const rn = document.getElementById('reg-nick');
  if (rn) rn.placeholder = tr.placeholderNick;
  const ld = document.getElementById('loader');
  if (ld) ld.textContent = tr.checking;
  
  const nextBtns = document.querySelectorAll('#box-signup-nick .btn-next, #box-signup-pass .btn-next');
  for (let j = 0; j < nextBtns.length; j++) { nextBtns[j].textContent = tr.next; }
  
  const spp = document.querySelector('#box-signup-pass p');
  if (spp) spp.textContent = tr.securePass;
  const rp = document.getElementById('reg-pass');
  if (rp) rp.placeholder = tr.placeholderPass;
  
  const fb = document.querySelector('#box-note .btn-next');
  if (fb) fb.textContent = tr.finish;
  
  const lh = document.querySelector('#box-login h2');
  if (lh) lh.textContent = tr.login;
  const ln = document.getElementById('log-nick');
  if (ln) ln.placeholder = tr.placeholderLoginNick;
  const lp = document.getElementById('log-pass');
  if (lp) lp.placeholder = tr.placeholderLoginPass;
  const lb = document.querySelector('#box-login .btn-next');
  if (lb) lb.textContent = tr.login;
  
  const tb = document.getElementById('toggle-btn');
  if (tb) {
    const loginBox = document.getElementById('box-login');
    tb.innerText = (loginBox && !loginBox.classList.contains('hidden')) ? tr.createAccount : tr.existingAccount;
  }
  
  const ss = document.querySelector('.separator span');
  if (ss) ss.textContent = tr.or;
  
  const fl = document.querySelectorAll('.footer-links a');
  if (fl.length >= 3) { fl[0].textContent = tr.about; fl[1].textContent = tr.policy; fl[2].textContent = tr.contact; }
  
  const np = document.querySelector('#box-note p:first-child');
  if (np) {
    const nick = (document.getElementById('show-nick') ? document.getElementById('show-nick').innerText : '');
    const pass = (document.getElementById('show-pass') ? document.getElementById('show-pass').innerText : '');
    np.innerHTML = '<span class="highlight" id="show-nick">' + esc(nick) + '</span>' + tr.noteLine2 + ' <span class="highlight" id="show-pass">' + esc(pass) + '</span>' + tr.noteLine3;
  }
  
  const np2 = document.querySelector('#box-note p:nth-child(2)');
  if (np2) np2.textContent = tr.noteLine4;
  
  document.body.style.direction = currentLang === 'ur' ? 'rtl' : 'ltr';
}

/* ===== HEARTBEAT SYSTEM ===== */
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (currentUserId) {
    const { db } = getFirebase();
    if (db) {
      db.ref('status/' + currentUserId).update({
        last_active: firebase.database.ServerValue.TIMESTAMP,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        state: 'online'
      });
      /* Presence fix: if the tab/browser is closed or the connection drops without
         an explicit logout, Firebase marks this user offline automatically instead
         of leaving state:'online' forever. */
      try {
        db.ref('status/' + currentUserId).onDisconnect().update({
          state: 'offline',
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
      } catch (e) {}
    }
  }
  heartbeatInterval = setInterval(function() {
    if (currentUserId) {
      const { db } = getFirebase();
      if (db) {
        db.ref('status/' + currentUserId).update({
          last_active: firebase.database.ServerValue.TIMESTAMP,
          state: 'online'
        });
      }
    }
  }, 120000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/* ===== AUTH SYSTEM ===== */
const badWords = ["adult","sex","sexy","porn","xxx","ganda","abuse",
  "hot","hoty","sixy","lund","lun","land",
  "chut","choot","gand","gandu","randi","kanjar","kanjri","harami","kutta","kutti",
  "fuck","fuk","shit","bitch","dick","pussy","slut","whore","boob","nude","cock"]; /* (v37) bad-name filter expanded */

/* ===== NAVIGATION HISTORY SYSTEM ===== */
const NavigationHistory = {
  stack: [],
  maxSize: 20,
  
  push(view, params) {
    if (this.stack.length > 0) {
      const last = this.stack[this.stack.length - 1];
      if (last.view === view && JSON.stringify(last.params || {}) === JSON.stringify(params || {})) {
        return;
      }
    }
    this.stack.push({ view, params: params || {}, timestamp: Date.now() });
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
    const state = { view: view, params: params || {}, navIndex: this.stack.length };
    try { history.pushState(state, '', '#' + view); } catch(e) {}
  },
  
  pop() {
    if (this.stack.length <= 1) return 'exit';
    this.stack.pop();
    return this.stack[this.stack.length - 1];
  },
  
  getCurrent() {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  },
  
  clear() { this.stack = []; }
};

window.addEventListener('popstate', function(event) {
  if (event.state && event.state.view && event.state.view !== 'exit') {
    var target = event.state;
    navigateToInternal(target.view, target.params || {}, true);
  } else {
    if (NavigationHistory.stack.length <= 1) {
      showExitConfirmation();
    }
  }
});

/* Stage 4 a11y: Escape closes any open modal/overlay */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  var closed = false;
  var overlays = document.querySelectorAll('.modal-overlay.show-modal, .more-overlay.show, .password-modal.show, .identity-modal');
  for (var i = 0; i < overlays.length; i++) {
    var o = overlays[i];
    var visible = o.classList.contains('show-modal') || o.classList.contains('show') || getComputedStyle(o).display !== 'none';
    if (visible) {
      o.classList.remove('show-modal', 'show');
      if (o.classList.contains('modal-overlay') || o.classList.contains('identity-modal') || o.id === 'exitModal') o.style.display = 'none';
      closed = true;
    }
  }
  var lb = window._imageLightbox;
  if (lb && lb.parentNode) { window._imageLightbox = null; lb.remove(); closed = true; }
  if (closed && e.preventDefault) e.preventDefault();
});

/* Stage 4 a11y: keyboard operability for clickable div/span elements.
   Many cards/menus are <div onclick="..."> — this makes them tab-focusable
   and activatable with Enter/Space, without touching their appearance. */
(function() {
  function makeFocusable(el) {
    var tag = (el.tagName || '').toLowerCase();
    if ((tag !== 'div' && tag !== 'span') || !el.hasAttribute('onclick')) return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    makeFocusable(root);
    var inner = root.querySelectorAll ? root.querySelectorAll('div[onclick],span[onclick]') : [];
    for (var k = 0; k < inner.length; k++) makeFocusable(inner[k]);
  }
  if ('MutationObserver' in window) {
    new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) scan(nodes[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (!t || t === document.body || t === document.documentElement) return;
    var tag = (t.tagName || '').toLowerCase();
    if (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea' || t.isContentEditable) return;
    if (typeof t.onclick !== 'function' && !t.hasAttribute('onclick')) return;
    if (e.preventDefault) e.preventDefault();
    t.click();
  });
})();

function showExitConfirmation() {
  var modal = document.getElementById('exitModal');
  if (modal) return;
  
  modal = document.createElement('div');
  modal.id = 'exitModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = '<div style="background:#fff;border-radius:16px;padding:25px;width:90%;max-width:350px;text-align:center;">' +
    '<div style="font-size:48px;margin-bottom:12px;">👋</div>' +
    '<h3 style="margin-bottom:8px;">Exit Damadam?</h3>' +
    '<p style="font-size:14px;color:#666;margin-bottom:20px;">Kya aap exit karna chahte hain?</p>' +
    '<div style="display:flex;gap:10px;">' +
    '<button id="confirmExitBtn" style="flex:1;padding:12px;background:#ef4444;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;">Exit 🚪</button>' +
    '<button id="cancelExitBtn" style="flex:1;padding:12px;background:#f1f5f9;color:#333;border:1.5px solid #e5e7eb;border-radius:10px;font-weight:600;cursor:pointer;">Stay 📱</button>' +
    '</div></div>';
  modal.onclick = function(e) { if (e.target === modal) cancelExit(); };
  document.body.appendChild(modal);
  
  document.getElementById('confirmExitBtn').onclick = confirmExit;
  document.getElementById('cancelExitBtn').onclick = cancelExit;
  
  try { history.pushState({ view: 'exit' }, '', '#exit'); } catch(e) {}
}

function confirmExit() {
  var modal = document.getElementById('exitModal');
  if (modal) modal.remove();
  try { window.close(); } catch(e) {}
  setTimeout(function() { window.location.href = 'about:blank'; }, 500);
}

function cancelExit() {
  var modal = document.getElementById('exitModal');
  if (modal) modal.remove();
  try { history.back(); } catch(e) {}
  if (NavigationHistory.stack.length > 0) {
    var last = NavigationHistory.stack[NavigationHistory.stack.length - 1];
    navigateToInternal(last.view, last.params || {}, true);
  } else {
    goToHomeInternal(true);
  }
}

/* ===== NAVIGATION FUNCTIONS ===== */
function showSortBar() {
  const mc = document.getElementById('main-content-area');
  if (mc) mc.style.marginTop = '82px';
}

function hideSortBar() {
  const mc = document.getElementById('main-content-area');
  if (mc) mc.style.marginTop = '82px';
}

function navigateTo(page) {
  if (page === 'about' || page === 'policy' || page === 'contact') {
    const container = document.getElementById('main-content-area');
    openStaticPage(page, container);
    return;
  }
  if (!currentUserId) return;
  NavigationHistory.push(page);
  if (page === 'home') {
    goToHomeInternal(true);
  } else if (page === 'profile') {
    goToProfileInternal(currentUserId, true);
  }
}

/* (v145) Audit fix: Privacy Settings error screen ka missing Go Home */
function goHome() { goToHomeInternal(false); }
function goToHomeInternal(isBack) {
  currentView = 'home';
  if (!isBack) NavigationHistory.push('home');
  const topHeader = document.querySelector('.top-header');
  const subNav = document.querySelector('.sub-nav');
  if (topHeader) topHeader.style.display = '';
  if (subNav) subNav.style.display = '';
  showSortBar();
  if (currentTab === 'text') loadTextFeed();
  else loadImageFeed();
  saveViewState();
}

function goToProfileInternal(uid, isBack) {
  currentView = 'profile';
  if (!isBack) NavigationHistory.push('profile', { uid: uid });
  hideSortBar();
  loadProfile(uid);
  saveViewState({ uid: uid });
}

/* Stage 5 SEO: route-aware document titles + meta descriptions for the SPA views */
function updateRouteTitle(view) {
  var titles = {
    home: 'Home - Damadam.Pk Social Chat Platform',
    profile: 'Profile - Damadam.Pk',
    forme: 'For Me - Damadam.Pk',
    inbox: 'Inbox - Damadam.Pk',
    mehfils: 'Mehfils - Damadam.Pk',
    topics: 'Topics - Damadam.Pk',
    online: 'Online Users - Damadam.Pk',
    search: 'Search - Damadam.Pk',
    admin: 'Admin Panel - Damadam.Pk',
    about: 'About - Damadam.Pk',
    contact: 'Contact - Damadam.Pk',
    policy: 'Privacy Policy - Damadam.Pk',
    postDetail: 'Post - Damadam.Pk',
    mehfil: 'Mehfil - Damadam.Pk'
  };
  var descs = {
    home: 'Damadam.Pk home — latest community posts, mehfils and 1-on-1 chats from Pakistan.',
    profile: 'User profile on Damadam.Pk — posts, followers and likes.',
    forme: 'Your personalized feed on Damadam.Pk.',
    inbox: 'Your Damadam.Pk inbox — notifications and likes.',
    mehfils: 'Join public mehfils (group discussions) on Damadam.Pk, or create your own.',
    topics: 'Browse Damadam.Pk posts by topic.',
    online: 'See who is online now on Damadam.Pk.',
    search: 'Search people and posts on Damadam.Pk.',
    about: 'About Damadam.Pk — Pakistan community chat platform.',
    contact: 'Contact the Damadam.Pk team.',
    policy: 'Damadam.Pk privacy policy — how we handle your data and cookies.',
    postDetail: 'View this post on Damadam.Pk.',
    mehfil: 'Join this mehfil discussion on Damadam.Pk.'
  };
  try { document.title = titles[view] || 'Damadam.Pk - Social Chat Platform'; } catch (e) {}
  try {
    var md = document.querySelector('meta[name="description"]');
    if (md && descs[view]) md.setAttribute('content', descs[view]);
  } catch (e) {}
  /* (2026-10-12) AUDIT 5.2: profile/admin views noindex */
  try {
    var rb = document.querySelector('meta[name="robots"]');
    if (rb) rb.setAttribute('content', (view === 'profile' || view === 'admin') ? 'noindex,follow' : 'index,follow');
  } catch (e) {}
  /* (2026-10-12) AUDIT 5.4: html lang/dir currentLang ke hisab se */
  try {
    if (typeof currentLang !== 'undefined') {
      document.documentElement.lang = (currentLang === 'ur') ? 'ur' : 'en';
      document.documentElement.dir = (currentLang === 'ur') ? 'rtl' : 'ltr';
    }
  } catch (e) {}
}

function navigateToInternal(view, params, isBack) {
  updateRouteTitle(view); /* Stage 5 SEO: route-aware title */
  /* (v145) Audit fix: chat se back-nav par listeners detach (warna background me sync chalta rehta) */
  if (currentChatId && view !== 'chat') {
    if (window._chatStatusRef && window._chatStatusCb) { window._chatStatusRef.off('value', window._chatStatusCb); window._chatStatusRef = null; window._chatStatusCb = null; }
    if (window._permRef && window._permCb) { window._permRef.off('value', window._permCb); window._permRef = null; window._permCb = null; }
    if (window._cleanupRef && window._cleanupCb) { window._cleanupRef.off('value', window._cleanupCb); window._cleanupRef = null; window._cleanupCb = null; }
    if (window._chatMetaRef) { window._chatMetaRef.off(); window._chatMetaRef = null; }
    if (chatListener) { chatListener.off(); chatListener = null; }
    currentChatId = null;
  }
  if (view === 'about' || view === 'policy' || view === 'contact') {
    openStaticPage(view);
    return;
  }
  if (!currentUserId) {
    document.getElementById('auth-container').classList.add('show-auth');
    document.getElementById('home-page-ui').classList.remove('show-home');
    return;
  }
  switch(view) {
    case 'home': goToHomeInternal(isBack); break;
    case 'profile': goToProfileInternal(params.uid || currentUserId, isBack); break;
    case 'forme': goToFormeInternal(isBack); break;
    case 'inbox': openInboxInternal(isBack); break;
    case 'mehfils': openPage('mehfils', isBack); break;
    case 'topics': openPage('topics', isBack); break;
    case 'online': openPage('online', isBack); break;
    case 'search': openPage('search', isBack); break;
    case 'admin': openPage('admin', isBack); break;
    case 'about': openPage('about', isBack); break;
    case 'contact': openPage('contact', isBack); break;
    case 'policy': openPage('policy', isBack); break;
    case 'postDetail': showFullPostInternal(params.postId, params.type || 'text', isBack); break;
    case 'mehfil': openMehfil(params.mehfilId, isBack); break;
    default: goToHomeInternal(true);
  }
  saveViewState(params);
}

function saveViewState(params) {
  var state = { view: currentView, tab: currentTab };
  if (params) {
    if (params.uid) state.uid = params.uid;
    if (params.mehfilId) state.mehfilId = params.mehfilId;
    if (params.postId) state.postId = params.postId;
    if (params.type) state.type = params.type;
  }
  try { localStorage.setItem('appViewState', JSON.stringify(state)); } catch(e) {}
}

function goToFormeInternal(isBack) {
  currentView = 'forme';
  if (!isBack) NavigationHistory.push('forme');
  const topHeader = document.querySelector('.top-header');
  const subNav = document.querySelector('.sub-nav');
  if (topHeader) topHeader.style.display = '';
  if (subNav) subNav.style.display = '';
  hideSortBar();
  loadForMeFeed();
  saveViewState();
}

function switchTab(btn, tab) {
  var allTabs = document.querySelectorAll('.nav-tab');
  for (var i = 0; i < allTabs.length; i++) { allTabs[i].classList.remove('active'); }
  btn.classList.add('active');
  currentView = 'home';
  currentTab = tab;
  
  showSortBar();
  
  if (tab === 'text') loadTextFeed();
  else if (tab === 'stars') loadStarsTab();
  else loadImageFeed();
  saveViewState();
}

function navClick(btn, page) {
  var allBtns = document.querySelectorAll('.footer-btn');
  for (var i = 0; i < allBtns.length; i++) { allBtns[i].classList.remove('active'); }
  btn.classList.add('active');
  
  if (page === 'forme') {
    NavigationHistory.push('forme');
    currentView = 'forme';
    hideSortBar();
    loadForMeFeed();
    saveViewState();
  }
}

function showMore() {
  document.getElementById('moreOverlay').classList.add('show');
}

function closeMore(e) {
  if (!e || e.target === e.currentTarget) document.getElementById('moreOverlay').classList.remove('show');
}

function closeMoreDirect() {
  document.getElementById('moreOverlay').classList.remove('show');
}

function goBack() {
  handleBackPress();
}

function handleBackPress() {
  var previous = NavigationHistory.pop();
  if (previous === 'exit') {
    if (!currentUserId) {
      document.getElementById('auth-container').classList.add('show-auth');
      document.getElementById('home-page-ui').classList.remove('show-home');
      NavigationHistory.clear();
      return;
    }
    showExitConfirmation();
    return;
  }
  if (previous && previous.view) {
    navigateToInternal(previous.view, previous.params || {}, true);
  } else {
    goToHomeInternal(true);
  }
}


/* ===== v147 block (orig theme lines 2438-2698) ===== */

/* ===== AUTH FUNCTIONS ===== */
async function checkUsername() {
  const nick = document.getElementById('reg-nick').value.toLowerCase().trim();
  const loader = document.getElementById('loader');
  
  if (nick.length < 3) return alert("Nickname bohot chota hai!");
  if (badWords.some(function(w) { return nick.indexOf(w) !== -1; })) return alert("Ye naam allowed nahi hai!");
  
  loader.style.display = "block";
  loader.textContent = t('checking');
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const doc = await db.ref('usernames/' + nick).once('value');
    if (doc.exists()) {
      alert("Ye nickname pehle se kisi ke paas hai!");
    } else {
      document.getElementById('box-signup-nick').classList.add('hidden');
      document.getElementById('box-signup-pass').classList.remove('hidden');
    }
  } catch(e) {
    alert("Database error!");
  }
  loader.style.display = "none";
}

function toNote() {
  const p = document.getElementById('reg-pass').value;
  if (p.length < 6) return alert("Password min 6 chars!");
  document.getElementById('show-nick').innerText = document.getElementById('reg-nick').value;
  document.getElementById('show-pass').innerText = p;
  document.getElementById('box-signup-pass').classList.add('hidden');
  document.getElementById('box-note').classList.remove('hidden');
  document.getElementById('footer-ui').classList.add('hidden');
  translateAuthPage();
}

async function finalRegister() {
  const rawNick = document.getElementById('reg-nick').value;
  const pass = document.getElementById('reg-pass').value;
  /* H2: re-validate on submit — the checks in checkUsername() can be bypassed from the console.
     Validate the RAW input first: sanitizeNickname() must not silently invent a nickname for bad input. */
  const rawClean = String(rawNick || '').trim();
  if (rawClean.length < 3) { alert("Nickname bohot chota hai!"); return; }
  if (!/^[A-Za-z0-9_.-]+$/.test(rawClean)) { alert("Nickname mein sirf letters, numbers, _ . - allowed hain!"); return; }
  const nick = sanitizeNickname(rawClean);
  if (badWords.some(function(w) { return nick.indexOf(w) !== -1; })) { alert("Ye naam allowed nahi hai!"); return; }
  if (pass.length < 6) { alert("Password min 6 chars!"); return; }
  const email = nick + "@damadam.local";
  
  try {
    const { auth, db } = getFirebase();
    if (!auth || !db) throw new Error('Firebase not ready');
    /* (v70) IP ban check on signup: banned IP = no new account */
    try {
      var _suIp = await fetch('https://api.ipify.org?format=json').then(function(r){return r.json();}).catch(function(){return null;});
      if (_suIp && _suIp.ip) {
        var _suIpKey = _suIp.ip.replace(/\./g, '_');
        var _suBan = await db.ref('bannedIPs/' + _suIpKey).once('value');
        if (_suBan && _suBan.val()) { alert('🚫 This IP address is banned. You cannot create a new account.'); return; }
      }
    } catch(_e) {}
    /* (v125) 1 IP par 1 din me sirf 1 ID: is IP se aakhri 24 ghante me bani ID ho to naya account nahi.
       Fail-open: IP ya users read fail ho to signup nahi roka jayega (banned-check jaisa). */
    if (_suIp && _suIp.ip) {
      try {
        var _suUsers = await db.ref('users').once('value');
        var _suNow = Date.now();
        var _suBlocked = false;
        _suUsers.forEach(function(_doc) {
          if (_suBlocked) return true;
          var _uu = _doc.val() || {};
          if (!_uu.joined || (_suNow - _uu.joined) > 24*60*60*1000) return;
          var _sameIP = (_uu.lastIP === _suIp.ip) || (_uu.ipHistory && _uu.ipHistory[_suIpKey]);
          if (_sameIP) { _suBlocked = true; return true; }
        });
        if (_suBlocked) { alert('ap ne already 1 account bana lia hai ab 1 din bad dobara account bana skty ha'); return; }
      } catch(_e2) {}
    }
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    /* H1/H2: atomic claim — never overwrites another user's nickname mapping (suffix added on race) */
    const claimedNick = await claimUsername(db, nick, cred.user.uid);
    await db.ref('users/' + cred.user.uid).set({
      username: claimedNick,
      email: email,
      bio: '',
      profilePic: '',
      joined: firebase.database.ServerValue.TIMESTAMP,
      city: '',
      age: 18,
      gender: ''
    });
    alert("Account taiyar hai!");
  } catch(e) {
    alert(e.message);
  }
}

async function loginNow() {
  const nick = document.getElementById('log-nick').value.toLowerCase().trim();
  const pass = document.getElementById('log-pass').value;
  
  try {
    const { auth, db } = getFirebase();
    if (!auth || !db) throw new Error('Firebase not ready');
    let email = nick;
    if (nick.indexOf('@') === -1) {
      const snap = await db.ref('usernames/' + nick).once('value');
      if (snap.exists()) {
        /* (2026-10-12) AUDIT 8.4: stale mapping repair — ek dafa val() parho. */
        const uid = snap.val();
        const userSnap = await db.ref('users/' + uid).once('value');
        const ud = userSnap.val();
        if (!ud) {
          try { await db.ref('usernames/' + nick).remove(); } catch(e) {}
          throw new Error('Account mapping stale — please re-register.');
        }
        email = ud.email || (nick + "@damadam.local");
      } else {
        email = nick + "@damadam.local";
      }
    }
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    alert("Ghalat Nickname ya Password!");
  }
}

function toggleAuth() {
  const login = document.getElementById('box-login');
  const signup = document.getElementById('box-signup-nick');
  const btn = document.getElementById('toggle-btn');
  
  if (login.classList.contains('hidden')) {
    signup.classList.add('hidden');
    document.getElementById('box-signup-pass').classList.add('hidden');
    login.classList.remove('hidden');
    btn.innerText = t('createAccount');
  } else {
    login.classList.add('hidden');
    signup.classList.remove('hidden');
    btn.innerText = t('existingAccount');
  }
}

/* ===== ENHANCED LOGOUT WITH CLEANUP ===== */
function cleanupListeners() {
  if (mehfilListener) {
    mehfilListener.off();
    mehfilListener = null;
  }
  if (chatListener) {
    chatListener.off();
    chatListener = null;
  }
  if (chatInviteListener) {
    chatInviteListener.off();
    chatInviteListener = null;
  }
  if (window._chatMetaRef) { window._chatMetaRef.off(); window._chatMetaRef = null; }
  if (typeof detachMehfilOnlineBars === 'function') detachMehfilOnlineBars();
}

async function logout() {
  cleanupListeners();
  stopHeartbeat();
  
  if (currentUserId) {
    const { db } = getFirebase();
    if (db) {
      try {
        await db.ref('status/' + currentUserId).update({
          state: 'offline',
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
          last_active: firebase.database.ServerValue.TIMESTAMP
        });
        
        /* Stage 3 perf: only clear presence for mehfils joined this session (was: full mehfils scan).
           Stale sessions are already handled by onDisconnect().remove(). */
        const updates = {};
        Object.keys(window._presenceMehfils || {}).forEach(function(mid) {
          updates['mehfils/' + mid + '/online/' + currentUserId] = null;
        });
        if (Object.keys(updates).length) await db.ref().update(updates);
        window._presenceMehfils = {};
      } catch(e) {}
    }
  }
  
  const overlays = document.querySelectorAll('.modal-overlay, .more-overlay, .password-modal, .identity-modal');
  for (let i = 0; i < overlays.length; i++) {
    overlays[i].classList.remove('show-modal', 'show');
    if (overlays[i].style) overlays[i].style.display = 'none';
  }
  
  const chatList = document.getElementById('chatListScreen');
  if (chatList) chatList.style.display = 'none';
  
  const chatFS = document.getElementById('chatFullscreen');
  if (chatFS) chatFS.remove();
  
  const exitModal = document.getElementById('exitModal');
  if (exitModal) exitModal.remove();
  
  UserCache.clear();
  CacheManager.clear();
  clearPostCache();
  userDpCache = {};
  
  NavigationHistory.clear();
  
  currentUser = null;
  currentUserId = null;
  followedUsers = [];
  currentChatId = null;
  currentMehfilId = null;
  
  const { auth } = getFirebase();
  if (auth) {
    try {
      await auth.signOut();
    } catch(e) {}
  }
  
  document.getElementById('home-page-ui').classList.remove('show-home');
  document.getElementById('auth-container').classList.add('show-auth');
  document.getElementById('box-login').classList.add('hidden');
  document.getElementById('box-signup-nick').classList.remove('hidden');
  document.getElementById('footer-ui').classList.remove('hidden');
  const toggleBtn = document.getElementById('toggle-btn');
  if (toggleBtn) toggleBtn.innerText = t('existingAccount');
  
  const keys = Object.keys(localStorage);
  for (let k = 0; k < keys.length; k++) {
    if (keys[k].indexOf('rl_') === 0) localStorage.removeItem(keys[k]);
  }
  
  setTimeout(translateAuthPage, 300);
}

async function loadFollowedUsers() {
  const { db } = getFirebase();
  if (!db || !currentUserId) return;
  try { if (typeof ddpLoadPendingReqs === 'function') ddpLoadPendingReqs(); } catch(e) {}
  const snap = await db.ref('users/' + currentUserId + '/following').once('value');
  followedUsers = [];
  snap.forEach(function(d) { followedUsers.push(d.key); });
  
  const followingSnap = await db.ref('following/' + currentUserId).once('value');
  const followingData = followingSnap.val() || {};
  for (let fid in followingData) {
    if (followingData.hasOwnProperty(fid) && followedUsers.indexOf(fid) === -1) {
      followedUsers.push(fid);
    }
  }
}


/* ===== v147 block (orig theme lines 2700-3705) ===== */

/* ===== FEED FUNCTIONS - OPTIMIZED WITH BATCH LOADING ===== */

/* ===== HOME notification box + Trending/Latest tabs ===== */
var ddpFeedTab = 'latest';
try { const _ft = localStorage.getItem('ddpFeedTab'); if (_ft === 'latest' || _ft === 'trending') ddpFeedTab = _ft; } catch(e) {}
/* (v112) Trending rule: 5 likes = trending, 1 week ke baad auto-expire.
   Sort likes ke hisab se — zyada likes wali post upar, chahe 2-3-4 din purani ho.
   Text aur image feeds alag-alag hain, lekin rule dono ke liye yahi hai. */
function ddpLikeCount(p) {
  return (p.likes && typeof p.likes === 'object') ? Object.keys(p.likes).length : (p.likeCount || 0);
}
function ddpIsTrending(p) {
  const _weekAgo = Date.now() - 7 * 86400000;
  return (p.timestamp || 0) >= _weekAgo && ddpLikeCount(p) >= 5;
}
function ddpSortPosts(posts) {
  if (ddpFeedTab === 'trending') {
    const base = posts.filter(function(p) { return ddpIsTrending(p); });
    base.sort(function(a, b) { const la = ddpLikeCount(a), lb = ddpLikeCount(b); if (lb !== la) return lb - la; return (b.timestamp || 0) - (a.timestamp || 0); });
    return base;
  }
  const cp = posts.slice();
  cp.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
  return cp;
}

/* (v117) TRENDING SAVE: flag wali trending posts seedha parho — nayi posts ki
   tadad se koi lena dena nahi. Flag like handler lagata/hata ta hai; display
   par rule (7 din + 5 likes, expire nahi) phir bhi dobara check hota hai, is
   liye jhoota flag kabhi post ko trending me nahi la sakta. */
async function ddpFetchFlaggedTrending(db) {
  const out = [];
  try {
    const snap = await db.ref('posts').orderByChild('trending').equalTo(true).once('value');
    snap.forEach(function(c) {
      const p = c.val(); p.id = c.key;
      if (!isExpired(p) && typeof ddpIsTrending === 'function' && ddpIsTrending(p)) out.push(p);
      /* (v121) Lazy cleanup: ghalat/purani flag wahin delete karo (sirf logged-in user; posts write ko auth chahiye). Fire-and-forget: load ko rokta nahi. */
      else if (currentUserId && typeof ddpIsTrending === 'function') { try { db.ref('posts/' + c.key).update({ trending: null }); } catch(e) {} }
    });
  } catch(e) {}
  return out;
}

/* (v140) Stars tab ki Trending ranking (badge display v140 me remove; yeh function tab ke liye rehta hai) */
async function ddpGetTrendingUserRanks() {
  try {
    const _cc = window._ddpTrendRanking;
    if (_cc && (Date.now() - _cc.time) < 900000) { try { window._ddpTrendCounts = _cc.counts || {}; } catch(e) {} return _cc.ranked; }
    try { var _ls = JSON.parse(localStorage.getItem('ddpTrendRanking') || 'null'); if (_ls && (Date.now() - _ls.time) < 900000 && Array.isArray(_ls.ranked)) { window._ddpTrendRanking = _ls; try { window._ddpTrendCounts = _ls.counts || {}; } catch(e) {} return _ls.ranked; } } catch(e) {}
    if (window._ddpTrendRankingPromise) return window._ddpTrendRankingPromise;
    const _p = (async function() {
      try {
        const fb = getFirebase(); const db = fb && fb.db;
        if (!db) return [];
        const counts = {}, latest = {};
        let _preFlagsS = [], _skipScanS = false;
        try {
          _preFlagsS = await ddpFetchFlaggedTrending(db);
          const _fuS = {};
          _preFlagsS.forEach(function(p) { if (p.user_id) _fuS[p.user_id] = true; });
          if (Object.keys(_fuS).length >= 10) _skipScanS = true;
        } catch(e) {}
        let totalTrending = 0, lastTs = null;
        for (let batch = 0; batch < 1 && totalTrending < 200 && !_skipScanS; batch++) {
          let qq = db.ref('posts').orderByChild('timestamp');
          if (lastTs) qq = qq.endAt(lastTs - 1);
          const snap = await qq.limitToLast(200).once('value');
          if (!snap.exists()) break;
          let bp = [];
          snap.forEach(function(c) { const p = c.val(); p.id = c.key; bp.push(p); });
          if (bp.length === 0) break;
          bp.sort(function(a,b) { return (a.timestamp||0) - (b.timestamp||0); });
          lastTs = bp[0].timestamp;
          for (let i = 0; i < bp.length && totalTrending < 200; i++) {
            const p = bp[i]; if (!p || !p.user_id) continue;
            if (isExpired(p)) continue;
            if (typeof ddpIsTrending === 'function' && ddpIsTrending(p)) {
              counts[p.user_id] = (counts[p.user_id] || 0) + 1;
              if ((p.timestamp || 0) > (latest[p.user_id] || 0)) latest[p.user_id] = p.timestamp;
              totalTrending++;
            }
          }
          if (bp.length < 200) break;
        }
        /* (v150) Flagged list dobara fetch nahi - upar wali _preFlagsS hi reuse karo (aik query bachi). */
        try {
          _preFlagsS.forEach(function(p) { if (p.user_id && !(p.user_id in counts)) counts[p.user_id] = 0; });
        } catch(e) {}
        const myCount = {}, myLatest = {};
        await Promise.all(Object.keys(counts).map(async function(uid) {
          try {
            const ps = await db.ref('posts').orderByChild('user_id').equalTo(uid).once('value');
            let n = 0, lt = 0;
            ps.forEach(function(c) { const pp = c.val() || {}; if (!isExpired(pp) && typeof ddpIsTrending === 'function' && ddpIsTrending(pp)) { n++; if ((pp.timestamp || 0) > lt) lt = pp.timestamp; } });
            myCount[uid] = n; myLatest[uid] = lt;
          } catch(e) { myCount[uid] = counts[uid] || 0; myLatest[uid] = latest[uid] || 0; }
        }));
        let uids = Object.keys(counts).sort(function(a, b) {
          if (myCount[b] !== myCount[a]) return myCount[b] - myCount[a];
          return (myLatest[b] || 0) - (myLatest[a] || 0);
        });
        uids = uids.filter(function(uid) { return (myCount[uid] || 0) > 0; });
        try {
          const myBlocked = await getMyBlockedList();
          const _uds = await Promise.all(uids.map(async function(uid) { try { return await UserCache.get(uid); } catch(e) { return null; } }));
          const kept = [];
          for (let i = 0; i < uids.length; i++) {
            const uid = uids[i];
            if (myBlocked.indexOf(uid) !== -1) continue;
            const ud = _uds[i];
            if (ud && (ud.blockedUsers || []).indexOf(currentUserId) !== -1) continue;
            kept.push(uid);
          }
          uids = kept;
        } catch(e) {}
        window._ddpTrendRanking = { time: Date.now(), ranked: uids, counts: myCount };
        try { localStorage.setItem('ddpTrendRanking', JSON.stringify({ time: Date.now(), ranked: uids, counts: myCount })); } catch(e) {}
        try { window._ddpTrendCounts = myCount; } catch(e) {}
        return uids;
      } catch (e) { return []; }
    })();
    window._ddpTrendRankingPromise = _p;
    /* (v150) Stale-while-revalidate: purani ranking (60 min tak) foran dikhao, nayi gin-ti peeche se kar ke list khud update kar do - dobara kholna baki tabs jaisa foran. */
    if (_cc && (Date.now() - _cc.time) < 3600000) {
      _p.then(function() {
        window._ddpTrendRankingPromise = null;
        try { _starsTrendingCache.time = 0; } catch(e) {}
        try { if (document.getElementById('ddpStarsTrendingList') && typeof ddpStarsTab !== 'undefined' && ddpStarsTab === 'trending') ddpRenderStarsTrendingList(); } catch(e) {}
      }).catch(function() { window._ddpTrendRankingPromise = null; });
      try { window._ddpTrendCounts = _cc.counts || {}; } catch(e) {}
      return _cc.ranked;
    }
    const _r = await _p;
    window._ddpTrendRankingPromise = null;
    return _r;
  } catch (e) { return []; }
}


function ddpEngagement(p) {
  const likes = (p.likes && typeof p.likes === 'object') ? Object.keys(p.likes).length : (p.likeCount || 0);
  const comments = p.comment_count || 0;
  const points = likes + 2 * comments;
  const ageHours = Math.max(0, (Date.now() - (p.timestamp || Date.now())) / 3600000);
  return points / Math.pow(ageHours + 2, 1.3);
}


function ddpFeedChromeHTML(feedType) {
  const isT = (ddpFeedTab === 'trending');
  let h = '<div id="ddpHomeNotif"></div>';
  h += ddpExplorePillsHTML(feedType);
  h += '<div class="ddp-feed-tabs">';
  h += '<button class="ddp-tab' + (isT ? ' active' : '') + '" onclick="ddpSwitchFeedTab(\'trending\',\'' + feedType + '\')">🔥 TRENDING</button>';
  h += '<button class="ddp-tab' + (!isT ? ' active' : '') + '" onclick="ddpSwitchFeedTab(\'latest\',\'' + feedType + '\')">📚 LATEST</button>';
  h += '</div>';
  h += '<div class="ddp-section-title">🌐 <span>' + (isT ? 'Trending' : 'Latest') + ' ' + (ddpFeedCategory ? esc(ddpFeedCategory) + ' ' : '') + feedType + ' (page ' + ddpGetFeedPage(feedType) + '):</span></div>';
  return h;
}
function ddpSwitchFeedTab(tab, feedType) {
  ddpTextPage = 1; ddpImagePage = 1;
  ddpFeedTab = tab;
  try { localStorage.setItem('ddpFeedTab', tab); } catch(e) {}
  if (feedType === 'image') loadImageFeed();
  else loadTextFeed();
}


/* ===== REALTIME notifications: badge + home blue card + toast ===== */
var _notifListenerRef = null;
var _notifCache = [];
var _notifSeenIds = {};
function startNotifListener() {
  if (!currentUserId) return;
  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return;
  if (_notifListenerRef) { try { _notifListenerRef.off(); } catch(e) {} }
  _notifListenerRef = db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).limitToLast(30);
  _notifListenerRef.on('value', function(snap) {
    const notifs = [];
    snap.forEach(function(doc) {
      const n = doc.val();
      if (n) { n.id = doc.key; notifs.push(n); }
    });
    notifs.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    /* (v24) green bell toast REMOVED — user request (irritating). Badge + home card kaafi hain. */
    for (let i = 0; i < notifs.length; i++) {
      const n = notifs[i];
      if (!n.read && !n.autoDismissed && !_notifSeenIds[n.id]) {
        _notifSeenIds[n.id] = true;
      }
    }
    _notifCache = notifs;
    let count = 0;
    for (let j = 0; j < notifs.length; j++) if (notifs[j].type !== 'mehfil_invite' && !notifs[j].read && !notifs[j].autoDismissed) count++;
    const badge = document.getElementById('inboxBadge');
    if (badge) {
      badge.textContent = count > 0 ? '+' + count : '0';
      badge.classList.toggle('hidden', count === 0);
    }
    const box = document.getElementById('ddpHomeNotif');
    if (box) ddpRenderHomeNotifFromCache();
    const ib = document.getElementById('inboxTabContent');
    if (ib && typeof loadInboxActivity === 'function' && document.getElementById('inboxNotif_' + (notifs[0] || {}).id) === null) {
      /* inbox open + new item arrived -> refresh list */
    }
  });
}
function stopNotifListener() {
  if (_notifListenerRef) { try { _notifListenerRef.off(); } catch(e) {} }
  _notifListenerRef = null;
  _notifCache = [];
  _notifSeenIds = {};
}
/* (v28) ddpNotifToast removed — green bell toast disabled per user request */
async function ddpRenderHomeNotifFromCache() {
  const box = document.getElementById('ddpHomeNotif');
  if (!box || !currentUserId) return;
  /* (v123) Mehfil invite blue patti par nahi — sirf Mehfil > Invites me */
  const types = ['comment', 'reply', 'like', 'follow', 'follow_request', 'mehfil_reply', 'mehfil_announce', '1on1_reply', '1on1_invite'];
  const notifs = _notifCache.filter(function(n) {
    return !n.read && !n.autoDismissed && types.indexOf(n.type) !== -1;
  });
  if (notifs.length === 0) { box.innerHTML = ''; return; }
  box.innerHTML = await ddpHomeNotifHTML(notifs[0]);
}

async function ddpLoadHomeNotif() {
  /* realtime listener cache drives the home card — no extra query per feed load */
  if (!_notifListenerRef) { try { startNotifListener(); } catch(e) {} }
  ddpRenderHomeNotifFromCache();
  
}
async function ddpHomeNotifHTML(n) {
  const fb = getFirebase();
  const db = fb && fb.db;
  const sender = esc(n.sender_name || 'User');
  const msgText = ddpEmojify(esc((n.replyPreview || n.message || '').substring(0, 120))); /* (v104) blue patti me emoji render */
  const timeText = n.timestamp ? timeAgo(new Date(n.timestamp)) : '';
  let ctxLine = '';
  let youLine = '';
  if ((n.type === 'comment' || n.type === 'reply') && n.postId && db) {
    try {
      const ps = await db.ref('posts/' + n.postId).once('value');
      const p = ps.val() || {};
      const ptext = (p.text || p.caption || '').substring(0, 70);
      const isU = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(ptext);
      ctxLine = '<b>' + (n.type === 'comment' ? 'POST' : 'REPLY') + '</b> - <b>' + esc(p.category || 'Post') + '</b>: <span class="' + (isU ? 'ddp-u' : '') + '">' + ddpEmojify(esc(ptext)) + '</span>';
    } catch(e) { ctxLine = '<b>POST</b>'; }
    youLine = (n.type === 'comment' ? 'on your post' : 'on your comment');
  } else if (n.type === 'mehfil_reply') {
    ctxLine = '<b>MEHFIL</b> - <b>' + esc(n.mehfilName || 'Mehfil') + '</b>';
    youLine = 'mentioned you';
  } else if (n.type === '1on1_reply') {
    ctxLine = '<b>1 ON 1</b> - private message';
    youLine = '';
  } else if (n.type === 'like') {
    try {
      if (n.postId && db) {
        const ps2 = await db.ref('posts/' + n.postId).once('value');
        const p2 = ps2.val() || {};
        const ptext2 = (p2.text || p2.caption || '').substring(0, 70);
        ctxLine = '<b>❤️ LIKE</b> - <b>' + esc(p2.category || 'Post') + '</b>: ' + ddpEmojify(esc(ptext2));
      } else { ctxLine = '<b>❤️ LIKE</b>'; }
    } catch(e) { ctxLine = '<b>❤️ LIKE</b>'; }
    youLine = 'liked your post';
  } else if (n.type === 'follow') {
    ctxLine = '<b>👥 FOLLOW</b> - new follower';
    youLine = 'started following you';
  } else if (n.type === 'follow_request') {
    ctxLine = '<b>📩 FOLLOW REQUEST</b>';
    youLine = 'wants to follow you';
  } else if (n.type === 'mehfil_announce') {
    ctxLine = '<b>📢 MEHFIL ANNOUNCEMENT</b> - <b>' + esc(n.mehfilName || 'Mehfil') + '</b>';
    youLine = 'announcement for all members';
  } else if (n.type === 'mehfil_admin_msg') {
    ctxLine = '<b>📩 MEHFIL ADMIN MSG</b> - <b>' + esc(n.mehfilName || 'Mehfil') + '</b>';
    youLine = 'sent a message for admin';
  } else if (n.type === 'mehfil_invite') {
    ctxLine = '<b>🎪 MEHFIL</b> - <b>' + esc(n.mehfilName || 'Mehfil') + '</b>';
    youLine = 'invited you';
  } else if (n.type === '1on1_invite') {
    ctxLine = '<b>💬 1 ON 1</b> - chat invite';
    youLine = 'wants to chat';
  }
  const safeSender = escAttrJS(n.sender_name || 'User');
  let h = '<div class="ddp-notif-card">';
  h += '<button class="ddp-notif-x" onclick="event.stopPropagation();ddpDismissHomeNotif(\'' + n.id + '\')">✕</button>';
  h += '<div class="ddp-notif-body" onclick="ddpHomeNotifClick(\'' + n.id + '\',\'' + (n.type || '') + '\',\'' + (n.postId || '') + '\',\'' + (n.mehfilId || '') + '\',\'' + (n.fromUid || '') + '\',\'' + safeSender + '\')">';
  h += '<div class="ddp-notif-ctx">' + ctxLine + '</div>';
  h += '<div class="ddp-notif-msg"><b>' + sender + ' :</b> <span>' + msgText + '</span><span class="time">' + timeText + '</span></div>';
  if (youLine) h += '<div class="ddp-notif-you">➔ you: ' + esc(youLine) + '</div>';
  h += '</div>';
  var _canReply = (n.type === 'comment' || n.type === 'reply' || n.type === '1on1_reply' || n.type === 'mehfil_reply');
  if (_canReply) {
    h += '<button class="ddp-notif-replybar" onclick="event.stopPropagation();ddpToggleHomeNotifDrawer(\'' + n.id + '\')">REPLY <span>▼</span></button>';
    h += '<div class="ddp-notif-drawer" id="inboxReplyBox_' + n.id + '" style="display:none;" onclick="event.stopPropagation();">';
    h += '<input id="inboxReplyInput_' + n.id + '" placeholder="Reply to ' + escAttr(sender) + '..." maxlength="300"/>';
    h += '<button onclick="ddpSendHomeNotifReply(\'' + n.id + '\',\'' + (n.postId || '') + '\',\'' + (n.fromUid || '') + '\',\'' + (n.mehfilId || '') + '\')">Send</button>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}
function ddpToggleHomeNotifDrawer(notifId) {
  const box = document.getElementById('inboxReplyBox_' + notifId);
  if (!box) return;
  const show = (box.style.display === 'none' || !box.style.display);
  box.style.display = show ? 'flex' : 'none';
  if (show) {
    const inp = document.getElementById('inboxReplyInput_' + notifId);
    if (inp) setTimeout(function() { inp.focus(); }, 50);
  }
}
async function ddpSendHomeNotifReply(notifId, postId, toUid, mehfilId) {
  await sendInboxReply(notifId, postId, toUid, mehfilId);
  const card = document.getElementById('ddpHomeNotif');
  if (card) card.innerHTML = '';
  setTimeout(ddpLoadHomeNotif, 1200);
}
async function ddpDismissHomeNotif(notifId) {
  try {
    const fb = getFirebase();
    const db = fb && fb.db;
    if (db) await db.ref('notifications/' + notifId).update({ read: true, autoDismissed: true });
  } catch(e) {}
  if (typeof updateInboxBadge === 'function') updateInboxBadge();
  ddpLoadHomeNotif();
}
/* (v56) FOR ME features: Clear posts + notification badge (inbox jaisa) */
function ddpGetDismissedForMe() {
  try { return JSON.parse(localStorage.getItem('ddp_forMeDismissed') || '[]'); } catch(e) { return []; }
}
function ddpClearForMePosts() {
  if (!confirm('Clear all posts from For Me?')) return;
  try {
    const container = document.getElementById('main-content-area');
    const ids = [];
    /* (v150) Clear fix: pehle IDs [data-post-id] se dhoondte the, lekin card me wo attribute hai hi nahi (card ki id ddp_card_<postId> hoti hai) - is liye Clear dabane par kuch dismiss hi nahi hota tha. Ab loaded list + card ids dono se lo. */
    try { (window._forMePosts || []).forEach(function(p) { if (p && p.id) ids.push(p.id); }); } catch(e) {}
    if (container) {
      const cards = container.querySelectorAll('[data-post-id]');
      cards.forEach(function(c) { if (c.getAttribute('data-post-id')) ids.push(c.getAttribute('data-post-id')); });
      const cardDivs = container.querySelectorAll('[id^="ddp_card_"]');
      cardDivs.forEach(function(c) { const _cid = (c.id || '').replace('ddp_card_', ''); if (_cid) ids.push(_cid); });
    }
    const dismissed = ddpGetDismissedForMe();
    ids.forEach(function(id) { if (dismissed.indexOf(id) === -1) dismissed.push(id); });
    localStorage.setItem('ddp_forMeDismissed', JSON.stringify(dismissed));
    if (typeof loadForMeFeed === 'function') loadForMeFeed();
    if (typeof updateForMeBadge === 'function') updateForMeBadge();
  } catch(e) {}
}
const updateForMeBadge = (function() {
  let lastCount = -1;
  let timer = null;
  function _doUpdate() {
    if (!currentUserId) return;
    try {
      const { db } = getFirebase();
      if (!db) return;
      const lastVisit = parseInt(localStorage.getItem('ddp_forMeLastVisit') || '0', 10);
      const dismissed = ddpGetDismissedForMe();
      /* (v150) Badge fix: v149 me har follow ke liye wohi global query chalti thi aur gin-ti x4 ho jati thi (1 nayi post = +4). Ab AIK query: last visit ke baad ki posts, phir followed + dismissed + expired ka filter yahin. */
      const follows = (followedUsers || []).slice(0, 50);
      if (!follows.length) {
        if (lastCount === 0) return;
        lastCount = 0;
        const badge0 = document.getElementById('forMeBadge');
        if (badge0) { badge0.textContent = '0'; badge0.classList.add('hidden'); }
        return;
      }
      db.ref('posts').orderByChild('timestamp').startAt(lastVisit + 1).limitToLast(100).once('value').then(function(snap) {
        let count = 0;
        snap.forEach(function(c) {
          const p = c.val();
          if (!p || !p.user_id) return;
          if (follows.indexOf(p.user_id) === -1) return;
          if (dismissed.indexOf(c.key) !== -1) return;
          if (typeof isExpired === 'function' && isExpired(p)) return;
          count++;
        });
        if (count === lastCount) return;
        lastCount = count;
        const badge = document.getElementById('forMeBadge');
        if (badge) {
          badge.textContent = count > 0 ? '+' + count : '0';
          badge.classList.toggle('hidden', count === 0);
        }
      }).catch(function(){});
    } catch(e) {}
  }
  return function() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(_doUpdate, 300);
  };
})();
/* (v37) FOR ME me bhi Clear All — inbox jaisa */
async function ddpClearAllHomeNotif() {
  if (!confirm('Clear all notifications?')) return;
  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return;
  try {
    const snap = await db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value');
    const batch = {};
    snap.forEach(function(doc) { batch['notifications/' + doc.key] = null; });
    if (Object.keys(batch).length) await db.ref().update(batch);
  } catch(e) {}
  try { if (typeof stopNotifListener === 'function') stopNotifListener(); } catch(e) {}
  try { if (typeof updateInboxBadge === 'function') updateInboxBadge(); } catch(e) {}
  if (typeof ddpLoadHomeNotif === 'function') ddpLoadHomeNotif();
}
async function ddpHomeNotifClick(notifId, type, postId, mehfilId, fromUid, senderName) {
  try { await handleNotifClick(notifId, type, postId, mehfilId, fromUid, senderName); } catch(e) {}
  setTimeout(ddpLoadHomeNotif, 600);
}

async function loadTextFeed() {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;margin-top:40px;">Loading text posts...</p>';
  
  try {
    const cacheKey = 'text_' + ddpFeedTab + '_' + (ddpFeedCategory || 'all') + '_p' + ddpTextPage;
    const cached = getCachedFeed(cacheKey, ddpFeedTab === 'trending' ? 300000 : undefined); /* (v120) trending cache 5 min */
    if (cached) {
      container.innerHTML = ddpFeedChromeHTML('text') + cached;
      initLazyImages();
    if (typeof ddpRefreshStarsBg === 'function') ddpRefreshStarsBg();
      ddpLoadInlineReplies(ddpCollectCardIds());
      ddpLoadHomeNotif();
      return;
    }
    
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    let posts = [];
    if (ddpFeedTab === 'trending') {
      /* (v114) Trending ke liye gehra scan: tez posting me akhri 100 posts sirf
         ~1-2 ghante cover karte hain, is liye 5-like wali purani posts nazar nahi
         aati thin. Batch-wise (image feed jaisa) 200 text posts tak jama karo. */
      /* (v118) SPEED: pehle flag wali posts lo — agar ek page (DDP_PAGE_SIZE)
         se zyada mil jayen to bhari scan skip karo; warna scan top-up karega. */
      let _preFlagsT = [], _preFetchedT = false, _skipScanT = false;
      try {
        _preFlagsT = (await ddpFetchFlaggedTrending(db)).filter(function(p) { return p.text && !p.image_url; });
        _preFetchedT = true;
        if (_preFlagsT.length >= DDP_PAGE_SIZE) { posts = _preFlagsT.slice(); _skipScanT = true; }
      } catch(e) {}
      let lastTs = null;
      /* (v120) 1-batch scan: pehle batch ke 200 posts kaafi (index ke baad flag path bhi chalega) */
      for (let batch = 0; batch < 1 && posts.length < 200 && !_skipScanT; batch++) {
        let qq = db.ref('posts').orderByChild('timestamp');
        if (lastTs) qq = qq.endAt(lastTs - 1);
        const snap = await qq.limitToLast(200).once('value');
        if (!snap.exists()) break;
        let bp = [];
        snap.forEach(function(c) { const p = c.val(); p.id = c.key; bp.push(p); });
        if (bp.length === 0) break;
        bp.sort(function(a,b) { return (a.timestamp||0) - (b.timestamp||0); });
        lastTs = bp[0].timestamp;
        for (let i = 0; i < bp.length && posts.length < 200; i++) {
          if (bp[i].text && !bp[i].image_url && !isExpired(bp[i])) posts.push(bp[i]);
        }
        if (bp.length < 200) break;
      }
      /* (v117) Flag wali text posts bhi milao — khirki se bahar ki trending
         posts (7 din ke andar) bhi nazar aayen. */
      try {
        const _flaggedT = _preFetchedT ? _preFlagsT : await ddpFetchFlaggedTrending(db);
        const _seenT = {};
        posts.forEach(function(p) { _seenT[p.id] = true; });
        _flaggedT.forEach(function(p) { if (p.text && !p.image_url && !_seenT[p.id]) { posts.push(p); _seenT[p.id] = true; } });
      } catch(e) {}
    } else {
      const snap = await db.ref('posts').orderByChild('timestamp').limitToLast(100).once('value');
      snap.forEach(function(c) {
        const p = c.val();
        p.id = c.key;
        if (p.text && !p.image_url && !isExpired(p)) posts.push(p);
      });
    }
    
        if (ddpFeedCategory) { posts = posts.filter(function(p) { return (p.category || 'Random') === ddpFeedCategory; }); }
posts = ddpSortPosts(posts);
    /* (v117) Lazy backfill: scan se mili trending posts par flag lagao taake
       wo khirki se bahar hone ke baad bhi flag se nazar aayen. */
    try {
      posts.forEach(function(p) {
        if (!p.trending && ddpFeedTab === 'trending' && typeof ddpIsTrending === 'function' && ddpIsTrending(p) && !isExpired(p)) { try { db.ref('posts/' + p.id).update({ trending: true }); } catch(e) {} } /* (v121) backfill sirf trending tab + rule-check */
      });
    } catch(e) {}
    const _totalPagesT = Math.max(1, Math.ceil(posts.length / DDP_PAGE_SIZE));
    if (ddpTextPage > _totalPagesT) ddpTextPage = _totalPagesT;
    const _pagePostsT = posts.slice((ddpTextPage - 1) * DDP_PAGE_SIZE, ddpTextPage * DDP_PAGE_SIZE);
    posts = _pagePostsT;
    
    if (posts.length === 0) {
      container.innerHTML = ddpFeedChromeHTML('text') + '<p style="text-align:center;color:#666;">' + (ddpFeedCategory ? 'No ' + esc(ddpFeedCategory) + ' posts yet.' : 'No text posts yet.') + '</p>';
      ddpLoadHomeNotif();
      return;
    }
    
    const uids = [...new Set(posts.map(function(p) { return p.user_id; }).filter(Boolean))];
    const userData = await batchGetUsers(uids);

    /* (2026-10-02) Blocked users ki posts feed me na dikhao (dono taraf:
       jinhe maine block kiya, aur jinhon ne mujhe block kiya) */
    const myBlocked = await getMyBlockedList();
    posts = posts.filter(function(p) {
      if (!p.user_id) return true;
      if (myBlocked.indexOf(p.user_id) !== -1) return false;
      const ud = userData[p.user_id] || {};
      if ((ud.blockedUsers || []).indexOf(currentUserId) !== -1) return false;
      return true;
    });
    if (posts.length === 0) {
      container.innerHTML = ddpFeedChromeHTML('text') + '<p style="text-align:center;color:#666;">' + (ddpFeedCategory ? 'No ' + esc(ddpFeedCategory) + ' posts yet.' : 'No text posts yet.') + '</p>';
      ddpLoadHomeNotif();
      return;
    }

    const htmlParts = await Promise.all(
      posts.map(function(p) {
        return createPostCardHTML(p.id, 'text', p, userData[p.user_id] || {});
      })
    );
    const html = htmlParts.join('');
    
    const _pagerT = ddpPagerHTML('text', _totalPagesT);
    container.innerHTML = ddpFeedChromeHTML('text') + html + _pagerT;
    setCachedFeed(cacheKey, html + _pagerT);
    initLazyImages();
    ddpLoadInlineReplies(ddpCollectCardIds());
    ddpLoadHomeNotif();
    
  } catch(e) {
    container.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Error loading posts</p>';
  }
}

async function loadImageFeed() {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;margin-top:40px;">Loading image posts...</p>';
  
  try {
    const cacheKey = 'image_' + ddpFeedTab + '_' + (ddpFeedCategory || 'all') + '_p' + ddpImagePage;
    const cached = getCachedFeed(cacheKey, ddpFeedTab === 'trending' ? 300000 : undefined); /* (v120) trending cache 5 min */
    if (cached) {
      container.innerHTML = ddpFeedChromeHTML('image') + cached;
      initLazyImages();
    if (typeof ddpRefreshStarsBg === 'function') ddpRefreshStarsBg();
      ddpLoadInlineReplies(ddpCollectCardIds());
      ddpLoadHomeNotif();
      return;
    }
    
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    /* (v112) Fetch until 100 images found — home feed jitni visibility, koi 15 wali cap nahi */
    let posts = [];
    /* (v118) SPEED: TRENDING par pehle flag wali posts lo — ek page se zyada
       mil jayen to bhari scan skip; LATEST par koi tabdeeli nahi. */
    let _preFlagsI = [], _preFetchedI = false, _skipScanI = false;
    if (ddpFeedTab === 'trending') {
      try {
        _preFlagsI = (await ddpFetchFlaggedTrending(db)).filter(function(p) { return !!p.image_url; });
        _preFetchedI = true;
        if (_preFlagsI.length >= DDP_PAGE_SIZE) { posts = _preFlagsI.slice(); _skipScanI = true; }
      } catch(e) {}
    }
    let lastTs = null;
    const _maxBatchI = (ddpFeedTab === 'trending') ? 1 : 5; /* (v120) trending 1-batch */
    for (let batch = 0; batch < _maxBatchI && posts.length < 100 && !_skipScanI; batch++) {
      let qq = db.ref('posts').orderByChild('timestamp');
      if (lastTs) qq = qq.endAt(lastTs - 1);
      const snap = await qq.limitToLast(200).once('value');
      if (!snap.exists()) break;
      let bp = [];
      snap.forEach(function(c) { const p = c.val(); p.id = c.key; bp.push(p); });
      if (bp.length === 0) break;
      bp.sort(function(a,b) { return (a.timestamp||0) - (b.timestamp||0); });
      lastTs = bp[0].timestamp;
      for (let i = 0; i < bp.length && posts.length < 100; i++) {
        if (bp[i].image_url && !isExpired(bp[i])) posts.push(bp[i]);
      }
      if (bp.length < 200) break;
    }
    /* (v117) TRENDING tab: flag wali image posts bhi milao (khirki se bahar). */
    if (ddpFeedTab === 'trending') {
      try {
        const _flaggedI = _preFetchedI ? _preFlagsI : await ddpFetchFlaggedTrending(db);
        const _seenI = {};
        posts.forEach(function(p) { _seenI[p.id] = true; });
        _flaggedI.forEach(function(p) { if (p.image_url && !_seenI[p.id]) { posts.push(p); _seenI[p.id] = true; } });
      } catch(e) {}
    }
    
        if (ddpFeedCategory) { posts = posts.filter(function(p) { return (p.category || 'Random') === ddpFeedCategory; }); }
posts = ddpSortPosts(posts);
    /* (v117) Lazy backfill: scan se mili trending posts par flag lagao taake
       wo khirki se bahar hone ke baad bhi flag se nazar aayen. */
    try {
      posts.forEach(function(p) {
        if (!p.trending && ddpFeedTab === 'trending' && typeof ddpIsTrending === 'function' && ddpIsTrending(p) && !isExpired(p)) { try { db.ref('posts/' + p.id).update({ trending: true }); } catch(e) {} } /* (v121) backfill sirf trending tab + rule-check */
      });
    } catch(e) {}
    const _totalPagesI = Math.max(1, Math.ceil(posts.length / DDP_PAGE_SIZE));
    if (ddpImagePage > _totalPagesI) ddpImagePage = _totalPagesI;
    posts = posts.slice((ddpImagePage - 1) * DDP_PAGE_SIZE, ddpImagePage * DDP_PAGE_SIZE);
    
    if (posts.length === 0) {
      container.innerHTML = ddpFeedChromeHTML('image') + '<p style="text-align:center;color:#666;">' + (ddpFeedCategory ? 'No ' + esc(ddpFeedCategory) + ' posts yet.' : 'No image posts yet.') + '</p>';
      ddpLoadHomeNotif();
      return;
    }
    
    const uids = [...new Set(posts.map(function(p) { return p.user_id; }).filter(Boolean))];
    const userData = await batchGetUsers(uids);

    /* (2026-10-02) Blocked users ki posts feed me na dikhao (dono taraf:
       jinhe maine block kiya, aur jinhon ne mujhe block kiya) */
    const myBlocked = await getMyBlockedList();
    posts = posts.filter(function(p) {
      if (!p.user_id) return true;
      if (myBlocked.indexOf(p.user_id) !== -1) return false;
      const ud = userData[p.user_id] || {};
      if ((ud.blockedUsers || []).indexOf(currentUserId) !== -1) return false;
      return true;
    });
    if (posts.length === 0) {
      container.innerHTML = ddpFeedChromeHTML('image') + '<p style="text-align:center;color:#666;">' + (ddpFeedCategory ? 'No ' + esc(ddpFeedCategory) + ' posts yet.' : 'No image posts yet.') + '</p>';
      ddpLoadHomeNotif();
      return;
    }

    const htmlParts = await Promise.all(
      posts.map(function(p) {
        return createPostCardHTML(p.id, 'image', p, userData[p.user_id] || {});
      })
    );
    const html = htmlParts.join('');
    
    const _pagerI = ddpPagerHTML('image', _totalPagesI);
    container.innerHTML = ddpFeedChromeHTML('image') + html + _pagerI;
    setCachedFeed(cacheKey, html + _pagerI);
    initLazyImages();
    ddpLoadInlineReplies(ddpCollectCardIds());
    ddpLoadHomeNotif();
    
  } catch(e) {
    container.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Error loading posts</p>';
  }
}

async function loadForMeFeed() {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  try { localStorage.setItem('ddp_forMeLastVisit', String(Date.now())); } catch(e) {}
  if (typeof updateForMeBadge === 'function') updateForMeBadge();
  container.innerHTML = '<p style="text-align:center;margin-top:40px;">Loading posts from followed users...</p>';
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    /* (v149) For Me: har followed user ki posts alag query se - pehle sirf aakhri 100 posts scan hote the, is liye followed users ki aaj ki post bhi ghayab ho jati thi. user_id par index hai (rules v47), is liye per-user query sasti hai. Har user ki taaza tareen 100 (live posts is se zyada hoti hi nahi: text 30 din me expire). */
    const _follows = (followedUsers || []).slice(0, 50);
    const _snaps = await Promise.all(_follows.map(function(uid) {
      return db.ref('posts').orderByChild('user_id').equalTo(uid).limitToLast(100).once('value').catch(function() { return null; });
    }));
    let posts = [];
    _snaps.forEach(function(snap) {
      if (!snap) return;
      snap.forEach(function(c) {
        const p = c.val();
        p.id = c.key;
        if (!isExpired(p)) posts.push(p);
      });
    });
    
    posts.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    /* (v56) Filter dismissed (cleared) posts */
    try {
      const dismissed = ddpGetDismissedForMe();
      if (dismissed.length) posts = posts.filter(function(p) { return dismissed.indexOf(p.id) === -1; });
    } catch(e) {}
    
    if (posts.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#666;">No posts from followed users.</p>';
      return;
    }
    /* (v56) Clear button header */
    const _clearBtn = '<div style="text-align:right;padding:8px 12px;"><button onclick="ddpClearForMePosts()" style="background:#ef4444;color:#fff;border:none;border-radius:20px;padding:6px 16px;font-size:13px;cursor:pointer;">🗑️ Clear</button></div>';
    
    const uids = [...new Set(posts.map(function(p) { return p.user_id; }).filter(Boolean))];
    const userData = await batchGetUsers(uids);

    /* (2026-10-02) Blocked users ki posts feed me na dikhao (dono taraf) */
    const myBlocked = await getMyBlockedList();
    posts = posts.filter(function(p) {
      if (!p.user_id) return true;
      if (myBlocked.indexOf(p.user_id) !== -1) return false;
      const ud = userData[p.user_id] || {};
      if ((ud.blockedUsers || []).indexOf(currentUserId) !== -1) return false;
      return true;
    });

    /* (v149) Pagination: pehle 20 dikhao, baqi 'Aur dikhao' se - DOM halka rehta hai, tamam posts phir bhi mil jati hain. */
    window._forMePosts = posts;
    window._forMeUserData = userData;
    window._forMeShown = 0;
    const firstBatch = posts.slice(0, 20);
    const htmlParts = await Promise.all(
      firstBatch.map(function(p) {
        return createPostCardHTML(p.id, p.image_url ? 'image' : 'text', p, userData[p.user_id] || {});
      })
    );
    window._forMeShown = firstBatch.length;
    let _moreBtn = '';
    if (posts.length > firstBatch.length) {
      _moreBtn = '<div style="text-align:center;padding:12px;"><button id="forMeMoreBtn" onclick="ddpForMeShowMore()" style="background:#2563eb;color:#fff;border:none;border-radius:20px;padding:8px 20px;font-size:14px;cursor:pointer;">\u2795 Aur posts dikhao (' + (posts.length - firstBatch.length) + ' baqi)</button></div>';
    }
    container.innerHTML = _clearBtn + htmlParts.join('') + _moreBtn;
    initLazyImages();
    ddpLoadInlineReplies(ddpCollectCardIds());
    
  } catch(e) {
    container.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Error loading posts</p>';
  }
}

/* (v149) For Me pagination: agle 20 posts dikhao. */
async function ddpForMeShowMore() {
  try {
    const container = document.getElementById('main-content-area');
    if (!container || !window._forMePosts) return;
    const posts = window._forMePosts, userData = window._forMeUserData || {};
    const shown = window._forMeShown || 0;
    const next = posts.slice(shown, shown + 20);
    if (!next.length) return;
    const htmlParts = await Promise.all(next.map(function(p) {
      return createPostCardHTML(p.id, p.image_url ? 'image' : 'text', p, userData[p.user_id] || {});
    }));
    const btn = document.getElementById('forMeMoreBtn');
    if (btn) btn.remove();
    container.insertAdjacentHTML('beforeend', htmlParts.join(''));
    window._forMeShown = shown + next.length;
    const remaining = posts.length - window._forMeShown;
    if (remaining > 0) {
      container.insertAdjacentHTML('beforeend', '<div style="text-align:center;padding:12px;"><button id="forMeMoreBtn" onclick="ddpForMeShowMore()" style="background:#2563eb;color:#fff;border:none;border-radius:20px;padding:8px 20px;font-size:14px;cursor:pointer;">\u2795 Aur posts dikhao (' + remaining + ' baqi)</button></div>');
    }
    initLazyImages();
    ddpLoadInlineReplies(ddpCollectCardIds());
  } catch(e) {}
}

/* ===== CREATE POST CARD HTML ===== */

/* ===== POST CARD — damadam.pk replica design, real data ===== */
async function createPostCardHTML(postId, type, d, userObj) {
  const uid = d.user_id || '';
  const nickname = d.username || 'user';
  const text = (d.text || d.caption || '').substring(0, 750);
  const imageUrl = safeUrl(d.image_url);
  const createdAt = d.timestamp ? timeAgo(new Date(d.timestamp)) : '';
  const replyCount = d.comment_count || 0;
  const isOwnPost = (uid === currentUserId);
  const userDp = ddpThumbUrl(safeUrl(userObj ? userObj.profilePic : await getUserDp(uid)), 100);
  const hasLiked = !!(d.likes && d.likes[currentUserId]);
  const isUrdu = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

  let html = '<div class="ddp-post-card' + '" id="ddp_card_' + postId + '">';

  if (isOwnPost) {
    html += '<div class="ddp-hide-wrap"><button class="ddp-hide-btn" onclick="event.stopPropagation();deletePost(\'' + postId + '\')">🗑 Hide</button></div>';
  }

  /* header */
  html += '<div class="post-header"><div class="post-user-info">';
  if (userDp) {
    html += '<img src="' + userDp + '" class="user-avatar-sm" style="object-fit:cover;" onclick="event.stopPropagation();goToUserProfile(\'' + uid + '\')" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"/>';
    html += '<div class="user-avatar-sm" style="display:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);" onclick="event.stopPropagation();goToUserProfile(\'' + uid + '\')">' + esc(nickname).charAt(0).toUpperCase() + '</div>';
  } else {
    html += '<div class="user-avatar-sm" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);" onclick="event.stopPropagation();goToUserProfile(\'' + uid + '\')">' + esc(nickname).charAt(0).toUpperCase() + '</div>';
  }
  html += '<span class="username-bold" data-uid="' + uid + '" onclick="event.stopPropagation();goToUserProfile(\'' + uid + '\')">' + esc(nickname) + redStarHTML(userObj, uid) + '</span>';
  html += '<span class="post-time">- ' + createdAt + '</span>';
  html += '</div>';
  if (d.expiryTime) html += '<span class="time-icon" title="Expires">🕐</span>';
  html += '</div>';

  /* body */
  if (imageUrl) {
    html += '<img data-src="' + ddpThumbUrl(imageUrl, 800) + '" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\' viewBox=\'0 0 400 300\'%3E%3Crect fill=\'%23f0f0f0\' width=\'400\' height=\'300\'/%3E%3C/svg%3E" class="post-image lazy-img" onclick="event.stopPropagation();showFullImage(\'' + imageUrl + '\')" onerror="this.style.display=\'none\'"/>';
  }
  if (text) {
    html += '<div class="' + (isUrdu ? 'post-body-urdu' : 'post-body-ltr') + '" onclick="showFullPost(\'' + postId + '\',\'' + type + '\')">' + ddpEmojify(esc(text)) + '</div>';
  }

  /* 5 action boxes */
  html += '<div class="post-actions-row">';
  if (isOwnPost) {
    html += '<div class="action-box follow disabled"><span class="icon">👥</span><span>YOU</span></div>';
  } else {
    const isF = (typeof followedUsers !== 'undefined') && followedUsers.indexOf(uid) !== -1;
    const isReq = !isF && (typeof _pendingFollowReqs !== 'undefined') && _pendingFollowReqs.indexOf(uid) !== -1;
    html += '<div class="action-box follow" onclick="event.stopPropagation();toggleFollow(\'' + uid + '\')"><span class="icon">👥</span><span>' + (isF ? 'FOLLOWING' : (isReq ? 'REQUESTED' : 'FOLLOW')) + '</span></div>';
  }
  if (isOwnPost || currentView === 'profile') { /* (v131) profile par likes band */
    html += '<div class="action-box like disabled"><span class="icon">❤️</span><span>LIKE</span></div>';
  } else {
    html += '<div class="action-box like ddp-like-box' + (hasLiked ? ' liked' : '') + '" data-post-id="' + postId + '" onclick="event.stopPropagation();handleLike(\'' + postId + '\',\'' + type + '\')"><span class="icon">❤️</span><span class="like-label">' + (hasLiked ? 'LIKED' : 'LIKE') + '</span></div>';
  }
  if (isOwnPost) {
    html += '<div class="action-box oneonone disabled"><span class="icon">💬</span><span>YOU</span></div>';
  } else {
    html += '<div class="action-box oneonone" onclick="event.stopPropagation();startChatWith(\'' + uid + '\')"><span class="icon">💬</span><span>1 ON 1</span></div>';
  }
  html += '<div class="action-box replies" onclick="showFullPost(\'' + postId + '\',\'' + type + '\')"><span class="reply-count">' + replyCount + '</span><span>REPLIES</span></div>';
  if (isOwnPost) {
    html += '<div class="action-box report disabled"><span class="icon">⚠️</span><span>REPORT</span></div>';
  } else {
    html += '<div class="action-box report" onclick="event.stopPropagation();reportPost(\'' + postId + '\')"><span class="icon">⚠️</span><span>REPORT</span></div>';
  }
  html += '</div>';

  /* reply bar — (v27) post repliesOff = koi reply nahi; replyRestriction = sirf followers */
  const _ownerRepliesOff = (d.repliesOff && uid !== currentUserId);
  const replyLocked = (d.replyRestriction && uid !== currentUserId && (typeof followedUsers === 'undefined' || followedUsers.indexOf(uid) === -1));
  if (_ownerRepliesOff) {
    html += '<div class="ddp-locked-bar"><span style="font-size:12px;color:#888;">💬 Replies Off</span></div>';
  } else if (replyLocked) {
    html += '<div class="ddp-locked-bar"><span style="font-size:12px;color:#888;">🔒 Only followers can reply</span></div>';
  } else {
    html += '<div class="reply-input-bar"><input id="replyInput_' + postId + '" placeholder="Reply likhein.." maxlength="300" onclick="event.stopPropagation()"/><button onclick="event.stopPropagation();submitReply(\'' + postId + '\',\'' + type + '\')">reply</button></div>';
  }

  /* inline replies — filled by ddpLoadInlineReplies after render */
  html += '<div class="replies-list" id="ddp_replies_' + postId + '"></div>';

  html += '</div>';
  return html;
}

/* ===== INLINE REPLIES (damadam.pk style, last 3 per card) ===== */
function ddpCollectCardIds() {
  const els = document.querySelectorAll('[id^="ddp_replies_"]');
  const ids = [];
  for (let i = 0; i < els.length; i++) ids.push(els[i].id.substring(12));
  return ids;
}
async function ddpLoadInlineReplies(postIds) {
  if (!postIds || postIds.length === 0) return;
  // SPEED: block list once (not per post), first 12 now, rest lazy on scroll
  let myBlocked = [];
  try { myBlocked = await getMyBlockedList(); } catch(e) {}
  const first = postIds.slice(0, 12);
  const rest = postIds.slice(12);
  const jobs = [];
  for (let i = 0; i < first.length; i++) jobs.push(ddpRefreshCardReplies(first[i], myBlocked));
  await Promise.all(jobs);
  if (rest.length === 0) return;
  if ('IntersectionObserver' in window) {
    try {
      const obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(e) {
          if (e.isIntersecting) {
            const pid = e.target.id.substring(12);
            ddpRefreshCardReplies(pid, myBlocked);
            obs.unobserve(e.target);
          }
        });
      }, { rootMargin: '300px' });
      rest.forEach(function(id) {
        const el = document.getElementById('ddp_replies_' + id);
        if (el) obs.observe(el);
      });
      return;
    } catch(e) {}
  }
  // fallback: staggered background load
  rest.forEach(function(id, idx) {
    setTimeout(function() { ddpRefreshCardReplies(id, myBlocked); }, 2500 + idx * 300);
  });
}
async function ddpRefreshCardReplies(postId, myBlocked) {
  const box = document.getElementById('ddp_replies_' + postId);
  if (!box) return;
  if (box.getAttribute('data-loaded') === '1') return;
  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return;
  if (!myBlocked) { try { myBlocked = await getMyBlockedList(); } catch(e) { myBlocked = []; } }
  try {
    const snap = await db.ref('posts/' + postId + '/comments').orderByChild('timestamp').limitToLast(3).once('value');
    const cmts = [];
    snap.forEach(function(c) {
      const m = c.val();
      if (!m || m.deleted) return;
      if (m.uid && myBlocked.indexOf(m.uid) !== -1) return;
      m.id = c.key;
      cmts.push(m);
    });
    cmts.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    if (!document.getElementById('ddp_replies_' + postId)) return;
    let h = '';
    for (let i = 0; i < cmts.length; i++) h += ddpReplyItemHTML(postId, cmts[i]);
    box.innerHTML = h;
    box.setAttribute('data-loaded', '1');
  } catch(e) { /* leave empty on error */ }
}
function ddpReplyItemHTML(postId, cmt) {
  const ruid = cmt.uid || '';
  const uname = cmt.username || 'user';
  const isOwn = (ruid === currentUserId);
  const timeText = cmt.timestamp ? timeAgo(new Date(cmt.timestamp)) : '';
  let h = '<div class="ddp-fitem">';
  h += '<div class="ddp-msg-line">'; 
  h += '<span class="ddp-msg-user" data-uid="' + ruid + '" onclick="event.stopPropagation();goToUserProfile(\'' + ruid + '\')">' + esc(uname) + redStarHTMLByUid(ruid) + '</span>';
  h += '<span class="ddp-msg-text">' + ddpEmojify(esc(cmt.text || '')) + '</span>';
  h += '<span class="ddp-msg-time">' + timeText + '</span></div>';
  if (cmt.quotedUsername) {
    const q = (cmt.quotedText || '');
    if (q.length > 60) {
      h += '<div class="ddp-quote"><span class="ddp-q-short">➔ to ' + esc(cmt.quotedUsername) + ': ' + esc(q.substring(0, 60)) + '...</span><span class="ddp-q-full" style="display:none;">➔ to ' + esc(cmt.quotedUsername) + ': ' + esc(q) + '</span> <button class="ddp-more-btn" onclick="event.stopPropagation();ddpToggleQuote(this)">MORE▼</button></div>';
    } else {
      h += '<div class="ddp-quote">➔ to ' + esc(cmt.quotedUsername) + ': ' + esc(q) + '</div>';
    }
  } else {
    h += '<div class="ddp-quote">➔ to main post</div>';
  }
  h += '<div class="ddp-msg-actions">';
  h += '<button onclick="event.stopPropagation();ddpToggleNestedReply(\'' + postId + '\',\'' + cmt.id + '\')">↩ Reply</button>';
  if (!isOwn && ruid) {
    h += '<button onclick="event.stopPropagation();startChatWith(\'' + ruid + '\')">💬 1on1</button>';
    h += '<button onclick="event.stopPropagation();blockUserProfile(\'' + ruid + '\')">🚫 Block</button>';
  }
  h += '</div>';
  h += '<div class="ddp-nested-box" id="ddp_nested_' + postId + '_' + cmt.id + '" style="display:none;">';
  h += '<input id="ddp_nested_input_' + postId + '_' + cmt.id + '" placeholder="Reply likhein.." maxlength="300" onclick="event.stopPropagation()"/>';
  h += '<button onclick="event.stopPropagation();ddpSubmitNestedReply(\'' + postId + '\',\'' + cmt.id + '\')">reply</button>';
  h += '</div></div>';
  return h;
}
function ddpToggleNestedReply(postId, commentId) {
  const box = document.getElementById('ddp_nested_' + postId + '_' + commentId);
  if (!box) return;
  const show = (box.style.display === 'none' || !box.style.display);
  box.style.display = show ? 'flex' : 'none';
  if (show) {
    const inp = document.getElementById('ddp_nested_input_' + postId + '_' + commentId);
    if (inp) setTimeout(function() { inp.focus(); }, 50);
  }
}
async function ddpSubmitNestedReply(postId, parentCommentId) {
  const input = document.getElementById('ddp_nested_input_' + postId + '_' + parentCommentId);
  const text = input ? input.value.trim() : '';
  if (!text) return;
  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return;
  try {
    const ownerSnap = await db.ref('posts/' + postId + '/user_id').once('value');
    const ownerUid = ownerSnap.val();
    if (ownerUid && ownerUid !== currentUserId && await isBlockedBetween(currentUserId, ownerUid)) {
      alert('🚫 Is user ke sath interaction blocked hai.');
      return;
    }
    /* (v27) Post par replies off hon to block */
    try {
      const _roPost = await db.ref('posts/' + postId + '/repliesOff').once('value');
      if (_roPost.val()) { alert('💬 Is post par replies off hain.'); return; }
    } catch(e) {}
  } catch(e) {}
  let qt = '', qu = '', qu_id = '';
  try {
    const qd = await db.ref('posts/' + postId + '/comments/' + parentCommentId).once('value');
    if (qd.exists()) { const q = qd.val(); if (q) { qt = q.text || ''; qu = q.username || 'user'; qu_id = q.uid || ''; } }
  } catch(e) {}
  await db.ref('posts/' + postId + '/comments').push({
    uid: currentUserId,
    username: safeUser().username,
    text: text,
    in_reply_to: parentCommentId,
    quotedText: qt,
    quotedUsername: qu,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  await incCommentCount(db, postId);
  if (input) input.value = '';
  /* (v125) nested reply: sirf parent comment author + @mentions ko notify karo — post owner ko nahi (parent author owner ho to use parent wali notification milegi) */
  try {
    const _skip = {};
    _skip[currentUserId] = true;
    if (qu_id && qu_id !== currentUserId && !(await isBlockedBetween(currentUserId, qu_id))) {
      _skip[qu_id] = true;
      await db.ref('notifications').push({
        toUid: qu_id, fromUid: currentUserId,
        sender_name: safeUser().username, type: 'reply',
        message: safeUser().username + ' replied to your comment',
        postId: postId, replyPreview: text.substring(0, 100),
        timestamp: Date.now(), read: false
      });
    }
    await ddpNotifyMentionedUsers(db, text, { postId: postId, type: 'reply', context: ' in a reply', skipUid: _skip });
    updateInboxBadge();
  } catch(e) {}
  ddpRefreshCardReplies(postId);
  ddpBumpReplyCount(postId, 1);
}
function ddpBumpReplyCount(postId, delta) {
  const card = document.getElementById('ddp_card_' + postId);
  if (!card) return;
  const el = card.querySelector('.reply-count');
  if (el) el.innerText = String(Math.max(0, parseInt(el.innerText || '0', 10) + delta));
}

/* ===== LAZY IMAGE LOADING ===== */
function initLazyImages() {
  if (!('IntersectionObserver' in window)) {
    const imgs = document.querySelectorAll('img[data-src]');
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].dataset.src) {
        imgs[i].src = imgs[i].dataset.src;
        imgs[i].removeAttribute('data-src');
      }
    }
    return;
  }
  
  /* (2026-10-12) AUDIT 3.1: observer ko reuse karo — har render par rebuild mehenga hai. */
  if (!window._lazyObserver) {
  window._lazyObserver = new IntersectionObserver(function(entries, observer) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          img.style.background = 'none';
        }
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '100px' });
  }
  
  const imgs = document.querySelectorAll('img[data-src]');
  for (let j = 0; j < imgs.length; j++) {
    window._lazyObserver.observe(imgs[j]);
  }
}

function showFullImage(url) {
  const lb = document.createElement('div');
  lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
  lb.onclick = function() { window._imageLightbox = null; lb.remove(); };
  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'max-width:95vw;max-height:95vh;object-fit:contain;';
  lb.appendChild(img);
  document.body.appendChild(lb);
  window._imageLightbox = lb; /* Stage 4: track so Escape can close it */
}


/* ===== v147 block (orig theme lines 3706-4229) ===== */

/* ===== FAST LIKE HANDLER ===== */
async function handleLike(postId, type) {
  if (!currentUserId) return;
  if (currentView === 'profile') return; /* (v131) profile par likes band — spam rokne ke liye */
  
  const { db } = getFirebase();
  if (db) {
    const postSnap = await db.ref('posts/' + postId + '/user_id').once('value');
    if (postSnap.val() === currentUserId) { alert('Apni post ko like nahi kar sakte!'); return; }
  }
  
  
  const likeBox = document.querySelector('.ddp-like-box[data-post-id="' + postId + '"]');
  const likeLabel = likeBox ? likeBox.querySelector('.like-label') : null;
  let isCurrentlyLiked = likeBox ? likeBox.classList.contains('liked') : false;


  if (isCurrentlyLiked) {
    if (likeBox) likeBox.classList.remove('liked');
    if (likeLabel) likeLabel.innerText = 'LIKE';
  } else {
    if (likeBox) likeBox.classList.add('liked');
    if (likeLabel) likeLabel.innerText = 'LIKED';
  }
  
  try {
    const { db } = getFirebase();
    if (!db) return;
    
    const postRef = db.ref('posts/' + postId);

    /* (2026-10-10) Counter-drift fix: toggle se pehle DB se asal like-state parho.
       DOM ka 'liked' class stale ho sakta hai (cache/refresh), jis se owner ka
       total-likes counter ghalat barhta/ghat-ta tha. */
    let wasLikedInDb = isCurrentlyLiked;
    try {
      const beforeSnap = await postRef.once('value');
      const bv = beforeSnap.val() || {};
      wasLikedInDb = !!(bv.likes && bv.likes[currentUserId]);
    } catch(e) {}

    await postRef.transaction(post => {
      if (!post) return post;
      
      const likes = post.likes || {};
      let likeCountVal = post.likeCount || 0;
      let changed = false;
      
      if (likes[currentUserId]) {
        delete likes[currentUserId];
        likeCountVal = Math.max(0, likeCountVal - 1);
        changed = true;
      } else {
        likes[currentUserId] = true;
        likeCountVal = (likeCountVal || 0) + 1;
        changed = true;
      }
      
      if (!changed) return post;
      
      return {
        ...post,
        likes: likes,
        likeCount: likeCountVal
      };
    });
    
    const updatedSnap = await postRef.once('value');
    const updatedPost = updatedSnap.val();
    const isNowLiked = updatedPost?.likes?.[currentUserId] || false;
    /* self-heal: likeCount counter must equal real likes-object size */
    try {
      const _real = (updatedPost && updatedPost.likes && typeof updatedPost.likes === 'object') ? Object.keys(updatedPost.likes).length : 0;
      if (updatedPost && (updatedPost.likeCount || 0) !== _real) {
        await postRef.update({ likeCount: _real });
      }
    } catch(e) {}
    /* (v117) TRENDING SAVE: like/unlike ke baad flag update karo — post rule
       par poora utre to flag lagao, warna hatao. posts/$postId par ".write":
       "auth != null" hai, is liye koi rules publish nahi chahiye. Sirf tab
       likho jab flag badal raha ho (har like par extra write nahi). */
    try {
      if (updatedPost) {
        const _wantTrend = (typeof ddpIsTrending === 'function' && ddpIsTrending(updatedPost) && !isExpired(updatedPost));
        if (!!updatedPost.trending !== _wantTrend) {
          await postRef.update({ trending: _wantTrend ? true : null });
        }
      }
    } catch(e) {}

    /* (2026-10-10) RULE: profile Total likes KABHI kam nahi hote — sirf NAYE like par +1.
       Unlike, delete ya expire par kabhi minus nahi. wasLikedInDb DB se parha jata hai
       taake stale screen par ghalat double-count na ho. */
    const ownerUid = updatedPost?.user_id;
    if (ownerUid && ownerUid !== currentUserId && isNowLiked && !wasLikedInDb) {
      try {
        await db.ref('users/' + ownerUid + '/likes').transaction(v => (v || 0) + 1);
        /* (v71) WEEKLY STARS FIX: persistent counter — post delete/expire/200-window se weekly likes kabhi kam nahi honge. 3-cap: 1 liker ke sirf 3 likes/week/owner. */
        try {
          const _wId71 = (typeof getWeekId === 'function') ? getWeekId() : null;
          if (_wId71) {
            const _capKey71 = _wId71 + '_' + currentUserId + '_' + ownerUid;
            const _capSnap71 = await db.ref('likeCaps/' + _capKey71).once('value');
            const _capN71 = _capSnap71.val() || 0;
            if (_capN71 < 3) {
              await db.ref('likeCaps/' + _capKey71).set(_capN71 + 1);
              await db.ref('stars/weekly/' + _wId71 + '/board/' + ownerUid).transaction(function(v){ return (v || 0) + 1; });
            }
          }
        } catch(_e71) { console.warn('Weekly counter failed:', _e71.message); }
      } catch (e) { console.error('Owner total-likes sync failed:', e); }
    }
    
    if (isNowLiked && updatedPost?.user_id && updatedPost.user_id !== currentUserId) {
      const alreadyNotified = await checkExistingNotif(updatedPost.user_id, postId, 'like');
      if (!alreadyNotified) {
        await db.ref('notifications').push({
          toUid: updatedPost.user_id,
          fromUid: currentUserId,
          sender_name: safeUser().username,
          type: 'like',
          message: safeUser().username + ' ❤️ liked your post',
          postId: postId,
          postPreview: (updatedPost.text || updatedPost.caption || '').substring(0, 80),
          timestamp: Date.now(),
          read: false
        });
        updateInboxBadge();
      }
    }
    
  } catch(e) {
    console.error('Like error:', e);
    /* revert optimistic UI toggle */
    if (likeBox) likeBox.classList.toggle('liked', isCurrentlyLiked);
    if (likeLabel) likeLabel.innerText = isCurrentlyLiked ? 'LIKED' : 'LIKE';
  }
}

async function checkExistingNotif(toUid, postId, type) {
  /* (v142) Rules v45: notifications ki list sirf apni query se parhi ja sakti hai
     (toUid==me ya fromUid==me) — is liye dedupe apni bheji hui notifs me dhoondho */
  const { db } = getFirebase();
  if (!db) return false;
  try {
    const snap = await db.ref('notifications').orderByChild('fromUid').equalTo(currentUserId).limitToLast(100).once('value');
    let exists = false;
    snap.forEach(function(doc) {
      const n = doc.val();
      if (n.toUid === toUid && n.postId === postId && n.type === type) {
        if (Date.now() - (n.timestamp || 0) < 3600000) {
          exists = true;
        }
      }
    });
    return exists;
  } catch(e) { return false; }
}

/* ===== ENHANCED FOLLOW HANDLER ===== */
async function toggleFollow(uid) {
  if (!currentUserId || uid === currentUserId) return;
  
  try {
    if (!RateLimiter.canPerform('follows', 30)) return;
    
    const { db } = getFirebase();
    if (!db) return;
    const ref = db.ref('users/' + currentUserId + '/following/' + uid);
    const snap = await ref.once('value');
    
    if (snap.exists()) {
      await ref.remove();
      followedUsers = followedUsers.filter(function(u) { return u !== uid; });
      await db.ref('followers/' + uid + '/' + currentUserId).remove();
      await db.ref('following/' + currentUserId + '/' + uid).remove();
      await db.ref('users/' + uid + '/followers').transaction(function(c) { return Math.max(0, (c || 1) - 1); });
      await db.ref('users/' + uid + '/verifiedFollowers').transaction(function(c) { return Math.max(0, (c || 1) - 1); });
      await autoDismissFollowNotification(uid);
    } else {
      /* Follow approval: agar target ne ON kiya hai to request bhejo */
      let needApproval = false;
      try {
        const apSnap = await db.ref('users/' + uid + '/followApproval').once('value');
        needApproval = !!apSnap.val();
      } catch(e) {}
      const reqRef = db.ref('followRequests/' + uid + '/' + currentUserId);
      const reqSnap = await reqRef.once('value');
      if (reqSnap.exists()) {
        await reqRef.remove();
        await db.ref('users/' + currentUserId + '/outgoingReqs/' + uid).remove();
        _pendingFollowReqs = _pendingFollowReqs.filter(function(x) { return x !== uid; });
        await loadFollowedUsers();
        try { updateForMeBadge(); } catch(e){}
        if (currentView === 'profile' && _profileUid) loadProfile(_profileUid);
        return;
      }
      if (needApproval) {
        const nowReq = Date.now();
        try {
          await reqRef.set({ uid: currentUserId, username: safeUser().username, timestamp: nowReq });
        } catch(_re) {
          alert('⚠️ Follow request nahi bheji ja saki. Firebase Rules v24 publish karein phir try karein.');
          return;
        }
        await db.ref('users/' + currentUserId + '/outgoingReqs/' + uid).set({ timestamp: nowReq });
        if (_pendingFollowReqs.indexOf(uid) === -1) _pendingFollowReqs.push(uid);
        try {
          await db.ref('notifications').push({
            toUid: uid, fromUid: currentUserId,
            sender_name: safeUser().username, type: 'follow_request',
            message: safeUser().username + ' wants to follow you 📩',
            timestamp: nowReq, read: false
          });
          updateInboxBadge();
        } catch(e) {}
        await loadFollowedUsers();
        try { updateForMeBadge(); } catch(e){}
        if (currentView === 'profile' && _profileUid) loadProfile(_profileUid);
        return;
      }
      await ref.set({ uid: uid, addedAt: Date.now() });
      followedUsers.push(uid);
      await db.ref('followers/' + uid + '/' + currentUserId).set({ uid: currentUserId, timestamp: Date.now() });
      await db.ref('following/' + currentUserId + '/' + uid).set({ uid: uid, timestamp: Date.now() });
      await db.ref('users/' + uid + '/followers').transaction(function(c) { return (c || 0) + 1; });
      await db.ref('users/' + uid + '/verifiedFollowers').transaction(function(c) { return (c || 0) + 1; });
      
      const alreadyNotified = await checkExistingNotif(uid, null, 'follow');
      if (!alreadyNotified) {
        await db.ref('notifications').push({
          toUid: uid,
          fromUid: currentUserId,
          sender_name: safeUser().username,
          type: 'follow',
          message: safeUser().username + ' started following you 👥',
          timestamp: Date.now(),
          read: false
        });
        updateInboxBadge();
      }
    }
    
    await loadFollowedUsers();
    try { updateForMeBadge(); } catch(e){}
    if (currentView === 'forme') loadForMeFeed();
    if (currentView === 'profile' && _profileUid) loadProfile(_profileUid);
    
  } catch(e) {
    console.error('Follow error:', e);
  }
}

async function autoDismissFollowNotification(uid) {
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value');
  const batch = {};
  snap.forEach(function(doc) {
    const n = doc.val();
    if (n.fromUid === uid && n.type === 'follow') {
      batch['notifications/' + doc.key] = null;
    }
  });
  if (Object.keys(batch).length > 0) {
    await db.ref().update(batch);
    updateInboxBadge();
  }
}

/* ===== REPLY SUBMISSION ===== */
async function submitReply(postId, type) {
  const input = document.getElementById('replyInput_' + postId);
  const text = input ? input.value.trim() : '';
  if (!text) return;
  
  const { db } = getFirebase();
  if (!db) return;
  const postSnap = await db.ref('posts/' + postId).once('value');
  const pd = postSnap.val();

  /* (2026-10-02) Block check: post owner se block ho to comment na karo */
  if (pd && pd.user_id && pd.user_id !== currentUserId && await isBlockedBetween(currentUserId, pd.user_id)) {
    alert('🚫 Is user ke sath interaction blocked hai.');
    return;
  }

  if (pd.replyRestriction && pd.user_id !== currentUserId && followedUsers.indexOf(pd.user_id) === -1) {
    alert('Replies Off');
    return;
  }

  /* (v27) Post par replies off hon to block (koi reply nahi) */
  if (pd && pd.repliesOff && pd.user_id !== currentUserId) {
    alert('💬 Is post par replies off hain.');
    return;
  }
  
  await db.ref('posts/' + postId + '/comments').push({
    uid: currentUserId,
    username: safeUser().username,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  
  await incCommentCount(db, postId);
  if (input) input.value = '';
  
  await autoDismissPostNotifications(postId, pd.user_id);
  
  const _skipM = {};
  _skipM[currentUserId] = true;
  if (pd.user_id && pd.user_id !== currentUserId) {
    _skipM[pd.user_id] = true;
    await db.ref('notifications').push({
      toUid: pd.user_id,
      fromUid: currentUserId,
      sender_name: safeUser().username,
      type: 'comment',
      message: safeUser().username + ' replied to your post',
      postId: postId,
      postPreview: (pd.text || pd.caption || '').substring(0, 80),
      replyPreview: text,
      timestamp: Date.now(),
      read: false
    });
    updateInboxBadge();
  }
  /* (v24) @mentions in reply text */
  await ddpNotifyMentionedUsers(db, text, { postId: postId, type: 'reply', context: ' in a reply', postPreview: (pd.text || pd.caption || '').substring(0, 80), skipUid: _skipM });
  
  ddpRefreshCardReplies(postId);
  ddpBumpReplyCount(postId, 1);
}

/* (v24) post par reply karne par purani notifications DELETE nahi — sirf read mark (history bani rahe) */
async function autoDismissPostNotifications(postId, postOwnerUid) {
  if (!currentUserId) return;
  const { db } = getFirebase();
  if (!db) return;
  try {
    const snap = await db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value');
    const batch = {};
    snap.forEach(function(doc) {
      const n = doc.val();
      if (n.postId === postId && n.fromUid === postOwnerUid && !n.read) {
        batch['notifications/' + doc.key + '/read'] = true;
      }
    });
    if (Object.keys(batch).length > 0) {
      await db.ref().update(batch);
      updateInboxBadge();
    }
  } catch(e) {}
}

async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  const { db } = getFirebase();
  if (!db) return;
  /* (2026-10-10) RULE: profile Total likes KABHI kam nahi hote — post delete par minus NAHI karna. */
  await db.ref('posts/' + postId).remove();
  clearPostCache();
  if (currentView === 'home') {
    if (currentTab === 'text') loadTextFeed();
    else loadImageFeed();
  } else if (currentView === 'profile') {
    setTimeout(function() { loadProfile(currentUserId); }, 500);
  }
}

/* ===== REPORT HANDLER ===== */
function reportPost(postId) {
  const reportReasons = ['Spam', 'Inappropriate Content', 'Harassment', 'False Information', 'Copyright Violation', 'Other'];
  
  let dialogHTML = '<div style="background:#fff;padding:20px;border-radius:12px;max-width:350px;width:90%;"><h4 style="margin-bottom:12px;">📢 Report Post</h4><p style="font-size:13px;color:#666;margin-bottom:12px;">Why are you reporting this?</p>';
  
  for (let i = 0; i < reportReasons.length; i++) {
    dialogHTML += '<button onclick="submitReport(\'' + postId + '\', \'' + reportReasons[i] + '\')" style="display:block;width:100%;margin:5px 0;padding:10px;background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer;text-align:left;font-size:14px;">' + reportReasons[i] + '</button>';
  }
  
  dialogHTML += '<button onclick="closeReportDialog()" style="margin-top:10px;padding:8px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;width:100%;">Cancel</button></div>';
  
  const modal = document.createElement('div');
  modal.id = 'reportDialog';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = dialogHTML;
  modal.onclick = function(e) { if (e.target === modal) closeReportDialog(); };
  document.body.appendChild(modal);
}

function closeReportDialog() {
  const modal = document.getElementById('reportDialog');
  if (modal) modal.remove();
}

async function submitReport(postId, reason) {
  closeReportDialog();
  const { db } = getFirebase();
  if (!db) return;
  try {
    await db.ref('reports').push({
      postId: postId,
      reportedBy: currentUserId,
      reportedByUser: safeUser().username,
      reason: reason,
      timestamp: Date.now(),
      status: 'pending'
    });
    alert('✅ Report submitted! Thank you for keeping Damadam safe.');
  } catch(e) {
    alert('Error submitting report');
  }
}

function showFullPost(postId, type) {
  showFullPostInternal(postId, type, false);
}

function showFullPostInternal(postId, type, isBack) {
  currentView = 'postDetail';
  if (!isBack) NavigationHistory.push('postDetail', { postId: postId, type: type });
  hideSortBar();
  const container = document.getElementById('main-content-area');
  if (container) container.style.marginTop = '82px';
  loadPostDetail(postId, type);
  saveViewState({ postId: postId, type: type });
}

async function loadPostDetail(postId, type) {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;">Loading post...</div>';
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const postSnap = await db.ref('posts/' + postId).once('value');
    if (!postSnap.exists()) {
      container.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Post not found</p>';
      return;
    }
    
    const d = postSnap.val();
    const uid = d.user_id || '';
    const nickname = d.username || 'user';
    const text = d.text || d.caption || '';
    const imageUrl = safeUrl(d.image_url);
    const category = d.category || 'Random';
    const catCfg = categoryConfig[category] || { icon: '📌', gradient: 'linear-gradient(135deg,#64748b,#475569)' };
    const createdAt = d.timestamp ? timeAgo(new Date(d.timestamp)) : '';
    const likeCount = (d.likes && typeof d.likes === 'object') ? Object.keys(d.likes).length : (d.likeCount || 0);
    const commentCount = d.comment_count || 0;
    const isPostOwner = (uid === currentUserId);
    const userDp = ddpThumbUrl(safeUrl(await getUserDp(uid)), 100);
    const hasLiked = (d.likes && d.likes[currentUserId]);
    
    let html = '<div style="background:#fff;min-height:100vh;padding-bottom:120px;">';
    
    html += '<div style="position:sticky;top:0;z-index:100;background:#fff;padding:12px 15px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;">';
    html += '<button onclick="handleBackPress()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#2563eb;font-weight:600;">← Back</button>';
    html += '<span style="font-weight:700;font-size:14px;">Post Details</span>';
    html += '</div>';
    
    html += '<div class="post-category-strip" style="background:' + catCfg.gradient + ';padding:8px 15px;">';
    html += '<span style="font-size:14px">' + catCfg.icon + '</span> ' + esc(category);
    if (isPostOwner) html += '<span style="float:right;font-size:10px;opacity:0.8;">Your Post</span>';
    html += '</div>';
    
    html += '<div style="display:flex;align-items:center;gap:12px;padding:15px;border-bottom:1px solid #f3f4f6;">';
    if (userDp) {
      html += '<img src="' + userDp + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover;cursor:pointer;" onclick="goToUserProfile(\'' + uid + '\')" />';
    } else {
      html += '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;cursor:pointer;" onclick="goToUserProfile(\'' + uid + '\')">' + esc(nickname).charAt(0).toUpperCase() + '</div>';
    }
    html += '<div style="flex:1;"><div style="font-weight:700;font-size:15px;color:#1e293b;cursor:pointer;" onclick="goToUserProfile(\'' + uid + '\')">' + esc(nickname) + '</div><div style="font-size:12px;color:#94a3b8;">' + createdAt + '</div></div></div>';
    
    if (imageUrl) {
      html += '<img src="' + imageUrl + '" style="width:100%;max-height:500px;object-fit:contain;display:block;background:#f8fafc;" onclick="showFullImage(\'' + imageUrl + '\')" loading="lazy"/>';
    }
    
    html += '<div style="font-size:16px;color:#334155;line-height:1.7;padding:20px 15px;white-space:pre-wrap;">' + ddpEmojify(esc(text)) + '</div>'; /* (v55) emojify added */

    const replyLocked = (d.replyRestriction && uid !== currentUserId && followedUsers.indexOf(uid) === -1);
    const _detailRepliesOff = !!(d.repliesOff && uid !== currentUserId);
    html += '<div style="padding:0 15px 12px;display:flex;gap:8px;align-items:center;">';
    if (_detailRepliesOff) {
      html += '<span class="follow-to-reply-badge" style="flex:1;text-align:center;">💬 Replies Off</span>';
    } else if (replyLocked) {
      html += '<span class="follow-to-reply-badge" style="flex:1;text-align:center;">🔒 Only followers can reply</span>';
    } else {
      html += '<input id="detailReplyInput_' + postId + '" placeholder="Reply likhein.." maxlength="300" style="flex:1;padding:10px 15px;border:1.5px solid #e2e8f0;border-radius:25px;font-size:13px;background:#f8fafc;"/>';
      html += '<button data-pid="' + postId + '" data-ptype="' + type + '" onclick="submitDetailReply(this.getAttribute(\'data-pid\'), this.getAttribute(\'data-ptype\'))" style="background:#6366f1;color:#fff;border:none;padding:10px 20px;border-radius:25px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">Reply ↗</button>';
    }
    html += '</div>';

    html += '<div style="display:flex;justify-content:space-around;padding:12px 15px;border-top:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;background:#fafbfc;">';
    html += '<div style="text-align:center;"><div style="font-weight:700;color:#dc2626;">❤️ ' + likeCount + '</div><div style="font-size:10px;color:#94a3b8;">Likes</div></div>';
    html += '<div style="text-align:center;"><div style="font-weight:700;color:#2563eb;">💬 ' + commentCount + '</div><div style="font-size:10px;color:#94a3b8;">Comments</div></div>';
    html += '</div>';
    
    if (isSuperAdmin()) {
      html += '<div style="padding:12px 15px;border-bottom:1px solid #f3f4f6;background:#fefce8;">';
      if (likeCount > 0) {
        html += '<button onclick="ddpShowLikers(\'' + postId + '\')" style="background:#dc2626;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;width:100%;">👥 Kis ne like kiya? (' + likeCount + ') — sirf admin</button>';
        html += '<div id="ddpLikersList" style="margin-top:8px;"></div>';
      } else {
        html += '<p style="font-size:12px;color:#94a3b8;">👥 Abhi kisi ne like nahi diya.</p>';
      }
      html += '</div>';
    }
    html += '<div style="padding:15px;border-top:2px solid #e5e7eb;"><h4 style="font-weight:700;font-size:16px;margin-bottom:4px;">💬 All Comments (' + commentCount + ')</h4><p style="font-size:11px;color:#94a3b8;">Scroll to see all replies</p></div>';
    html += '<div id="detailCommentsList" style="padding:0 15px;">Loading comments...</div>';
    html += '</div>';
    
    container.innerHTML = html;
    
    loadDetailComments(postId, type, isPostOwner);
    
  } catch(e) {
    container.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Error loading post</p>';
  }
}


/* ===== v147 block (orig theme lines 4231-4557) ===== */


/* ===== (v130) LIKERS TRACE — sirf super admin: is post par kis kis ne like diya ===== */
async function ddpShowLikers(postId) {
  if (!isSuperAdmin()) return;
  const box = document.getElementById('ddpLikersList');
  if (!box) return;
  box.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Loading likers...</p>';
  try {
    const { db } = getFirebase();
    if (!db) return;
    const likeSnap = await db.ref('posts/' + postId + '/likes').once('value');
    const likes = likeSnap.val() || {};
    const uids = Object.keys(likes);
    if (!uids.length) { box.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Kisi ne like nahi diya.</p>'; return; }
    const shown = uids.slice(0, 200);
    const rows = await Promise.all(shown.map(async function(uid) {
      try {
        const s = await db.ref('users/' + uid).once('value');
        const u = s.val() || {};
        return { uid: uid, name: u.username || uid.substring(0, 8), banned: !!u.banned };
      } catch(e) { return { uid: uid, name: uid.substring(0, 8), banned: false }; }
    }));
    let html = '';
    rows.forEach(function(r) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;">';
      html += '<span style="flex:1;font-weight:600;font-size:13px;color:#1e293b;cursor:pointer;" onclick="goToUserProfile(\'' + r.uid + '\')">@' + esc(r.name) + '</span>';
      if (r.banned) html += '<span style="font-size:11px;color:#dc2626;font-weight:700;">BANNED</span>';
      else html += '<button onclick="adminBanUser(\'' + r.uid + '\', true)" style="background:#fee2e2;color:#dc2626;border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;">🚫 Ban</button>';
      html += '</div>';
    });
    if (uids.length > 200) html += '<p style="font-size:11px;color:#94a3b8;">Pehle 200 dikhaye ja rahe hain, kul ' + uids.length + ' likes hain.</p>';
    box.innerHTML = html;
  } catch(e) { box.innerHTML = '<p style="color:red;font-size:12px;">Error: ' + esc(e.message) + '</p>'; }
}

/* ===== DETAIL COMMENTS FUNCTIONS ===== */
async function loadDetailComments(postId, type, isPostOwner) {
  const commentsList = document.getElementById('detailCommentsList');
  if (!commentsList) {
    console.error('Comments container not found');
    return;
  }
  
  commentsList.innerHTML = '<p style="text-align:center;padding:20px;color:#94a3b8;">Loading comments...</p>';
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const snap = await db.ref('posts/' + postId + '/comments').orderByChild('timestamp').limitToLast(50).once('value');
    const allComments = [];

    /* (2026-10-02) Blocked users ke comments na dikhao */
    const myBlocked = await getMyBlockedList();

    snap.forEach(function(c) {
      const cmt = c.val();
      if (cmt) {
        if (cmt.uid && myBlocked.indexOf(cmt.uid) !== -1) return;
        cmt.id = c.key;
        allComments.push(cmt);
      }
    });
    
    allComments.sort(function(a, b) { 
      return (b.timestamp || 0) - (a.timestamp || 0); 
    });
    
    if (allComments.length === 0) {
      commentsList.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:48px;">💬</div><p style="color:#94a3b8;margin-top:8px;">No comments yet. Be the first to reply!</p></div>';
      return;
    }
    
    let html = '';
    
    for (let i = 0; i < allComments.length; i++) {
      const cmt = allComments[i];
      const isDel = cmt.deleted || false;
      const replyUid = cmt.uid || '';
      let userDp = '';
      
      try {
        userDp = ddpThumbUrl(safeUrl(await getUserDp(replyUid)), 100);
      } catch(e) {
        userDp = '';
      }
      
      html += '<div class="ddp-fitem" id="comment_' + cmt.id + '">';

      if (isDel) {
        html += '<div style="font-style:italic;color:#94a3b8;font-size:13px;padding:4px 0;">⚠️ This reply has been deleted</div>';
      } else {
        html += '<div class="ddp-msg-line">'; 
        html += '<span class="ddp-msg-user" data-uid="' + replyUid + '" onclick="goToUserProfile(\'' + replyUid + '\')">' + esc(cmt.username || 'user') + redStarHTMLByUid(replyUid) + '</span>';
        html += '<span class="ddp-msg-text">' + ddpEmojify(esc(cmt.text || '')) + '</span>';
        html += '<span class="ddp-msg-time">' + (cmt.timestamp ? timeAgo(new Date(cmt.timestamp)) : '') + '</span></div>';

        if (cmt.quotedText && cmt.quotedUsername) {
          const _q = cmt.quotedText;
          if (_q.length > 60) {
            html += '<div class="ddp-quote"><span class="ddp-q-short">➔ to ' + esc(cmt.quotedUsername) + ': ' + esc(_q.substring(0, 60)) + '...</span><span class="ddp-q-full" style="display:none;">➔ to ' + esc(cmt.quotedUsername) + ': ' + esc(_q) + '</span> <button class="ddp-more-btn" onclick="ddpToggleQuote(this)">MORE▼</button></div>';
          } else {
            html += '<div class="ddp-quote">➔ to ' + esc(cmt.quotedUsername) + ': ' + esc(_q) + '</div>';
          }
        }

        html += '<div class="ddp-msg-actions">';
        html += '<button onclick="showDetailNestedReply(\'' + cmt.id + '\',\'' + escAttrJS(cmt.username || 'user') + '\')">↩ Reply</button>';

        if (replyUid && replyUid !== currentUserId) {
          html += '<button onclick="startChatWith(\'' + replyUid + '\')">💬 1 ON 1</button>';
          html += '<button onclick="blockUserProfile(\'' + replyUid + '\')">🚫 Block</button>';
        }

        if (isPostOwner && !isDel) {
          html += '<button onclick="hideComment(\'' + postId + '\',\'' + cmt.id + '\')">🗑 Hide</button>';
        }
        html += '</div>';
        
        html += '<div class="inline-reply-box" id="detailNestedBox_' + cmt.id + '" style="display:none;margin-top:10px;background:#f8fafc;padding:10px;border-radius:8px;">';
        html += '<div style="display:flex;gap:8px;">';
        html += '<input id="detailNestedInput_' + cmt.id + '" placeholder="Reply to ' + escAttr(cmt.username || 'user') + '..." style="flex:1;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:20px;font-size:12px;background:#fff;" />';
        html += '<button onclick="submitDetailNestedReply(\'' + postId + '\',\'' + cmt.id + '\')" style="background:#6366f1;color:#fff;border:none;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Send</button>';
        html += '</div></div>';
      }
      
      html += '</div>';
    }
    
    commentsList.innerHTML = html;
    
    const countDisplay = commentsList.previousElementSibling;
    if (countDisplay) {
      const h4 = countDisplay.querySelector('h4');
      if (h4) {
        h4.textContent = '💬 All Comments (' + allComments.length + ')';
      }
    }
    
  } catch(e) {
    console.error('Error loading comments:', e);
    commentsList.innerHTML = '<p style="color:red;text-align:center;padding:20px;">Error loading comments. Please try again.</p>';
  }
}

function showDetailNestedReply(commentId, username) {
  const box = document.getElementById('detailNestedBox_' + commentId);
  const input = document.getElementById('detailNestedInput_' + commentId);
  
  if (!box || !input) {
    console.error('Reply box not found for comment:', commentId);
    return;
  }
  
  if (box.style.display === 'none' || box.style.display === '') {
    box.style.display = 'block';
    input.placeholder = 'Reply to ' + username + '...';
    setTimeout(function() { input.focus(); }, 100);
  } else {
    box.style.display = 'none';
  }
}

async function submitDetailNestedReply(postId, parentCommentId) {
  const input = document.getElementById('detailNestedInput_' + parentCommentId);
  if (!input) {
    console.error('Input not found for comment:', parentCommentId);
    return;
  }
  
  const text = input.value.trim();
  if (!text) return;

  const { db } = getFirebase();
  if (!db) return;

  /* (2026-10-02) Block check: post owner se block ho to nested reply na karo */
  try {
    const ownerSnap = await db.ref('posts/' + postId + '/user_id').once('value');
    const ownerUid = ownerSnap.val();
    if (ownerUid && ownerUid !== currentUserId && await isBlockedBetween(currentUserId, ownerUid)) {
      alert('🚫 Is user ke sath interaction blocked hai.');
      return;
    }
  } catch(e) {}

  let qt = '', qu = '', qu_id = '';
  try {
    const qd = await db.ref('posts/' + postId + '/comments/' + parentCommentId).once('value');
    if (qd.exists()) {
      const q = qd.val();
      if (q) {
        qt = q.text || '';
        qu = q.username || 'user';
        qu_id = q.uid || '';
      }
    }
  } catch(e) {
    console.error('Error getting quoted comment:', e);
  }
  
  await db.ref('posts/' + postId + '/comments').push({
    uid: currentUserId,
    username: safeUser().username,
    text: text,
    in_reply_to: parentCommentId,
    quotedText: qt,
    quotedUsername: qu,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  
  await incCommentCount(db, postId);

  /* (v125) detail nested reply: sirf parent comment author + @mentions ko notify karo — post owner ko nahi (card path jaisa hi, owner block hataya) */
  try {
    const _skip = {};
    _skip[currentUserId] = true;
    if (qu_id && qu_id !== currentUserId && !(await isBlockedBetween(currentUserId, qu_id))) {
      _skip[qu_id] = true;
      await db.ref('notifications').push({
        toUid: qu_id, fromUid: currentUserId,
        sender_name: safeUser().username, type: 'reply',
        message: safeUser().username + ' replied to your comment',
        postId: postId, replyPreview: text.substring(0, 100),
        timestamp: Date.now(), read: false
      });
    }
    await ddpNotifyMentionedUsers(db, text, { postId: postId, type: 'reply', context: ' in a reply', skipUid: _skip });
    updateInboxBadge();
  } catch(e) {}

  input.value = '';
  const box = document.getElementById('detailNestedBox_' + parentCommentId);
  if (box) box.style.display = 'none';
  
  const postSnap = await db.ref('posts/' + postId).once('value');
  const isPostOwner = (postSnap.val()?.user_id === currentUserId);
  await loadDetailComments(postId, 'text', isPostOwner);
}

async function submitDetailReply(postId, type) {
  const input = document.getElementById('detailReplyInput_' + postId);
  const text = input ? input.value.trim() : '';
  if (!text) return;

  const { db } = getFirebase();
  if (!db) return;
  const postSnap = await db.ref('posts/' + postId).once('value');
  const pd = postSnap.val();

  /* (2026-10-02) Block check: post owner se block ho to reply na karo */
  if (pd && pd.user_id && pd.user_id !== currentUserId && await isBlockedBetween(currentUserId, pd.user_id)) {
    alert('🚫 Is user ke sath interaction blocked hai.');
    return;
  }

  if (pd.replyRestriction && pd.user_id !== currentUserId && followedUsers.indexOf(pd.user_id) === -1) {
    alert('Replies Off');
    return;
  }

  /* (v27) Post par replies off hon to block */
  if (pd && pd.repliesOff && pd.user_id !== currentUserId) {
    alert('💬 Is post par replies off hain.');
    return;
  }
  
  await db.ref('posts/' + postId + '/comments').push({
    uid: currentUserId,
    username: safeUser().username,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  
  await incCommentCount(db, postId);
  if (input) input.value = '';
  
  const _skipM2 = {};
  _skipM2[currentUserId] = true;
  if (pd.user_id && pd.user_id !== currentUserId) {
    _skipM2[pd.user_id] = true;
    await db.ref('notifications').push({
      toUid: pd.user_id,
      fromUid: currentUserId,
      sender_name: safeUser().username,
      type: 'comment',
      message: safeUser().username + ' commented on your post',
      postId: postId,
      replyPreview: text,
      timestamp: Date.now(),
      read: false
    });
    updateInboxBadge();
  }
  /* (v24) @mentions in comment text */
  await ddpNotifyMentionedUsers(db, text, { postId: postId, type: 'reply', context: ' in a comment', skipUid: _skipM2 });
  
  const isPostOwner = (pd.user_id === currentUserId);
  await loadDetailComments(postId, type, isPostOwner);
}

async function hideComment(postId, commentId) {
  if (!confirm('Hide this reply? This action cannot be undone.')) return;
  
  try {
    const { db } = getFirebase();
    if (!db) return;
    await db.ref('posts/' + postId + '/comments/' + commentId).update({ 
      deleted: true,
      deletedAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    const postSnap = await db.ref('posts/' + postId).once('value');
    let isPostOwner = false;
    if (postSnap.exists() && postSnap.val()) {
      isPostOwner = (postSnap.val().user_id === currentUserId);
    }
    await loadDetailComments(postId, 'text', isPostOwner);
    
  } catch(e) {
    console.error('Error hiding comment:', e);
    alert('Error hiding comment');
  }
}


/* ===== v147 block (orig theme lines 4558-5121) ===== */

/* ===== INBOX SYSTEM ===== */
function openInbox() {
  openInboxInternal(false);
}

function openInboxInternal(isBack) {
  currentView = 'inbox';
  if (!isBack) NavigationHistory.push('inbox');
  openInboxContent();
  saveViewState();
}

function openInboxContent() {
  currentView = 'inbox';
  currentInboxTab = 'activity';
  const container = document.getElementById('main-content-area');
  if (!container) return;
  container.style.marginTop = '82px';
  
  container.innerHTML = '<div class="inbox-container">' +
    '<div class="inbox-tab-bar">' +
    '<button class="inbox-tab-btn active" id="tabActivity" onclick="switchInboxTab(\'activity\')">📋 Activity<span class="inbox-tab-count" id="activityCount">0</span></button>' +
    '<button class="inbox-tab-btn" id="tabLikes" onclick="switchInboxTab(\'likes\')">❤️ Likes<span class="inbox-tab-count" id="likesCount">0</span></button>' +
    '</div>' +
    '<div id="inboxTabContent"></div>' +
    '</div>';
  
  loadInboxActivity();
}

function switchInboxTab(tab) {
  currentInboxTab = tab;
  
  const allBtns = document.querySelectorAll('.inbox-tab-btn');
  for (let i = 0; i < allBtns.length; i++) { allBtns[i].classList.remove('active'); }
  
  const activeTab = document.getElementById(tab === 'activity' ? 'tabActivity' : 'tabLikes');
  if (activeTab) activeTab.classList.add('active');
  
  if (tab === 'activity') loadInboxActivity();
  else loadInboxLikes();
}

async function loadInboxActivity() {
  const content = document.getElementById('inboxTabContent');
  if (!content) return;
  
  content.innerHTML = '<p style="text-align:center;padding:40px;">Loading...</p>';
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const snap = await db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value');
    const notifs = [];
    snap.forEach(function(doc) {
      const n = doc.val();
      /* (v123) Mehfil invite inbox me nahi — sirf Mehfil > Invites section me */
      if (n.type === 'mehfil_invite') return;
      n.id = doc.key;
      notifs.push(n);
    });
    
    notifs.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    
    let unreadCount = 0;
    for (let i = 0; i < notifs.length; i++) {
      if (!notifs[i].read && !notifs[i].autoDismissed) unreadCount++;
    }
    
    const activityCountEl = document.getElementById('activityCount');
    if (activityCountEl) activityCountEl.textContent = unreadCount;
    
    if (notifs.length === 0) {
      content.innerHTML = '<div class="inbox-empty-state"><div style="font-size:48px;">📭</div><p>No activity yet</p></div>';
      return;
    }
    
    let html = '<div class="inbox-clear-header"><span class="inbox-clear-title">📋 Activity (' + notifs.length + ')</span><button class="inbox-clear-all-btn" onclick="clearAllInbox()">🗑 Clear All</button></div>';
    
    for (let j = 0; j < notifs.length; j++) {
      const n = notifs[j];
      if (n.autoDismissed) continue;
      
      const isUnread = !n.read;
      const emoji = getNotifEmoji(n.type);
      const timeText = n.timestamp ? timeAgo(new Date(n.timestamp)) : '';
      
      html += '<div class="inbox-notif-card' + (isUnread ? ' unread' : '') + '" id="inboxNotif_' + n.id + '" onclick="handleNotifClick(\'' + n.id + '\', \'' + (n.type || '') + '\', \'' + (n.postId || '') + '\', \'' + (n.mehfilId || '') + '\', \'' + (n.fromUid || '') + '\', \'' + escAttrJS(n.sender_name || '') + '\')">';
      html += '<div class="inbox-notif-header">';
      html += '<div class="inbox-notif-icon ' + (n.type === 'like' ? 'like' : 'reply') + '">' + emoji + '</div>';
      html += '<div class="inbox-notif-info">';
      html += '<div class="inbox-notif-title">' + esc(n.message || 'Notification') + '</div>';
      html += '<div class="inbox-notif-time">' + timeText + '</div>';
      
      if (n.replyPreview) {
        html += '<div style="background:#f1f5f9;padding:8px 12px;border-radius:8px;margin-top:6px;font-size:12px;color:#334155;"><strong>📝 Reply Preview:</strong><br/>"' + esc(n.replyPreview.substring(0, 100)) + (n.replyPreview.length > 100 ? '...' : '') + '"</div>';
      }
      
      if (n.postPreview) {
        html += '<div style="background:#fef3c7;padding:8px 12px;border-radius:8px;margin-top:6px;font-size:11px;color:#b45309;"><strong>📌 Your post:</strong> "' + esc(n.postPreview.substring(0, 80)) + '..."</div>';
      }
      
      html += '</div></div>';
      
      html += '<div class="inbox-notif-actions" onclick="event.stopPropagation();">';
      html += getNotifActionButtons(n);
      html += '</div>';
      
      if (n.type === 'comment' || n.type === 'mehfil_reply' || n.type === 'reply') {
        html += '<div class="inbox-inline-reply-box" id="inboxReplyBox_' + n.id + '" style="display:none;margin-top:8px;">';
        html += '<input id="inboxReplyInput_' + n.id + '" placeholder="Write a quick reply..." style="width:100%;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:20px;font-size:12px;background:#fff;"/>';
        html += '<button onclick="sendInboxReply(\'' + n.id + '\', \'' + (n.postId || '') + '\', \'' + (n.fromUid || '') + '\', \'' + (n.mehfilId || '') + '\')" style="margin-top:4px;background:#6366f1;color:#fff;border:none;padding:7px 14px;border-radius:16px;font-size:11px;cursor:pointer;">Send Reply</button>';
        html += '</div>';
      }
      
      html += '</div>';
    }
    
    content.innerHTML = html;
    
  } catch(e) {
    content.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Error loading notifications</p>';
  }
}

function getNotifEmoji(type) {
  const emojis = {
    'like': '❤️',
    'comment': '💬',
    'follow': '👥',
    'follow_request': '📩',
    '1on1_invite': '💌',
    '1on1_reply': '💭',
    'mehfil_invite': '📩',
    'mehfil_reply': '💭',
    'mehfil_announce': '📢',
    'mehfil_admin_msg': '📩',
    'reply': '↩️',
  };
  return emojis[type] || '🔔';
}

function getNotifActionButtons(n) {
  let buttons = '';
  
  if (n.type === '1on1_invite' && n.fromUid) {
    buttons += '<button class="inbox-notif-btn reply-btn" style="background:#16a34a;color:#fff;border-color:#16a34a;" onclick="accept1on1FromInbox(\'' + n.fromUid + '\',\'' + escAttrJS(n.sender_name || 'User') + '\',\'' + n.id + '\')">✅ Accept</button>';
    buttons += '<button class="inbox-notif-btn skip-btn" onclick="reject1on1FromInbox(\'' + n.fromUid + '\',\'' + n.id + '\')">❌ Reject</button>';
  } else if (n.type === '1on1_reply' && n.fromUid) {
    buttons += '<button class="inbox-notif-btn reply-btn" style="background:#6366f1;color:#fff;border-color:#6366f1;" onclick="open1on1ChatFromNotif(\'' + n.fromUid + '\',\'' + escAttrJS(n.sender_name || 'User') + '\')">💬 Open Chat</button>';
    buttons += '<button class="inbox-notif-btn skip-btn" onclick="inboxSkipNotif(\'' + n.id + '\')">✕ Dismiss</button>';
  } else if (n.type === 'mehfil_invite' && n.mehfilId) {
    buttons += '<button class="inbox-notif-btn reply-btn" style="background:#16a34a;color:#fff;border-color:#16a34a;" onclick="acceptMehfilInviteFromNotif(\'' + n.mehfilId + '\',\'' + n.id + '\')">✅ Join</button>';
    buttons += '<button class="inbox-notif-btn skip-btn" onclick="declineMehfilInviteFromNotif(\'' + n.mehfilId + '\',\'' + n.id + '\')">❌ Decline</button>';
  } else if (n.type === 'comment' || n.type === 'mehfil_reply' || n.type === 'reply') {
    buttons += '<button class="inbox-notif-btn reply-btn" onclick="event.stopPropagation();toggleInboxReplyBox(\'' + n.id + '\')">↩ Reply</button>';
    buttons += '<button class="inbox-notif-btn skip-btn" onclick="inboxSkipNotif(\'' + n.id + '\')">✕ Dismiss</button>';
    if (n.fromUid && n.fromUid !== currentUserId) {
      buttons += '<button class="inbox-notif-btn block-btn" onclick="inboxBlockUser(\'' + n.id + '\',\'' + n.fromUid + '\')">🚫 Block</button>';
    }
  } else if (n.type === 'follow_request') {
    buttons += '<button class="inbox-notif-btn" style="background:#10b981;color:#fff;" onclick="ddpAcceptFollowRequest(\'' + n.fromUid + '\');inboxSkipNotif(\'' + n.id + '\')">✓ Accept</button>';
    buttons += '<button class="inbox-notif-btn" style="background:#fee2e2;color:#dc2626;" onclick="ddpDeclineFollowRequest(\'' + n.fromUid + '\');inboxSkipNotif(\'' + n.id + '\')">✕ Decline</button>';
  } else if ((n.type === 'mehfil_announce' || n.type === 'mehfil_admin_msg') && n.mehfilId) {
    buttons += '<button class="inbox-notif-btn reply-btn" style="background:#6366f1;color:#fff;border-color:#6366f1;" onclick="openMehfilChat(\'' + n.mehfilId + '\')">🎪 Open Mehfil</button>';
    buttons += '<button class="inbox-notif-btn skip-btn" onclick="inboxSkipNotif(\'' + n.id + '\')">✕ Dismiss</button>';
  } else if (n.type === 'follow') {
    buttons += '<button class="inbox-notif-btn skip-btn" onclick="inboxSkipNotif(\'' + n.id + '\')">✕ Dismiss</button>';
    if (n.fromUid && n.fromUid !== currentUserId) {
      buttons += '<button class="inbox-notif-btn block-btn" onclick="inboxBlockUser(\'' + n.id + '\',\'' + n.fromUid + '\')">🚫 Block</button>';
    }
  } else {
    buttons += '<button class="inbox-notif-btn skip-btn" onclick="inboxSkipNotif(\'' + n.id + '\')">✕ Dismiss</button>';
  }
  
  return buttons;
}

async function handleNotifClick(notifId, type, postId, mehfilId, fromUid, senderName) {
  const { db } = getFirebase();
  if (db) {
    /* (v104) FIX: click par notification dismiss NAHI hoga - sirf read mark hoga aur card waisa hi rahega.
       Pehle autoDismissed + card remove ho jata tha, is liye click = dismiss lagta tha aur navigation fail ho to notification hamesha ke liye ghayab. */
    try { await db.ref('notifications/' + notifId).update({ read: true }); } catch(e) {}
    const card = document.getElementById('inboxNotif_' + notifId);
    if (card) card.classList.remove('unread');
  }
  updateInboxBadge();
  
  switch(type) {
    case 'comment':
    case 'like':
    case 'reply':
      if (postId) showFullPost(postId, 'text');
      break;
    case 'mehfil_reply':
      if (mehfilId) openMehfil(mehfilId);
      break;
    case '1on1_reply':
      if (fromUid) {
        const chatId = currentUserId < fromUid ? currentUserId + '_' + fromUid : fromUid + '_' + currentUserId;
        openChatScreen(chatId, fromUid, senderName || 'User');
      }
      break;
    case 'follow':
      if (fromUid) goToUserProfile(fromUid);
      break;
    case 'follow_request':
      if (typeof openPrivacyPage === 'function') openPrivacyPage();
      break;
    case 'mehfil_announce':
      if (mehfilId && typeof openMehfilChat === 'function') openMehfilChat(mehfilId);
      break;
    case 'mehfil_admin_msg':
      if (mehfilId && typeof openMehfilChat === 'function') openMehfilChat(mehfilId);
      break;
    case 'mehfil_invite':
      if (mehfilId) checkAndJoinMehfil(mehfilId);
      break;
    case '1on1_invite':
      if (fromUid && senderName) openMyChatsList();
      break;
    default:
      loadInboxActivity();
  }
}

function open1on1ChatFromNotif(uid, userName) {
  const chatId = currentUserId < uid ? currentUserId + '_' + uid : uid + '_' + currentUserId;
  openChatScreen(chatId, uid, userName);
}

function dismissChatNotifications(otherUid) {
  if (!otherUid || !currentUserId) return;
  var { db } = getFirebase();
  if (!db) return;
  db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value', function(snap) {
    var batch = {};
    snap.forEach(function(doc) {
      var n = doc.val();
      if (n.fromUid === otherUid && n.type === '1on1_reply' && !n.autoDismissed) {
        batch['notifications/' + doc.key + '/autoDismissed'] = true;
        batch['notifications/' + doc.key + '/read'] = true;
      }
    });
    if (Object.keys(batch).length > 0) {
      db.ref().update(batch);
      updateInboxBadge();
    }
  });
}

function dismissNotifByType(type, filterKey, filterValue) {
  if (!currentUserId) return;
  var { db } = getFirebase();
  if (!db) return;
  db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value', function(snap) {
    var batch = {};
    snap.forEach(function(doc) {
      var n = doc.val();
      if (n.type === type && n[filterKey] === filterValue && !n.autoDismissed) {
        batch['notifications/' + doc.key + '/autoDismissed'] = true;
        batch['notifications/' + doc.key + '/read'] = true;
      }
    });
    if (Object.keys(batch).length > 0) {
      db.ref().update(batch);
      updateInboxBadge();
    }
  });
}

function toggleInboxReplyBox(notifId) {
  const box = document.getElementById('inboxReplyBox_' + notifId);
  if (!box) return;
  if (box.style.display === 'none' || box.style.display === '') {
    box.style.display = 'block';
    const input = document.getElementById('inboxReplyInput_' + notifId);
    if (input) { input.focus(); input.placeholder = 'Write a quick reply...'; }
  } else {
    box.style.display = 'none';
  }
}

async function inboxSkipNotif(notifId) {
  const { db } = getFirebase();
  if (!db) return;
  try {
    await db.ref('notifications/' + notifId).remove();
    loadInboxActivity();
    updateInboxBadge();
  } catch(e) {}
}

async function inboxBlockUser(notifId, uid) {
  if (!confirm('Block this user? You will no longer see their content.')) return;
  
  try {
    const { db } = getFirebase();
    if (!db) return;
    const blockedRef = db.ref('users/' + currentUserId + '/blockedUsers');
    const snap = await blockedRef.once('value');
    let list = snap.val() || [];
    
    if (list.indexOf(uid) === -1) {
      list.push(uid);
      await blockedRef.set(list);
      
      const notifSnap = await db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value');
      const batch = {};
      notifSnap.forEach(function(doc) {
        const n = doc.val();
        if (n.fromUid === uid) {
          batch['notifications/' + doc.key] = null;
        }
      });
      await db.ref().update(batch);
    }
    
    await db.ref('notifications/' + notifId).remove();
    invalidateBlockedCache();
    clearPostCache();
    loadInboxActivity();
    updateInboxBadge();
    alert('User blocked successfully! 🚫');
    
  } catch(e) {
    alert('Error blocking user');
  }
}

async function sendInboxReply(notifId, postId, toUid, mehfilId) {
  const input = document.getElementById('inboxReplyInput_' + notifId);
  const text = input ? input.value.trim() : '';
  if (!text) return;
  
  try {
    const { db } = getFirebase();
    if (!db) return;
    
    /* (v108) FIX: 1on1 notification ka reply seedha CHAT me jayega.
       Pehle: postId/mehfilId khaali hone par reply sirf ek aur notification ban jata tha - asal chat me message jata hi nahi tha. */
    let _nType = '';
    try { const _ns = await db.ref('notifications/' + notifId).once('value'); _nType = ((_ns.val() || {}).type) || ''; } catch(e) {}
    if (_nType === '1on1_reply' && toUid && toUid !== currentUserId) {
      const chatId = currentUserId < toUid ? currentUserId + '_' + toUid : toUid + '_' + currentUserId;
      try { const _cst = await db.ref('1on1_chats/' + chatId + '/status').once('value'); if (_cst.val() === 'left') { alert('🧹 Ye chat khatam ho chuki hai (leave ho chuki hai).'); return; } } catch(e) {}
      if (await isBlockedBetween(currentUserId, toUid)) { alert('🚫 Is user ke sath interaction blocked hai.'); return; }
      await db.ref('1on1_messages/' + chatId).push({
        senderId: currentUserId,
        senderName: safeUser().username,
        senderDp: safeUser().profilePic || '',
        text: text, type: 'text',
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        hidden: false
      });
      await db.ref('1on1_chats/' + chatId).update({ lastMsg: text, lastTime: firebase.database.ServerValue.TIMESTAMP });
      try { dismissChatNotifications(toUid); } catch(e) {}
      await db.ref('notifications').push({
        toUid: toUid, fromUid: currentUserId,
        sender_name: safeUser().username, type: '1on1_reply',
        message: safeUser().username + ' sent you a message: "' + text.substring(0, 50) + '"',
        replyPreview: text, chatId: chatId,
        timestamp: Date.now(), read: false
      });
      if (input) input.value = '';
      const replyBox1 = document.getElementById('inboxReplyBox_' + notifId);
      if (replyBox1) replyBox1.style.display = 'none';
      await db.ref('notifications/' + notifId).update({ read: true });
      updateInboxBadge();
      loadInboxActivity();
      return;
    }
    if (mehfilId) {
      /* (v24) inbox se mehfil reply: @mention ke sath bhejo taake target ko notify jaye */
      let _targetName = '';
      if (toUid && toUid !== currentUserId) {
        try { const _tu = await UserCache.get(toUid); _targetName = (_tu && _tu.username) || ''; } catch(e) {}
      }
      const _mtext = (_targetName ? '@' + _targetName + ' ' : '') + text;
      await db.ref('mehfil_posts/' + mehfilId).push({
        user: safeUser().username,
        userId: currentUserId,
        text: _mtext,
        time: firebase.database.ServerValue.TIMESTAMP
      });
      await db.ref('mehfils/' + mehfilId).update({ lastActivity: firebase.database.ServerValue.TIMESTAMP });
      if (typeof ddpMarkMehfilActive === 'function') { try { ddpMarkMehfilActive(mehfilId); } catch(e) {} }
      if (toUid && toUid !== currentUserId && !(await isBlockedBetween(currentUserId, toUid))) {
        let _mname = 'Mehfil';
        try { const _ms = await db.ref('mehfils/' + mehfilId).once('value'); _mname = (_ms.val() || {}).name || 'Mehfil'; } catch(e) {}
        await db.ref('notifications').push({
          toUid: toUid, fromUid: currentUserId,
          sender_name: safeUser().username, type: 'mehfil_reply',
          message: safeUser().username + ' replied to you in mehfil "' + _mname + '"',
          replyPreview: _mtext.substring(0, 100),
          mehfilId: mehfilId, mehfilName: _mname,
          timestamp: Date.now(), read: false
        });
        updateInboxBadge();
      }
    } else if (postId) {
      /* (2026-10-02) Block check: post owner se block ho to reply na karo */
      const pOwnerSnap = await db.ref('posts/' + postId + '/user_id').once('value');
      const pOwner = pOwnerSnap.val();
      if (pOwner && pOwner !== currentUserId && await isBlockedBetween(currentUserId, pOwner)) {
        alert('🚫 Is user ke sath interaction blocked hai.');
        return;
      }
      /* (v27) Post par replies off hon to block */
      try {
        const _roPost2 = await db.ref('posts/' + postId + '/repliesOff').once('value');
        if (_roPost2.val()) { alert('💬 Is post par replies off hain.'); return; }
      } catch(e) {}
      /* (v24) reply karne wale ko @mention ke sath notify karo */
      let _cTargetName = '';
      if (toUid && toUid !== currentUserId) {
        try { const _tu2 = await UserCache.get(toUid); _cTargetName = (_tu2 && _tu2.username) || ''; } catch(e) {}
      }
      const _ctext = (_cTargetName ? '@' + _cTargetName + ' ' : '') + text;
      await db.ref('posts/' + postId + '/comments').push({
        uid: currentUserId,
        username: safeUser().username,
        text: _ctext,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      await incCommentCount(db, postId);
      const _skipC = {};
      _skipC[currentUserId] = true;
      if (toUid && toUid !== currentUserId && !(await isBlockedBetween(currentUserId, toUid))) {
        _skipC[toUid] = true;
        await db.ref('notifications').push({
          toUid: toUid, fromUid: currentUserId,
          sender_name: safeUser().username, type: 'reply',
          message: safeUser().username + ' replied to your comment',
          postId: postId, replyPreview: _ctext.substring(0, 100),
          timestamp: Date.now(), read: false
        });
      }
      /* (v125) post owner ko inbox-reply par notify nahi — sirf replied-to user + mentions */
      await ddpNotifyMentionedUsers(db, _ctext, { postId: postId, type: 'reply', context: ' in a reply', skipUid: _skipC });
      updateInboxBadge();
    } else if (toUid) {
      /* (2026-10-02) Block check: blocked user ko reply na bhejo */
      if (await isBlockedBetween(currentUserId, toUid)) {
        alert('🚫 Is user ke sath interaction blocked hai.');
        return;
      }
      await db.ref('notifications').push({
        toUid: toUid,
        fromUid: currentUserId,
        sender_name: safeUser().username,
        type: 'reply',
        message: safeUser().username + ' sent you a reply: "' + text.substring(0, 50) + '"',
        replyPreview: text,
        timestamp: Date.now(),
        read: false
      });
    }
    
    if (input) input.value = '';
    const replyBox = document.getElementById('inboxReplyBox_' + notifId);
    if (replyBox) replyBox.style.display = 'none';
    
    /* (v24) history save rakho: sirf read mark karo, delete nahi (user khud Clear/Delete karega) */
    await db.ref('notifications/' + notifId).update({ read: true });
    
    updateInboxBadge();
    loadInboxActivity();
    
  } catch(e) { alert('Error sending reply'); }
}

async function loadInboxLikes() {
  const content = document.getElementById('inboxTabContent');
  if (!content) return;
  content.innerHTML = '<p style="text-align:center;padding:40px;">Loading...</p>';
  
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('posts').orderByChild('timestamp').limitToLast(50).once('value');
  const liked = [];
  snap.forEach(function(doc) {
    const p = doc.val();
    if (p.likes && p.likes[currentUserId]) {
      p.id = doc.key;
      liked.push(p);
    }
  });
  
  liked.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
  
  const likesCountEl = document.getElementById('likesCount');
  if (likesCountEl) likesCountEl.textContent = liked.length;
  
  if (liked.length === 0) {
    content.innerHTML = '<div class="inbox-empty-state"><div style="font-size:48px;">💔</div><p>No liked posts</p></div>';
    return;
  }
  
  let html = '<div class="inbox-clear-header"><span class="inbox-clear-title">❤️ Liked (' + liked.length + ')</span><button class="inbox-clear-all-btn" onclick="clearAllLikes()">🗑 Clear All</button></div>';
  
  for (let i = 0; i < liked.length; i++) {
    const p = liked[i];
    html += '<div class="inbox-liked-post-card" onclick="showFullPost(\'' + p.id + '\',\'' + (p.image_url ? 'image' : 'text') + '\')"><div class="inbox-liked-icon">❤️</div><div class="inbox-liked-info"><div class="inbox-liked-title">' + esc(p.username || 'user') + '\'s post</div><div class="inbox-liked-time">' + (p.timestamp ? timeAgo(new Date(p.timestamp)) : '') + '</div></div></div>';
  }
  
  content.innerHTML = html;
}

async function clearAllInbox() {
  if (!confirm('Clear all notifications?')) return;
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value');
  const batch = {};
  snap.forEach(function(doc) { batch['notifications/' + doc.key] = null; });
  await db.ref().update(batch);
  loadInboxActivity();
  updateInboxBadge();
}

async function clearAllLikes() {
  if (!confirm('Unlike ALL posts?')) return;
  const { db } = getFirebase();
  if (!db) return;
  /* Stage 3 perf: scan the same bounded window the inbox displays (was: full posts scan) */
  const snap = await db.ref('posts').orderByChild('timestamp').limitToLast(50).once('value');
  const batch = {};
  snap.forEach(function(doc) {
    if (doc.val().likes && doc.val().likes[currentUserId]) {
      batch['posts/' + doc.key + '/likes/' + currentUserId] = null;
    }
  });
  await db.ref().update(batch);
  loadInboxLikes();
}

async function acceptMehfilInviteFromNotif(mid, nid) {
  const { db } = getFirebase();
  if (!db) return;
  try {
    await db.ref('mehfils/' + mid + '/members/' + currentUserId).set(true);
    const snap = await db.ref('mehfils/' + mid).once('value');
    const m = snap.val() || {};
    await db.ref('mehfils/' + mid).update({ memberCount: (m.memberCount || 0) + 1 });
    await db.ref('notifications/' + nid).remove();
    alert('🎉 Joined mehfil!');
    updateInboxBadge();
    openMehfil(mid);
  } catch(e) { alert('Error: ' + e.message); }
}

async function declineMehfilInviteFromNotif(mid, nid) {
  const { db } = getFirebase();
  if (!db) return;
  await db.ref('notifications/' + nid).remove();
  updateInboxBadge();
  loadInboxActivity();
}


/* ===== v147 block (orig theme lines 5122-5640) ===== */


/* ===== SHARE v10: user design state ===== */
var _ddpTextExpiry = '30days';
var _ddpImgExpiry = 'never';
var _ddpReplyMode = 'all'; /* (v27) all | followers | off */
function ddpResetReplyMode() {
  _ddpReplyMode = 'all';
  const ids = ['ddpReplyModeAll','ddpReplyModeFollowers','ddpReplyModeOff','ddpTextReplyModeAll','ddpTextReplyModeFollowers','ddpTextReplyModeOff'];
  for (let i = 0; i < ids.length; i++) {
    const el = document.getElementById(ids[i]);
    if (el) el.classList.toggle('selected', ids[i].endsWith('All'));
  }
}
function ddpShareSelectExpiry(type, val) {
  if (type === 'text') {
    _ddpTextExpiry = val;
    const a = document.getElementById('ddpTextExpNever'), b = document.getElementById('ddpTextExp1day'), d30 = document.getElementById('ddpTextExp30day');
    if (a) a.classList.toggle('selected', val === 'never');
    if (b) b.classList.toggle('selected', val === '1day');
    if (d30) d30.classList.toggle('selected', val === '30days');
  } else {
    _ddpImgExpiry = val;
    const a = document.getElementById('ddpImgExpNever'), b = document.getElementById('ddpImgExp1day');
    if (a) a.classList.toggle('selected', val === 'never');
    if (b) b.classList.toggle('selected', val === '1day');
  }
}
/* (v27) 3-state reply mode: all | followers | off */
function ddpShareSelectReplyMode(val) {
  _ddpReplyMode = val;
  const a = document.getElementById('ddpReplyModeAll'), b = document.getElementById('ddpReplyModeFollowers'), c = document.getElementById('ddpReplyModeOff');
  if (a) a.classList.toggle('selected', val === 'all');
  if (b) b.classList.toggle('selected', val === 'followers');
  if (c) c.classList.toggle('selected', val === 'off');
}
function ddpShareSelectTextReplyMode(val) {
  _ddpReplyMode = val;
  const a = document.getElementById('ddpTextReplyModeAll'), b = document.getElementById('ddpTextReplyModeFollowers'), c = document.getElementById('ddpTextReplyModeOff');
  if (a) a.classList.toggle('selected', val === 'all');
  if (b) b.classList.toggle('selected', val === 'followers');
  if (c) c.classList.toggle('selected', val === 'off');
}
function ddpShareImagePreview(event) {
  const file = event.target.files ? event.target.files[0] : null;
  const wrap = document.getElementById('imagePreviewContainer');
  const img = document.getElementById('imagePreview');
  if (file && wrap && img) {
    const reader = new FileReader();
    reader.onload = function(e) { img.src = e.target.result; wrap.style.display = 'block'; };
    reader.readAsDataURL(file);
  } else if (wrap) { wrap.style.display = 'none'; }
}
function ddpTriggerVerify() {
  alert('✅ Verification: apka account mehfooz hai.\n\nZyada posts ke liye account verify karwana zaroori nahi — ye sirf aik itmenan ka nishan hai.');
}
function ddpShowRedStarInfo() {
  alert('★ Red Star: Mazedar aur trending posts par milta hai!\n\nTop 10 = Red Star ★\nHar Friday reset • Live ranking');
}
function ddpShowTemplatesInfo() {
  alert('📋 Image Templates jald aa rahe hain!');
}
/* ===== Explore category pills ===== */
var ddpFeedCategory = '';
var ddpTextPage = 1;
var ddpImagePage = 1;
var DDP_PAGE_SIZE = 20;
function ddpGetFeedPage(feedType) { return feedType === 'image' ? ddpImagePage : ddpTextPage; }
function ddpSetFeedPage(feedType, page) {
  if (page < 1) page = 1;
  if (feedType === 'image') ddpImagePage = page; else ddpTextPage = page;
  if (feedType === 'image') loadImageFeed(); else loadTextFeed();
  try { window.scrollTo(0, 0); } catch(e) {}
}
function ddpPagerHTML(feedType, totalPages) {
  const pg = ddpGetFeedPage(feedType);
  if (totalPages < 2) return '';
  let h = '<div class="ddp-pager">';
  h += '<button class="ddp-pager-btn" ' + (pg <= 1 ? 'disabled' : '') + ' onclick="ddpSetFeedPage(\'' + feedType + '\',' + (pg - 1) + ')">← Prev</button>';
  h += '<span class="ddp-pager-info">Page ' + pg + ' of ' + totalPages + '</span>';
  h += '<button class="ddp-pager-btn" ' + (pg >= totalPages ? 'disabled' : '') + ' onclick="ddpSetFeedPage(\'' + feedType + '\',' + (pg + 1) + ')">Next →</button>';
  h += '</div>';
  return h;
}
function ddpExplorePillsHTML(feedType) {
  let h = '<div class="ddp-explore-row"><span class="ddp-explore-label">Explore:</span><div class="ddp-explore-pills">';
  h += '<button class="ddp-cat-pill' + (!ddpFeedCategory ? ' active' : '') + '" onclick="ddpSetFeedCategory(\'\',\'' + feedType + '\')">All</button>';
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    h += '<button class="ddp-cat-pill' + (ddpFeedCategory === c ? ' active' : '') + '" onclick="ddpSetFeedCategory(\'' + c + '\',\'' + feedType + '\')">' + esc(c) + '</button>';
  }
  h += '</div></div>';
  return h;
}
function ddpSetFeedCategory(cat, feedType) {
  ddpFeedCategory = cat;
  ddpTextPage = 1; ddpImagePage = 1;
  if (feedType === 'image') loadImageFeed();
  else loadTextFeed();
}

/* ===== SHARE POST FUNCTIONS ===== */
async function shareTextPost() {
  const user = currentUserId;
  if (!user) { alert("Pehle login karein!"); return; }
  
  const textEl = document.getElementById('textPostArea');
  const categoryEl = document.getElementById('textTopicSelect');
  
  const text = textEl ? textEl.value.trim() : '';
  if (!text) { alert("Post likhein!"); return; }
  
  const category = categoryEl ? categoryEl.value : 'Random';
  
  const expiryVal = (typeof _ddpTextExpiry !== 'undefined') ? _ddpTextExpiry : '30days';
  const _rmode = (typeof _ddpReplyMode !== 'undefined') ? _ddpReplyMode : 'all';
  const repliesOff = (_rmode === 'off');
  
  const expiryTime = expiryVal === '1day' ? Date.now() + (24 * 60 * 60 * 1000) : (expiryVal === '30days' ? Date.now() + (30 * 24 * 60 * 60 * 1000) : null);
  
  try {
    const shareBtn = document.getElementById('ddpTextShareBtn');
    if (shareBtn) {
      shareBtn.textContent = 'SHARING...';
      shareBtn.disabled = true;
    }
    
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    
    await db.ref('posts').push({
      user_id: currentUserId,
      username: safeUser().username,
      text: text,
      category: category,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      likeCount: 0,
      comment_count: 0,
      expiryTime: expiryTime,
      replyRestriction: (_rmode === 'followers'),
      repliesOff: repliesOff
    });
    
    if (textEl) textEl.value = '';
    const charCounter = document.getElementById('textCharCount');
    if (charCounter) charCounter.textContent = '750 CHARS REMAINING';
    
    closeTextPostModal();
    
    if (shareBtn) {
      shareBtn.textContent = 'SHARE';
      shareBtn.disabled = false;
    }
    
    clearPostCache();
    
    alert("✅ Post shared successfully!");
    
    if (currentView === 'home') {
      if (currentTab === 'text') {
        await loadTextFeed();
      } else {
        const textTab = document.querySelector('.nav-tab[onclick*="text"]');
        if (textTab) {
          switchTab(textTab, 'text');
        } else {
          await loadTextFeed();
        }
      }
    } else {
      currentView = 'home';
      currentTab = 'text';
      showSortBar();
      const textTab2 = document.querySelector('.nav-tab[onclick*="text"]');
      if (textTab2) {
        textTab2.classList.add('active');
        const allTabs = document.querySelectorAll('.nav-tab');
        for (let i = 0; i < allTabs.length; i++) {
          if (allTabs[i] !== textTab2) allTabs[i].classList.remove('active');
        }
      }
      await loadTextFeed();
    }
    
  } catch(e) {
    console.error('Share error:', e);
    alert("Error sharing post: " + e.message);
    
    const shareBtn2 = document.getElementById('ddpTextShareBtn');
    if (shareBtn2) {
      shareBtn2.textContent = 'SHARE';
      shareBtn2.disabled = false;
    }
  }
}

async function shareImagePost() {
  const user = currentUserId;
  if (!user) { alert("Pehle login karein!"); return; }
  
  const fileInput = document.getElementById('imageFileInput');
  const file = fileInput ? fileInput.files[0] : null;
  if (!file) { alert("Image select karein!"); return; }
  
  const captionEl = document.getElementById('imageCaptionArea');
  const caption = captionEl ? captionEl.value.trim() : '';
  
  const categoryEl = document.getElementById('imgTopicSelect');
  const category = categoryEl ? categoryEl.value : 'Random';
  
  const expiryVal = (typeof _ddpImgExpiry !== 'undefined') ? _ddpImgExpiry : 'never';
  const _rmodeImg = (typeof _ddpReplyMode !== 'undefined') ? _ddpReplyMode : 'all';
  const repliesOff = (_rmodeImg === 'off');
  
  const expiryTime = expiryVal === '1day' ? Date.now() + (24 * 60 * 60 * 1000) : null;
  
  try {
    const shareBtn = document.getElementById('ddpImgShareBtn');
    if (shareBtn) {
      shareBtn.textContent = 'UPLOADING...';
      shareBtn.disabled = true;
    }
    
    const image_url = await uploadImageToCloudinary(file);
    
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    
    await db.ref('posts').push({
      user_id: currentUserId,
      username: safeUser().username,
      text: caption,
      image_url: image_url,
      category: category,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      likeCount: 0,
      comment_count: 0,
      expiryTime: expiryTime,
      replyRestriction: (_rmodeImg === 'followers'),
      repliesOff: repliesOff
    });
    
    if (captionEl) captionEl.value = '';
    if (fileInput) fileInput.value = '';
    const _pv = document.getElementById('imagePreviewContainer');
    if (_pv) _pv.style.display = 'none';
    const charCounter = document.getElementById('imageCharCount');
    if (charCounter) charCounter.textContent = '750 CHARS REMAINING';
    
    closeImagePostModal();
    
    if (shareBtn) {
      shareBtn.textContent = 'SHARE';
      shareBtn.disabled = false;
    }
    
    clearPostCache();
    
    alert("✅ Image post shared successfully!");
    
    if (currentView === 'home') {
      if (currentTab === 'images') {
        await loadImageFeed();
      } else {
        const imgTab = document.querySelector('.nav-tab[onclick*="images"]');
        if (imgTab) {
          switchTab(imgTab, 'images');
        } else {
          await loadImageFeed();
        }
      }
    } else {
      currentView = 'home';
      currentTab = 'images';
      showSortBar();
      const imgTab2 = document.querySelector('.nav-tab[onclick*="images"]');
      if (imgTab2) {
        imgTab2.classList.add('active');
        const allTabs = document.querySelectorAll('.nav-tab');
        for (let i = 0; i < allTabs.length; i++) {
          if (allTabs[i] !== imgTab2) allTabs[i].classList.remove('active');
        }
      }
      await loadImageFeed();
    }
    
  } catch(e) {
    console.error('Share error:', e);
    alert("Error: " + e.message);
    
    const shareBtn2 = document.getElementById('ddpImgShareBtn');
    if (shareBtn2) {
      shareBtn2.textContent = 'SHARE';
      shareBtn2.disabled = false;
    }
  }
}

/* ===== SHARE MODALS ===== */
function openShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) modal.classList.add('show-modal');
  if (typeof ddpBuildEmojiGrid === 'function') { try { ddpBuildEmojiGrid(); } catch(e) {} }
}

function closeShareModal(e) {
  const modal = document.getElementById('shareModal');
  if (!e || e.target === e.currentTarget) {
    if (modal) modal.classList.remove('show-modal');
  }
}

function openTextPostForm() {
  closeShareModal();
  if (typeof ddpResetReplyMode === 'function') ddpResetReplyMode();
  const modal = document.getElementById('textPostModal');
  if (modal) modal.classList.add('show-modal');
}

function openImagePostForm() {
  closeShareModal();
  if (typeof ddpResetReplyMode === 'function') ddpResetReplyMode();
  const modal = document.getElementById('imagePostModal');
  if (modal) modal.classList.add('show-modal');
}

function closeTextPostModal(e) {
  const modal = document.getElementById('textPostModal');
  if (!e || e.target === e.currentTarget) {
    if (modal) modal.classList.remove('show-modal');
  }
}

function closeImagePostModal(e) {
  const modal = document.getElementById('imagePostModal');
  if (!e || e.target === e.currentTarget) {
    if (modal) modal.classList.remove('show-modal');
  }
}

function switchImageTab(el, tab) {
  const tabs = document.querySelectorAll('#imagePostModal .tab-item');
  for (let i = 0; i < tabs.length; i++) { tabs[i].classList.remove('active'); }
  el.classList.add('active');
  const postImageTab = document.getElementById('postImageTab');
  const templatesTab = document.getElementById('templatesTab');
  if (postImageTab) postImageTab.classList.toggle('hidden', tab !== 'postImage');
  if (templatesTab) templatesTab.classList.toggle('hidden', tab !== 'templates');
}

function updateCharCount(id, cid) {
  const el = document.getElementById(id);
  const counter = document.getElementById(cid);
  if (el && counter) counter.textContent = (750 - el.value.length) + ' CHARS REMAINING';
}

/* ===== PASSWORD CHANGE ===== */
function openChangePasswordModal() {
  const modal = document.getElementById('passwordModal');
  if (modal) modal.classList.add('show');
  const cp = document.getElementById('currentPassword');
  const np = document.getElementById('newPassword');
  const cnp = document.getElementById('confirmNewPassword');
  if (cp) cp.value = '';
  if (np) np.value = '';
  if (cnp) cnp.value = '';
  const err = document.getElementById('passwordError');
  const suc = document.getElementById('passwordSuccess');
  if (err) err.style.display = 'none';
  if (suc) suc.style.display = 'none';
}

function closePasswordModal(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById('passwordModal');
  if (modal) modal.classList.remove('show');
}

async function changePassword() {
  const cp = document.getElementById('currentPassword');
  const np = document.getElementById('newPassword');
  const cnp = document.getElementById('confirmNewPassword');
  const err = document.getElementById('passwordError');
  const suc = document.getElementById('passwordSuccess');
  
  if (!cp || !np || !cnp || !err || !suc) return;
  
  err.style.display = 'none';
  suc.style.display = 'none';
  
  if (!cp.value) { err.textContent = 'Enter current password'; err.style.display = 'block'; return; }
  if (np.value.length < 6) { err.textContent = 'Min 6 characters'; err.style.display = 'block'; return; }
  if (np.value !== cnp.value) { err.textContent = 'Passwords do not match'; err.style.display = 'block'; return; }
  
  try {
    const { auth } = getFirebase();
    if (!auth) throw new Error('Firebase not ready');
    const user = auth.currentUser;
    if (!user) throw new Error('No user');
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, cp.value);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(np.value);
    suc.textContent = '✅ Password changed!';
    suc.style.display = 'block';
    setTimeout(function() { closePasswordModal(); }, 2000);
  } catch(e) {
    err.textContent = 'Current password is incorrect';
    err.style.display = 'block';
  }
}

/* ===== BLOCK ENFORCEMENT (2026-10-02) =====
   Pehle blockedUsers sirf save hoti thi, kahin check nahi hoti thi —
   is liye block ke baad bhi msg/comment/invite chala jata tha.
   Ye helpers har interaction par dono taraf ka block check karte hain. */
let _myBlockedCache = null;
let _myBlockedTime = 0;

async function getMyBlockedList() {
  if (!currentUserId) return [];
  if (_myBlockedCache && (Date.now() - _myBlockedTime) < 60000) return _myBlockedCache;
  try {
    const { db } = getFirebase();
    if (!db) return _myBlockedCache || [];
    const snap = await db.ref('users/' + currentUserId + '/blockedUsers').once('value');
    _myBlockedCache = snap.val() || [];
    _myBlockedTime = Date.now();
    return _myBlockedCache;
  } catch(e) { return _myBlockedCache || []; }
}

function invalidateBlockedCache() {
  _myBlockedCache = null;
  _myBlockedTime = 0;
}

/* true agar a aur b me se kisi ne bhi doosre ko block kiya ho */
async function isBlockedBetween(a, b) {
  if (!a || !b || a === b) return false;
  try {
    const { db } = getFirebase();
    if (!db) return false;
    const la = (a === currentUserId)
      ? await getMyBlockedList()
      : ((await db.ref('users/' + a + '/blockedUsers').once('value')).val() || []);
    if (la.indexOf(b) !== -1) return true;
    const lb = (b === currentUserId)
      ? await getMyBlockedList()
      : ((await db.ref('users/' + b + '/blockedUsers').once('value')).val() || []);
    return lb.indexOf(a) !== -1;
  } catch(e) { return false; }
}

/* 1on1 send guard: chat 'left' ho chuki ho ya block ho to bhejna roko.
   true return kare to caller send rok de. */
async function chatSendBlocked(otherUid) {
  if (!currentChatId) return true;
  try {
    const { db } = getFirebase();
    if (db) {
      const st = await db.ref('1on1_chats/' + currentChatId + '/status').once('value');
      if (st.val() === 'left') {
        alert('🧹 Ye chat khatam ho chuki hai (leave ho chuki hai).');
        return true;
      }
    }
  } catch(e) {}
  if (otherUid && await isBlockedBetween(currentUserId, otherUid)) {
    alert('🚫 Is user ke sath interaction blocked hai.');
    return true;
  }
  return false;
}

/* ===== BLOCK USER PROFILE ===== */
function blockUserProfile(uid) {
  if (!confirm('Block this user? You will no longer see their posts, comments, or notifications.')) return;
  
  RateLimiter.canPerform('blocks', 10);
  
  const { db } = getFirebase();
  if (!db) return;
  
  db.ref('users/' + currentUserId + '/blockedUsers').once('value').then(async function(snap) {
    let list = snap.val() || [];
    if (list.indexOf(uid) === -1) {
      list.push(uid);
      await db.ref('users/' + currentUserId + '/blockedUsers').set(list);
      
      const updates = {};
      updates['followers/' + currentUserId + '/' + uid] = null;
      updates['following/' + currentUserId + '/' + uid] = null;
      updates['followers/' + uid + '/' + currentUserId] = null;
      updates['following/' + uid + '/' + currentUserId] = null;
      
      const notifSnap = await db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value');
      notifSnap.forEach(function(doc) {
        if (doc.val().fromUid === uid) {
          updates['notifications/' + doc.key] = null;
        }
      });
      
      await db.ref().update(updates);
      invalidateBlockedCache();
      clearPostCache();
      alert('User blocked! 🚫');
      updateInboxBadge();
    }
    if (_profileUid === uid) loadProfile(currentUserId);
    else if (currentView === 'profile') loadProfile(_profileUid);
  });
}

function goToUserProfile(uid) {
  goToProfileInternal(uid, false);
}


/* ===== v147 block (orig theme lines 5643-6516) ===== */

/* ===== 1on1 CHAT SYSTEM ===== */
function openMyChatsList() {
  const chatList = document.getElementById('chatListScreen');
  if (chatList) chatList.style.display = 'flex';
  const mainContent = document.getElementById('main-content-area');
  if (mainContent) mainContent.style.display = 'none';
  hideSortBar();
  loadActiveChats();
  listenForInvites();
}

function closeChatList() {
  const chatList = document.getElementById('chatListScreen');
  if (chatList) chatList.style.display = 'none';
  const mainContent = document.getElementById('main-content-area');
  if (mainContent) mainContent.style.display = '';
  if (currentView === 'home') showSortBar();
}

async function loadActiveChats() {
  const container = document.getElementById('activeChatsList');
  if (!container || !currentUserId) return;
  
  try {
    const { db } = getFirebase();
    if (!db) return;
    const chatCacheKey = 'chats_' + currentUserId;
    if (window._chatCache && window._chatCache[chatCacheKey] && Date.now() - window._chatCacheTime[chatCacheKey] < 15000) {
      container.innerHTML = window._chatCache[chatCacheKey];
      return;
    }
    const snap = await db.ref('1on1_chats').once('value');
    const chats = [];
    snap.forEach(function(c) {
      const d = c.val();
      if (d.participants && d.participants[currentUserId] && d.status !== 'left') {
        let otherUid = null;
        for (let uid in d.participants) {
          if (d.participants.hasOwnProperty(uid) && uid !== currentUserId) {
            otherUid = uid;
            break;
          }
        }
        if (otherUid) {
          chats.push({ id: c.key, otherUid: otherUid, lastMsg: d.lastMsg || '', lastTime: d.lastTime || 0 });
        }
      }
    });
    
    if (chats.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">No active chats yet</p>';
      return;
    }
    
    /* Perf: fetch all chat peer profiles in parallel instead of one
       sequential round-trip per chat. */
    const peers = await Promise.all(chats.map(function(ch) { return UserCache.get(ch.otherUid); }));

    /* (2026-10-02) Blocked users ki chats list me na dikhao (dono taraf) */
    const myBlocked = await getMyBlockedList();
    for (let ci = chats.length - 1; ci >= 0; ci--) {
      const peerData = peers[ci] || {};
      if (myBlocked.indexOf(chats[ci].otherUid) !== -1 ||
          (peerData.blockedUsers || []).indexOf(currentUserId) !== -1) {
        chats.splice(ci, 1);
        peers.splice(ci, 1);
      }
    }
    if (chats.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">No active chats yet</p>';
      return;
    }

    let html = '';
    for (let i = 0; i < chats.length; i++) {
      const ch = chats[i];
      const u = peers[i];
      const name = (u && u.username) || 'User';
      const dp = ddpThumbUrl(safeUrl(u?.profilePic), 100);
      
      html += '<div onclick="openChatScreen(\'' + ch.id + '\',\'' + ch.otherUid + '\',\'' + escAttrJS(name) + '\')" style="display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #f3f4f6;cursor:pointer;">';
      if (dp) {
        html += '<img src="' + dp + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"/>';
      }
      html += '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#06b6d4,#22d3ee);display:' + (dp ? 'none' : 'flex') + ';align-items:center;justify-content:center;color:#fff;font-weight:700;">' + name.charAt(0).toUpperCase() + '</div>';
      html += '<div style="flex:1;"><div style="font-weight:700;font-size:14px;">' + esc(name) + '</div><div style="font-size:11px;color:#94a3b8;">' + (ch.lastMsg ? esc(ch.lastMsg.substring(0, 40)) : 'No messages yet') + '</div></div>';
      html += '<span style="font-size:10px;color:#94a3b8;">' + (ch.lastTime ? timeAgo(new Date(ch.lastTime)) : '') + '</span></div>';
    }
    container.innerHTML = html;
    if (!window._chatCache) window._chatCache = {};
    if (!window._chatCacheTime) window._chatCacheTime = {};
    window._chatCache[chatCacheKey] = html;
    window._chatCacheTime[chatCacheKey] = Date.now();
  } catch(e) {}
}

function startChatWith(uid) {
  open1on1Invite(uid);
}

function open1on1Invite(targetId) {
  if (!currentUserId) { alert('Login required!'); return; }
  currentTargetUid = targetId;
  const modal = document.getElementById('invite1on1Modal');
  if (modal) modal.style.display = 'flex';
}

function close1on1Modal(e) {
  if (e && e.target !== e.currentTarget && e.target !== document.getElementById('invite1on1Modal')) return;
  const modal = document.getElementById('invite1on1Modal');
  if (modal) modal.style.display = 'none';
}

async function process1on1Invite(identityType) {
  const senderId = currentUserId;
  const senderName = identityType === 'secret' ? (safeUser().username || 'User').charAt(0) : (safeUser().username || 'User');
  const { db } = getFirebase();
  if (!db) return;
  try {
    /* (2026-10-02) Block check — blocked user invite nahi bhej sakta */
    if (await isBlockedBetween(senderId, currentTargetUid)) {
      alert('🚫 Is user ke sath interaction blocked hai.');
      close1on1Modal();
      return;
    }
    /* (v24) Followers-only 1on1 privacy */
    try {
      const _foSnap = await db.ref('users/' + currentTargetUid + '/followersOnly1on1').once('value');
      if (_foSnap.val()) {
        const _fSnap = await db.ref('followers/' + currentTargetUid + '/' + senderId).once('value');
        if (!_fSnap.exists()) {
          alert('🔒 Is user ne followers-only 1on1 on kiya hai. Pehle unhe follow karein.');
          close1on1Modal();
          return;
        }
      }
    } catch(e) {}
    /* (2026-10-02) Duplicate invite roko: invite pehle se pending hai to
       dobara notification na bhejo, sirf bata do */
    const existingInvite = await db.ref('1on1_invites/' + currentTargetUid + '/' + senderId).once('value');
    if (existingInvite.exists()) {
      alert('⏳ Invite pehle se bheja hua hai — abhi pending hai.');
      close1on1Modal();
      return;
    }
    /* Pehle se active chat hai to naya invite bekaar hai */
    const chatIdPre = senderId < currentTargetUid ? senderId + '_' + currentTargetUid : currentTargetUid + '_' + senderId;
    const chatSnapPre = await db.ref('1on1_chats/' + chatIdPre).once('value');
    if (chatSnapPre.exists() && chatSnapPre.val().status === 'active') {
      alert('💬 Aap pehle se is user ke sath chat me hain.');
      close1on1Modal();
      return;
    }
    await db.ref('1on1_invites/' + currentTargetUid + '/' + senderId).set({
      senderId: senderId,
      senderName: senderName,
      receiverId: currentTargetUid,
      status: 'pending',
      type: identityType,
      timestamp: Date.now()
    });
    await db.ref('notifications').push({
      toUid: currentTargetUid,
      fromUid: senderId,
      sender_name: senderName || 'Someone',
      type: '1on1_invite',
      message: (senderName || 'Someone') + ' invited you to 1on1 chat',
      timestamp: Date.now(),
      read: false
    });
    updateInboxBadge();
    alert('✅ Invite sent!');
    close1on1Modal();
  } catch(e) { alert('Error: ' + e.message); }
}

function listenForInvites() {
  if (!currentUserId) return;
  if (chatInviteListener) chatInviteListener.off();
  const { db } = getFirebase();
  if (!db) return;
  getMyBlockedList(); /* cache garam karo taake neeche filter chal sake */
  chatInviteListener = db.ref('1on1_invites/' + currentUserId);
  chatInviteListener.on('value', function(snap) {
    const list = document.getElementById('invitesList');
    const section = document.getElementById('invitesSection');
    if (!list || !section) return;
    list.innerHTML = '';
    if (snap.exists()) {
      let shownInvites = 0;
      snap.forEach(function(c) {
        const d = c.val();
        /* (2026-10-02) Blocked user ka invite na dikhao */
        if (_myBlockedCache && _myBlockedCache.indexOf(d.senderId) !== -1) return;
        shownInvites++;
        list.innerHTML += '<div class="invite-card"><div style="display:flex;align-items:center;gap:8px;"><div class="invite-card-avatar">' + (d.senderName || 'U').charAt(0).toUpperCase() + '</div><div><span style="font-weight:700;font-size:13px;">' + esc(d.senderName || 'User') + '</span><br/><span style="font-size:10px;color:#94a3b8;">invited you</span></div></div><div style="display:flex;gap:6px;"><button class="invite-accept-btn" onclick="accept1on1(\'' + c.key + '\',\'' + escAttrJS(d.senderName || 'User') + '\')">Accept</button><button class="invite-reject-btn" onclick="reject1on1(\'' + c.key + '\')">Reject</button></div></div>';
      });
      section.style.display = shownInvites > 0 ? 'block' : 'none';
    } else {
      section.style.display = 'none';
    }
  });
}

async function accept1on1(senderId, senderName) {
  const chatId = currentUserId < senderId ? currentUserId + '_' + senderId : senderId + '_' + currentUserId;
  const { db } = getFirebase();
  if (!db) return;
  try {
    /* (2026-10-02) Blocked user ka invite accept na ho */
    if (await isBlockedBetween(currentUserId, senderId)) {
      alert('🚫 Is user ke sath interaction blocked hai.');
      return;
    }
    const participants = {};
    participants[currentUserId] = true;
    participants[senderId] = true;
    await db.ref('1on1_chats/' + chatId).set({
      participants: participants,
      status: 'active',
      allowImages: true,
      createdAt: Date.now()
    });
    await db.ref('1on1_invites/' + currentUserId + '/' + senderId).remove();
    alert('✅ Accepted! Opening chat...');
    openChatScreen(chatId, senderId, senderName);
  } catch(e) { alert('Error: ' + e.message); }
}

async function reject1on1(senderId) {
  const { db } = getFirebase();
  if (!db) return;
  try {
    await db.ref('1on1_invites/' + currentUserId + '/' + senderId).remove();
    alert('Invite rejected');
  } catch(e) { alert('Error: ' + e.message); }
}

async function accept1on1FromInbox(senderId, senderName, notifId) {
  const chatId = currentUserId < senderId ? currentUserId + '_' + senderId : senderId + '_' + currentUserId;
  const { db } = getFirebase();
  if (!db) return;
  try {
    /* (2026-10-02) Blocked user ka invite accept na ho */
    if (await isBlockedBetween(currentUserId, senderId)) {
      alert('🚫 Is user ke sath interaction blocked hai.');
      return;
    }
    const participants = {};
    participants[currentUserId] = true;
    participants[senderId] = true;
    await db.ref('1on1_chats/' + chatId).set({
      participants: participants,
      status: 'active',
      allowImages: true,
      createdAt: Date.now()
    });
    await db.ref('1on1_invites/' + currentUserId + '/' + senderId).remove();
    await db.ref('notifications/' + notifId).remove();
    updateInboxBadge();
    alert('✅ Accepted! Opening chat...');
    openChatScreen(chatId, senderId, senderName);
  } catch(e) { alert('Error: ' + e.message); }
}

async function reject1on1FromInbox(senderId, notifId) {
  const { db } = getFirebase();
  if (!db) return;
  try {
    await db.ref('1on1_invites/' + currentUserId + '/' + senderId).remove();
    await db.ref('notifications/' + notifId).remove();
    updateInboxBadge();
    loadInboxActivity();
    alert('Invite rejected');
  } catch(e) { alert('Error: ' + e.message); }
}

/* (v150) 1on1 last seen: chat kholte hi apna seen-time likho (60s me aik dafa refresh jab chat khula ho); header me doosre user ka "Last seen ..." dikhao. Rules: 1on1_chats/$chatId .write = auth != null, is liye rules change nahi chahiye; lastSeen sirf is chat ke andar dikhta hai. */
function ddpMarkChatSeen(chatId) {
  try {
    if (!chatId || !currentUserId) return;
    const now = Date.now();
    if (window._ddpSeenChat === chatId && window._ddpSeenWriteAt && (now - window._ddpSeenWriteAt) < 60000) return;
    window._ddpSeenChat = chatId; window._ddpSeenWriteAt = now;
    const fb = getFirebase(); const db = fb && fb.db;
    if (db) db.ref('1on1_chats/' + chatId + '/lastSeen/' + currentUserId).set(firebase.database.ServerValue.TIMESTAMP).catch(function(){});
  } catch(e) {}
}
function ddpRenderChatStatus() {
  try {
    const statusEl = document.getElementById('chatStatus');
    if (!statusEl) return;
    if (window._ddpOtherOnline) { statusEl.innerHTML = '<span style="color:#4ade80;">●</span> online'; return; }
    const ls = window._ddpOtherLastSeen || window._ddpOtherGlobalSeen || 0;
    if (ls) { statusEl.innerHTML = '<span style="color:#94a3b8;">●</span> Last seen ' + timeAgo(new Date(Number(ls))); return; }
    statusEl.innerHTML = '<span style="color:#94a3b8;">●</span> offline';
  } catch(e) {}
}
function ddpRefreshSeenTick() {
  try {
    const ls = window._ddpOtherLastSeen || 0;
    const ticks = document.querySelectorAll('.ddp-seen-tick');
    for (let i = 0; i < ticks.length; i++) {
      const ts = parseInt(ticks[i].getAttribute('data-ts') || '0', 10);
      ticks[i].textContent = (ls && ts && ls >= ts) ? '✓✓ Seen' : '';
    }
  } catch(e) {}
}
function openChatScreen(chatId, otherUid, otherName) {
  currentChatId = chatId;
  window._chatLeft = false;
  /* (2026-10-02) Blocked user ki chat open hi na ho */
  isBlockedBetween(currentUserId, otherUid).then(function(blocked) {
    if (blocked && currentChatId === chatId) {
      alert('🚫 Is user ke sath interaction blocked hai.');
      closeChatScreen();
    }
  });
  closeChatList();
  const mainContent = document.getElementById('main-content-area');
  if (!mainContent) return;
  mainContent.style.display = '';
  hideSortBar();
  
  let html = '<div class="chat-fullscreen" id="chatFullscreen">';
  html += '<div class="chat-header"><div class="chat-header-left"><span style="font-size:18px;margin-right:8px;cursor:pointer;" onclick="closeChatScreen()">←</span><div class="chat-header-avatar" id="chatHeaderAvatar" style="cursor:pointer;" onclick="openProfileFrom1on1(\'' + escAttrJS(otherUid) + '\')">' + esc(otherName).charAt(0).toUpperCase() + '</div><div style="cursor:pointer;" onclick="openProfileFrom1on1(\'' + escAttrJS(otherUid) + '\')"><div class="chat-header-name">' + esc(otherName) + '</div><div class="chat-header-status" id="chatStatus"><span style="color:#94a3b8;">●</span> …</div></div></div><button onclick="leave1on1()" style="background:rgba(239,68,68,.2);color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;">Leave</button></div>';
  html += '<div class="chat-settings-bar"><button id="imgPermissionBtn" onclick="toggleImagePermission()">🖼️ Images: ON</button></div>';
  html += '<div class="chat-messages" id="chatMessages" style="flex-direction:column;"><p style="text-align:center;color:#94a3b8;padding:20px;">Loading messages...</p></div>';
  html += '<div class="chat-sticker-bar"><button class="chat-sticker-btn" onclick="sendAction(\'heart\')" style="background:#fee2e2;">❤️ Dharkan</button><button class="chat-sticker-btn" onclick="sendAction(\'angry\')" style="background:#fef3c7;">😡 Gussa</button><button class="chat-sticker-btn" onclick="sendAction(\'smile\')" style="background:#d1fae5;">😂 Hansi</button><button class="chat-sticker-btn" onclick="sendAction(\'sad\')" style="background:#dbeafe;">😢 Udasi</button></div>';
  html += '<div id="chatImgPreview" style="display:none"></div><div class="chat-input-bar"><label class="chat-img-btn" id="chatImgLabel">🖼️<input type="file" id="chatImageInput" style="display:none" accept="image/*" onchange="ddpChatImgPreview(this)"/></label><input type="text" id="chatMessageInput" placeholder="Write something..." onkeypress="if(event.key===\'Enter\')sendTextMessage()"/><button class="chat-send-btn" onclick="sendTextMessage()">➤</button></div></div>';
  
  mainContent.innerHTML = html;
  
  getUserDp(otherUid).then(function(dp) {
    dp = ddpThumbUrl(safeUrl(dp), 100);
    if (dp) {
      const avatar = document.getElementById('chatHeaderAvatar');
      if (avatar) avatar.innerHTML = '<img src="' + dp + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;"/>';
    }
  });
  
  listenMessages(chatId);
  /* (v150) Apna last-seen likho - doosre ko pata chale tum ne chat kholi. */
  ddpMarkChatSeen(chatId);
  listenForPermissions();
  checkAndCleanupChat(chatId);
  updateImagePermissionUI(chatId);
  
  const { db } = getFirebase();
  if (db) {
    if (window._chatStatusRef) { window._chatStatusRef.off('value', window._chatStatusCb); }
    window._chatStatusRef = db.ref('status/' + otherUid);
    window._chatStatusCb = function(snap) {
      const s = snap.val();
      /* Presence fix: 'state' stayed 'online' forever when a user closed the tab/
         browser without tapping Logout (nothing cleared it server-side). A live
         user heartbeats every 2 min, so only trust 'online' with a fresh
         last_active (5 min tolerance); otherwise show offline. */
      const lastActive = (s && s.last_active) ? Number(s.last_active) : 0;
      const fresh = lastActive > 0 && (Date.now() - lastActive) < 5 * 60 * 1000;
      window._ddpOtherOnline = !!(s && s.state === 'online' && fresh);
      /* (v150) Global lastSeen fallback: agar is chat ka seen-time na ho to ye dikhao. */
      window._ddpOtherGlobalSeen = (s && s.lastSeen) ? Number(s.lastSeen) || 0 : 0;
      ddpRenderChatStatus();
    };
    window._chatStatusRef.on('value', window._chatStatusCb, function() {
      /* If the status node cannot be read (e.g. database rules deny it), never
         leave the header showing a false "online" — fall back to offline. */
      const statusEl = document.getElementById('chatStatus');
      if (statusEl) statusEl.innerHTML = '<span style="color:#94a3b8;">●</span> offline';
    });
  }
}

function closeChatScreen() {
  /* (v145) Audit fix: preview blob leak rokne ke liye */
  try { ddpChatImgClear(); } catch(e) {}
  if (window._chatStatusRef && window._chatStatusCb) { window._chatStatusRef.off('value', window._chatStatusCb); window._chatStatusRef = null; window._chatStatusCb = null; }
  if (window._permRef && window._permCb) { window._permRef.off('value', window._permCb); window._permRef = null; window._permCb = null; }
  if (window._cleanupRef && window._cleanupCb) { window._cleanupRef.off('value', window._cleanupCb); window._cleanupRef = null; window._cleanupCb = null; }
  if (chatListener) { chatListener.off(); chatListener = null; }
  if (window._chatMetaRef) { window._chatMetaRef.off(); window._chatMetaRef = null; }
  /* (v150) Last-seen state reset - agle chat me purana na dikhe. */
  window._ddpOtherOnline = false; window._ddpOtherLastSeen = 0; window._ddpOtherGlobalSeen = 0;
  window._ddpSeenChat = null; window._ddpSeenWriteAt = 0;
  const mainContent = document.getElementById('main-content-area');
  if (mainContent) mainContent.innerHTML = '';
  currentChatId = null;
  if (currentView === 'home') { showSortBar(); if (currentTab === 'text') loadTextFeed(); else loadImageFeed(); }
  else if (currentView === 'profile' && _profileUid) loadProfile(_profileUid);
}

async function sendTextMessage() {
  const input = document.getElementById('chatMessageInput');
  const text = input ? input.value.trim() : '';
  if (!text || !currentChatId) return;

  const ids = currentChatId.split('_');
  const otherUid = (ids[0] === currentUserId) ? ids[1] : ids[0];

  /* (2026-10-02) Chat left ho chuki ho ya block ho to msg na bhejo */
  if (await chatSendBlocked(otherUid)) return;

  const { db } = getFirebase();
  if (!db) return;
  
  db.ref('1on1_messages/' + currentChatId).push({
    senderId: currentUserId,
    senderName: safeUser().username,
    senderDp: safeUser().profilePic || '',
    text: text,
    type: 'text',
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    hidden: false
  });
  
  db.ref('1on1_chats/' + currentChatId).update({
    lastMsg: text,
    lastTime: firebase.database.ServerValue.TIMESTAMP
  });
  
  dismissChatNotifications(otherUid);
  
  if (otherUid && otherUid !== currentUserId) {
    db.ref('notifications').push({
      toUid: otherUid,
      fromUid: currentUserId,
      sender_name: safeUser().username,
      type: '1on1_reply',
      message: (safeUser().username) + ' sent you a message: "' + text.substring(0, 50) + '"',
      replyPreview: text,
      chatId: currentChatId,
      timestamp: Date.now(),
      read: false
    }).catch(function(e) { console.error('Notification error:', e); });
  }
  
  if (input) input.value = '';
}

async function hideChatMessage(msgId) {
  if (!confirm('Hide this message?')) return;
  const { db } = getFirebase();
  if (!db) return;
  await db.ref('1on1_messages/' + currentChatId + '/' + msgId).update({ hidden: true });
}

function getStickerStyle(type) {
  switch(type) {
    case 'heart': return 'background:linear-gradient(135deg,#fee2e2,#fecaca);border:2px solid #fca5a5;';
    case 'angry': return 'background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #f59e0b;';
    case 'smile': return 'background:linear-gradient(135deg,#d1fae5,#a7f3d0);border:2px solid #6ee7b7;';
    case 'sad': return 'background:linear-gradient(135deg,#dbeafe,#c7d2fe);border:2px solid #93c5fd;';
    default: return '';
  }
}

/* (v123) 1on1 se profile: chat listeners detach karke profile kholo (closeChatScreen ka view-restore nahi, taake feed reload race na ho) */
function openProfileFrom1on1(uid) {
  if (window._chatStatusRef && window._chatStatusCb) { window._chatStatusRef.off('value', window._chatStatusCb); window._chatStatusRef = null; window._chatStatusCb = null; }
  if (window._permRef && window._permCb) { window._permRef.off('value', window._permCb); window._permRef = null; window._permCb = null; }
  if (window._cleanupRef && window._cleanupCb) { window._cleanupRef.off('value', window._cleanupCb); window._cleanupRef = null; window._cleanupRef = null; }
  if (chatListener) { chatListener.off(); chatListener = null; }
  if (window._chatMetaRef) { window._chatMetaRef.off(); window._chatMetaRef = null; }
  currentChatId = null;
  const _mc = document.getElementById('main-content-area');
  if (_mc) _mc.innerHTML = '';
  goToUserProfile(uid);
}

function renderMessage(data) {
  const container = document.getElementById('chatMessages');
  if (!container || !data) return;
  
  if (data.hidden) {
    container.innerHTML += '<div class="chat-action-msg" style="opacity:0.5;"><em>Chat mita di gai hai</em></div>';
    return;
  }
  
  const isOwn = (data.senderId === currentUserId);
  const timeText = data.timestamp ? timeAgo(new Date(data.timestamp)) : '';
  
  if (data.type === 'action') {
    const stickerStyle = getStickerStyle(data.stickerType || '');
    container.innerHTML += '<div class="chat-action-msg" style="' + stickerStyle + 'padding:10px 16px;border-radius:20px;margin:4px 0;font-weight:600;font-size:12px;text-align:center;">' + esc(data.text || '') + ' • ' + timeText + '</div>';
    return;
  }
  
  const senderDp = ddpThumbUrl(safeUrl(data.senderDp), 100);
  const senderName = data.senderName || 'User';
  
  let msgHtml = '<div class="chat-msg-row ' + (isOwn ? 'own' : 'other') + '" id="chatmsg_' + (data.id || '') + '">';
  
  if (!isOwn) {
    if (senderDp) {
      msgHtml += '<img src="' + senderDp + '" class="chat-msg-avatar" style="object-fit:cover;cursor:pointer;" onclick="openProfileFrom1on1(\'' + escAttrJS(data.senderId) + '\')" onerror="this.style.display=\'none\';this.parentElement.querySelector(\'.chat-msg-avatar-fallback\').style.display=\'flex\';"/>';
    }
    msgHtml += '<div class="chat-msg-avatar chat-msg-avatar-fallback" style="display:' + (senderDp ? 'none' : 'flex') + ';align-items:center;justify-content:center;cursor:pointer;" onclick="openProfileFrom1on1(\'' + escAttrJS(data.senderId) + '\')">' + senderName.charAt(0).toUpperCase() + '</div>';
  }
  
  msgHtml += '<div style="flex:1;min-width:0;"><div class="chat-msg-bubble">';
  if (data.replyTo && data.replyTo.text) {
    /* (v36) 1on1 quote bhi clickable: original message par jump */
    const _cqjump = (data.replyTo.msgId) ? ' style="background:#e8e8e8;border-left:3px solid #6366f1;padding:4px 8px;margin-bottom:6px;border-radius:4px;font-size:12px;color:#1e293b;cursor:pointer;" title="Original message dekhein" onclick="event.stopPropagation();ddpJumpToMsg(\'' + escAttrJS(data.replyTo.msgId) + '\')"' : ' style="background:#e8e8e8;border-left:3px solid #6366f1;padding:4px 8px;margin-bottom:6px;border-radius:4px;font-size:12px;color:#1e293b;"';
    msgHtml += '<div' + _cqjump + '><span style="font-weight:600;color:#6366f1;">↳ ' + esc(data.replyTo.user) + ':</span> ' + esc(data.replyTo.text.substring(0, 80)) + '</div>';
  }
  msgHtml += ddpEmojify(esc(data.text || ''));
  if (safeUrl(data.imageUrl)) {
    msgHtml += '<br/><img src="' + ddpThumbUrl(safeUrl(data.imageUrl), 400) + '" loading="lazy" style="max-width:200px;border-radius:8px;margin-top:4px;" onclick="showFullImage(\'' + safeUrl(data.imageUrl) + '\')"/>';
  }
  msgHtml += '</div><div style="display:flex;align-items:center;gap:8px;margin-top:2px;"><span class="chat-msg-time">' + timeText + '</span>';
  if (isOwn) {
    const _seenNow = (window._ddpOtherLastSeen && data.timestamp && window._ddpOtherLastSeen >= data.timestamp) ? '✓✓ Seen' : '';
    msgHtml += '<span class="ddp-seen-tick" data-ts="' + (data.timestamp || 0) + '" style="font-size:9px;color:#22c55e;font-weight:700;">' + _seenNow + '</span>';
  }
  msgHtml += '<button onclick="showChatReplyBox(\'' + data.id + '\',\'' + escAttrJS(senderName) + '\')" style="font-size:9px;padding:2px 8px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;color:#4f46e5;">↩ Reply</button>';
  if (isOwn) {
    msgHtml += '<button onclick="hideChatMessage(\'' + data.id + '\')" style="font-size:9px;padding:2px 8px;border-radius:10px;border:1px solid #fca5a5;background:#fff;cursor:pointer;color:#ef4444;">🗑 Hide</button>';
  }
  msgHtml += '</div><div class="inline-reply-box" id="chatReplyBox_' + data.id + '" style="display:none;margin-top:4px;"><input id="chatReplyInput_' + data.id + '" placeholder="Reply to ' + escAttr(senderName) + '..." style="width:100%;padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:14px;font-size:11px;"/><button onclick="sendChatReply(\'' + data.id + '\',\'' + escAttrJS(senderName) + '\')" style="margin-top:3px;background:#6366f1;color:#fff;border:none;padding:4px 10px;border-radius:12px;font-size:10px;cursor:pointer;">Send</button></div></div>';
  
  if (isOwn) {
    const ownDp = ddpThumbUrl(safeUrl(safeUser().profilePic), 100);
    if (ownDp) {
      msgHtml += '<img src="' + ownDp + '" class="chat-msg-avatar" style="object-fit:cover;cursor:pointer;" onclick="openProfileFrom1on1(\'' + escAttrJS(currentUserId) + '\')"/>';
    }
    msgHtml += '<div class="chat-msg-avatar chat-msg-avatar-fallback" style="display:' + (ownDp ? 'none' : 'flex') + ';align-items:center;justify-content:center;cursor:pointer;" onclick="openProfileFrom1on1(\'' + escAttrJS(currentUserId) + '\')">' + (safeUser().username || 'U').charAt(0).toUpperCase() + '</div>';
  }
  
  msgHtml += '</div>';
  container.innerHTML += msgHtml;
}

function showChatReplyBox(msgId, username) {
  const box = document.getElementById('chatReplyBox_' + msgId);
  if (!box) return;
  const input = document.getElementById('chatReplyInput_' + msgId);
  if (box.style.display === 'none' || box.style.display === '') {
    box.style.display = 'block';
    if (input) input.focus();
  } else {
    box.style.display = 'none';
  }
}

async function sendChatReply(originalMsgId, originalUser) {
  const input = document.getElementById('chatReplyInput_' + originalMsgId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  
  const ids = currentChatId.split('_');
  const otherUid = (ids[0] === currentUserId) ? ids[1] : ids[0];

  /* (2026-10-02) Chat left/block ho to reply na bhejo */
  if (await chatSendBlocked(otherUid)) return;

  let quotedText = '';
  const { db } = getFirebase();
  if (db) {
    try {
      const origDoc = await db.ref('1on1_messages/' + currentChatId + '/' + originalMsgId).once('value');
      if (origDoc.exists()) {
        const od = origDoc.val();
        if (od.text) quotedText = od.text;
        else if (od.imageUrl) quotedText = '📷 Image';
      }
    } catch(e) {}
  }
  
  if (!db) return;
  await db.ref('1on1_messages/' + currentChatId).push({
    senderId: currentUserId,
    senderName: safeUser().username,
    senderDp: safeUser().profilePic || '',
    text: text,
    type: 'text',
    replyTo: { msgId: originalMsgId, user: originalUser, text: quotedText },
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    hidden: false
  });
  
  db.ref('1on1_chats/' + currentChatId).update({
    lastMsg: text,
    lastTime: firebase.database.ServerValue.TIMESTAMP
  });
  
  dismissChatNotifications(otherUid);
  
  if (otherUid && otherUid !== currentUserId) {
    db.ref('notifications').push({
      toUid: otherUid,
      fromUid: currentUserId,
      sender_name: safeUser().username,
      type: '1on1_reply',
      message: (safeUser().username) + ' replied: "' + text.substring(0, 50) + '"',
      replyPreview: text,
      chatId: currentChatId,
      timestamp: Date.now(),
      read: false
    }).catch(function(e) { console.error('Notification error:', e); });
  }
  
  input.value = '';
  const box = document.getElementById('chatReplyBox_' + originalMsgId);
  if (box) box.style.display = 'none';
}

function listenMessages(chatId) {
  if (chatListener) chatListener.off();
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.style.flexDirection = 'column';
  
  const { db } = getFirebase();
  if (!db) return;
  
  /* H4: track the chat-meta listener so it can be detached (was: anonymous, leaked on every open) */
  if (window._chatMetaRef) { window._chatMetaRef.off(); window._chatMetaRef = null; }
  window._chatMetaRef = db.ref('1on1_chats/' + chatId);
  window._chatMetaRef.on('value', function(snap) {
    const d = snap.val();
    /* (2026-10-02) Leave ke baad chat band: input chhupao aur flag lagao
       taake naye msg snapshot par deleted screen dobara na ujre */
    window._chatLeft = !!(d && d.status === 'left');
    if (window._chatLeft) {
      container.innerHTML = '<div class="chat-deleted-screen"><span>🧹</span><p style="font-weight:700;">Chat mita di gai hai</p><p style="font-size:11px;color:#94a3b8;">User ne leave kar diya hai.</p></div>';
      const ib = document.querySelector('.chat-input-bar');
      if (ib) ib.style.display = 'none';
      const sb = document.querySelector('.chat-sticker-bar');
      if (sb) sb.style.display = 'none';
      return;
    }
    /* (v150) Doosre user ka is-chat lastSeen parho + header/tick update karo. */
    try {
      const _ids = (chatId || '').split('_');
      const _other = (_ids[0] === currentUserId) ? _ids[1] : _ids[0];
      const _ls = (d && d.lastSeen && d.lastSeen[_other]) ? Number(d.lastSeen[_other]) || 0 : 0;
      window._ddpOtherLastSeen = _ls;
      ddpRenderChatStatus();
      ddpRefreshSeenTick();
    } catch(e) {}
  });
  
  chatListener = db.ref('1on1_messages/' + chatId).orderByChild('timestamp').limitToLast(50);
  chatListener.on('value', function(snap) {
    /* (2026-10-02) Chat left ho chuki ho to msgs dobara render na karo —
       pehle yahi bug tha: naya msg ate hi deleted screen gayab ho jati thi */
    if (window._chatLeft) {
      container.innerHTML = '<div class="chat-deleted-screen"><span>🧹</span><p style="font-weight:700;">Chat mita di gai hai</p><p style="font-size:11px;color:#94a3b8;">User ne leave kar diya hai.</p></div>';
      return;
    }
    /* (v135) FIX: naya msg ate hi poori list dobara banti hai — us se pehle khule hue inline reply box ka likha hua bacha lo, warna aadha reply mit jata hai */
    const _replyDrafts = {};
    let _focusedDraft = null;
    try {
      const _rInputs = document.querySelectorAll('[id^="chatReplyInput_"]');
      for (let _ri = 0; _ri < _rInputs.length; _ri++) {
        const _rInp = _rInputs[_ri];
        const _rMid = _rInp.id.replace('chatReplyInput_', '');
        const _rBox = document.getElementById('chatReplyBox_' + _rMid);
        if (_rBox && _rBox.style.display !== 'none') {
          _replyDrafts[_rMid] = _rInp.value;
          if (document.activeElement === _rInp) _focusedDraft = _rMid;
        }
      }
    } catch (e) {}
    container.innerHTML = '';
    const msgs = [];
    snap.forEach(function(c) { const m = c.val(); m.id = c.key; msgs.push(m); });
    msgs.sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
    if (msgs.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">No messages yet. Say hello! 👋</p>';
    } else {
      for (let i = 0; i < msgs.length; i++) { renderMessage(msgs[i]); }
    }
    setTimeout(function() { container.scrollTop = container.scrollHeight; }, 100);
    /* (v150) Chat khula hai aur naye msgs aa rahe hain - apna seen-time refresh karo (60s throttle andar hai). */
    try { ddpMarkChatSeen(chatId); } catch(e) {}
    try { ddpRefreshSeenTick(); } catch(e) {}
    /* (v135) drafts wapas lagao: box dobara kholo, likha hua wapas dalo, focus + cursor wapas lao */
    try {
      Object.keys(_replyDrafts).forEach(function(_rMid) {
        const _rBox2 = document.getElementById('chatReplyBox_' + _rMid);
        const _rInp2 = document.getElementById('chatReplyInput_' + _rMid);
        if (_rBox2 && _rInp2) { _rBox2.style.display = 'block'; _rInp2.value = _replyDrafts[_rMid]; }
      });
      if (_focusedDraft) {
        const _fInp = document.getElementById('chatReplyInput_' + _focusedDraft);
        if (_fInp) { _fInp.focus(); try { const _l = _fInp.value.length; _fInp.setSelectionRange(_l, _l); } catch (e2) {} }
      }
    } catch (e) {}
  });
}

async function sendAction(type) {
  if (!currentChatId) return;
  /* (2026-10-02) Chat left/block ho to sticker bhi na bhejo */
  const aIds = currentChatId.split('_');
  const aOtherUid = (aIds[0] === currentUserId) ? aIds[1] : aIds[0];
  if (await chatSendBlocked(aOtherUid)) return;
  const username = safeUser().username;
  let actionText = '';
  switch(type) {
    case 'heart': actionText = username + ' ki dharkan tez ho gayi ❤️'; break;
    case 'angry': actionText = username + ' ko gussa aa gaya 😡'; break;
    case 'smile': actionText = username + ' ko hansi aa gayi 😂'; break;
    case 'sad': actionText = username + ' aaj boht udas hai 😢'; break;
  }
  const { db } = getFirebase();
  if (!db) return;
  db.ref('1on1_messages/' + currentChatId).push({
    senderId: currentUserId,
    senderName: username,
    text: actionText,
    type: 'action',
    stickerType: type,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  showScreenAnimation(type);
}

function showScreenAnimation(type) {
  const icons = { heart: '❤️', angry: '😡', smile: '😂', sad: '😢' };
  for (let i = 0; i < 10; i++) {
    setTimeout(function() {
      const el = document.createElement('div');
      el.innerHTML = icons[type];
      el.className = 'floating-emoji';
      el.style.left = Math.random() * 80 + 10 + '%';
      el.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(el);
      setTimeout(function() { el.remove(); }, 3000);
    }, i * 100);
  }
}

async function uploadChatImage(input) {
  if (!currentChatId) return;
  const { db } = getFirebase();
  if (!db) return;
  /* (2026-10-02) Chat left/block ho to image na bhejo */
  const gIds = currentChatId.split('_');
  const gOtherUid = (gIds[0] === currentUserId) ? gIds[1] : gIds[0];
  if (await chatSendBlocked(gOtherUid)) { if (input) input.value = ''; return; }
  const chatSnap = await db.ref('1on1_chats/' + currentChatId).once('value');
  if (chatSnap.val() && chatSnap.val().allowImages === false) {
    alert('Images are blocked!');
    if (input) input.value = '';
    return;
  }
  const file = input.files[0];
  if (!file) return;
  try {
    const imageUrl = await uploadImageToCloudinary(file, true); /* (v111) 1on1: 5-min photo limit nahi */
    await db.ref('1on1_messages/' + currentChatId).push({
      senderId: currentUserId,
      senderName: safeUser().username,
      senderDp: safeUser().profilePic || '',
      type: 'text',
      imageUrl: imageUrl,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      hidden: false
    });
    await db.ref('1on1_chats/' + currentChatId).update({
      lastMsg: '📷 Image',
      lastTime: firebase.database.ServerValue.TIMESTAMP
    });
    const imgIds = currentChatId.split('_');
    const imgOtherUid = (imgIds[0] === currentUserId) ? imgIds[1] : imgIds[0];
    dismissChatNotifications(imgOtherUid);
    if (input) input.value = '';
    return true;
  } catch(e) { alert('Upload failed'); }
}

/* (v128) 1on1 image preview — pick par foran upload NAHI hota. Pehle text input ke
   upar chhota preview (72px thumb + naam) dikhta hai; Send dabane par hi wahi purana
   uploadChatImage wala rasta chalta hai (block/permission check + upload + message).
   Fail ho to preview wapas aa jata hai (dobara pick nahi karna); Cancel par kuch nahi jata. */
var _ddpChatPendingImg = null;
var _ddpChatPreviewUrl = null;
function ddpChatImgShow(file) {
  if (_ddpChatPreviewUrl) { try { URL.revokeObjectURL(_ddpChatPreviewUrl); } catch(e) {} }
  _ddpChatPendingImg = file;
  _ddpChatPreviewUrl = URL.createObjectURL(file);
  const box = document.getElementById('chatImgPreview');
  if (!box) return;
  const nm = file.name || 'image';
  const short = nm.length > 24 ? nm.substring(0, 21) + '…' : nm;
  box.style.display = 'flex';
  box.style.alignItems = 'center';
  box.style.gap = '8px';
  box.style.padding = '8px';
  box.style.background = '#f8fafc';
  box.style.borderTop = '1px solid #e5e7eb';
  box.innerHTML = '<img src="' + _ddpChatPreviewUrl + '" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;" />' +
    '<span style="flex:1;font-size:12px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(short) + '</span>' +
    '<button onclick="ddpChatImgSend()" style="padding:9px 14px;background:#16a34a;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;">📤 Send</button>' +
    '<button onclick="ddpChatImgCancel()" style="padding:9px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;">✖</button>';
}
function ddpChatImgPreview(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  if (file.type && file.type.indexOf('image/') !== 0) { alert('Sirf image choose karein!'); input.value = ''; return; }
  ddpChatImgShow(file);
}
function ddpChatImgClear() {
  if (_ddpChatPreviewUrl) { try { URL.revokeObjectURL(_ddpChatPreviewUrl); } catch(e) {} }
  _ddpChatPreviewUrl = null;
  _ddpChatPendingImg = null;
  const box = document.getElementById('chatImgPreview');
  if (box) { box.innerHTML = ''; box.style.display = 'none'; }
  const inp = document.getElementById('chatImageInput');
  if (inp) inp.value = '';
}
function ddpChatImgCancel() { ddpChatImgClear(); }
async function ddpChatImgSend() {
  const f = _ddpChatPendingImg;
  if (!f) return;
  const ok = await uploadChatImage({ files: [f] });
  if (ok) ddpChatImgClear();
  else ddpChatImgShow(f);
}

function leave1on1() {
  if (!currentChatId || !confirm('Leave chat? 24 hours baad permanently delete ho jayegi.')) return;
  const { db } = getFirebase();
  if (!db) return;
  db.ref('1on1_chats/' + currentChatId).update({
    status: 'left',
    leftBy: currentUserId,
    leaveTime: firebase.database.ServerValue.TIMESTAMP
  }).then(function() {
    alert('You left the chat.');
    closeChatScreen();
  });
}

function checkAndCleanupChat(chatId) {
  const { db } = getFirebase();
  if (!db) return;
  if (window._cleanupRef) { window._cleanupRef.off('value', window._cleanupCb); }
  window._cleanupRef = db.ref('1on1_chats/' + chatId);
  window._cleanupCb = function(snap) {
    const d = snap.val();
    if (d && d.status === 'left' && d.leaveTime) {
      let leaveTimeNum = d.leaveTime;
      if (typeof leaveTimeNum === 'object' && leaveTimeNum.toDate) leaveTimeNum = leaveTimeNum.toDate().getTime();
      if (Date.now() - leaveTimeNum > 86400000) {
        db.ref('1on1_chats/' + chatId).remove();
        db.ref('1on1_messages/' + chatId).remove();
        closeChatScreen();
      }
    }
  };
  window._cleanupRef.on('value', window._cleanupCb);
}

async function toggleImagePermission() {
  if (!currentChatId) return;
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('1on1_chats/' + currentChatId).once('value');
  const d = snap.val() || {};
  if (d.allowImages === false && d.imgOffBy && d.imgOffBy !== currentUserId) {
    alert('Only the user who turned images off can turn them back on.');
    return;
  }
  const newVal = (d.allowImages === false) ? true : false;
  await db.ref('1on1_chats/' + currentChatId).update({
    allowImages: newVal,
    imgOffBy: newVal ? null : currentUserId
  });
  updateImagePermissionUI(currentChatId);
}

async function updateImagePermissionUI(chatId) {
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('1on1_chats/' + chatId).once('value');
  const d = snap.val() || {};
  const btn = document.getElementById('imgPermissionBtn');
  if (btn) btn.innerHTML = (d.allowImages !== false) ? '🖼️ Images: ON' : '🔒 Images: OFF';
}

function listenForPermissions() {
  if (!currentChatId) return;
  const { db } = getFirebase();
  if (!db) return;
  if (window._permRef) { window._permRef.off('value', window._permCb); }
  window._permRef = db.ref('1on1_chats/' + currentChatId);
  window._permCb = function(snap) {
    const d = snap.val();
    const input = document.getElementById('chatImageInput');
    const label = document.getElementById('chatImgLabel');
    if (d && d.allowImages === false) {
      if (input) input.disabled = true;
      if (label) label.style.opacity = '0.3';
    } else {
      if (input) input.disabled = false;
      if (label) label.style.opacity = '1';
    }
    updateImagePermissionUI(currentChatId);
  };
  window._permRef.on('value', window._permCb);
}


/* ===== v147 block (orig theme lines 6517-7918) ===== */

/* ===== MEHFIL SYSTEM ===== */

/* ===== MEHFIL replica helpers (damadam.pk design, real data) ===== */
function ddpMehfilSubnav(active) {
  const items = [
    { id: 'create', label: 'CREATE', svg: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>' },
    { id: 'explore', label: 'EXPLORE', svg: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>' },
    { id: 'mehfils', label: 'MEHFILS', svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>' },
    { id: 'invites', label: 'INVITES', svg: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>' }
  ];
  let h = '<div class="ddp-subnav">';
  for (let i = 0; i < items.length; i++) {
    const t = items[i];
    h += '<button class="ddp-subnav-item' + (active === t.id ? ' active' : '') + '" onclick="ddpMehfilGoTab(\'' + t.id + '\')"><span class="icon-wrapper"><svg viewBox="0 0 24 24">' + t.svg + '</svg></span><span>' + t.label + '</span></button>';
  }
  return h + '</div>';
}
function ddpMehfilGoTab(tab) {
  if (document.getElementById('mehfilContent')) { loadMehfilContent(tab); return; }
  openPage('mehfils');
  loadMehfilContent(tab);
}
function ddpMehfilCardHTML(m, statusPill, isBanned) {
  const topic = m.topic || 'General';
  const cfg = (typeof categoryConfig !== 'undefined' && categoryConfig[topic]) || { icon: '📌' };
  const memberCount = m.memberCount || Object.keys(m.members || {}).length;
  const isOwner = (m.uid === currentUserId);
  const safeName = esc(m.name || 'Mehfil').replace(/'/g, "\\'");
  let h = '<div class="mehfil-card" onclick="openMehfil(\'' + m.id + '\')">';
  if (window._isSiteAdmin) {
    h += '<button class="ddp-admin-del" title="Admin: delete mehfil" onclick="event.stopPropagation();adminDeleteMehfil(\'' + m.id + '\',\'' + safeName + '\')">🗑️</button>';
  }
  h += '<div class="mehfil-top"><div class="icon-box"><span class="emoji">' + cfg.icon + '</span><span class="member-count">👤 ' + memberCount + '</span></div>';
  h += '<div class="mehfil-info"><div class="mehfil-name">' + esc(m.name || 'Mehfil') + (isOwner ? ' <span class="star">★</span>' : '') + '</div>';
  h += '<div class="mehfil-creator">created by ' + esc(m.creator || 'Unknown') + '</div></div></div>';
  h += '<div class="mehfil-bottom-bar">';
  if (statusPill) h += '<span class="tag-pill ddp-status' + (isBanned ? ' banned' : '') + '">' + statusPill + '</span>';
  h += '<span class="tag-pill">' + esc(topic) + '</span><span class="tag-pill">' + esc(m.privacy || 'Everyone') + '</span><span class="tag-pill">' + esc(m.city || 'All cities') + '</span>';
  h += '</div></div>';
  return h;
}
async function ddpJoinAndOpen(mid) {
  if (!currentUserId) { alert('Pehle login karein!'); return; }
  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return;
  try {
    const doc = await db.ref('mehfils/' + mid).once('value');
    const m = doc.val();
    if (!m) { alert('Mehfil not found!'); return; }
    if ((m.banned || {})[currentUserId]) { alert('🚫 Aap banned hain!'); return; }
    if (!((m.members || {})[currentUserId])) {
      await db.ref('mehfils/' + mid + '/members/' + currentUserId).set(true);
      await db.ref('mehfils/' + mid).update({ memberCount: (m.memberCount || 0) + 1 });
    }
    openMehfil(mid, true);
  } catch(e) { alert('Error: ' + e.message); }
}
function ddpMehfilImgSel(input) {
  const f = input && input.files && input.files[0];
  window._ddpMehfilImg = f || null;
  const pv = document.getElementById('ddpMehfilImgPrev');
  if (pv) pv.style.display = f ? 'block' : 'none';
}
function ddpMehfilImgClear() {
  window._ddpMehfilImg = null;
  const pv = document.getElementById('ddpMehfilImgPrev');
  if (pv) pv.style.display = 'none';
}
function ddpTimeShort(ts) {
  if (!ts) return '';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}
async function ddpMarkMehfilActive(mehfilId) {
  if (!mehfilId || !currentUserId) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    await db.ref('mehfils/' + mehfilId + '/presence/' + currentUserId).set({
      username: safeUser().username, ts: Date.now()
    });
    /* (v26) /online ka lastSeen bhi refresh karo taake bar fresh rahe */
    try {
      await db.ref('mehfils/' + mehfilId + '/online/' + currentUserId + '/lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
    } catch(e) {}
  } catch(e) {}
}
/* (v26) timestamp se "Xm ago" text */
function ddpAgoShort(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}
async function ddpUpdateOnlineBtn(mehfilId) {
  const btn = document.getElementById('ddpOnlineBtn_' + mehfilId);
  if (!btn) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    const snap = await db.ref('mehfils/' + mehfilId + '/presence').once('value');
    /* (v29) 2-min cutoff — 24h wala purana threshold galat count deta tha */
    const cutoff = Date.now() - 120000;
    let n = 0;
    snap.forEach(function(c) { if (((c.val() || {}).ts || 0) >= cutoff) n++; });
    btn.innerHTML = '🟢 Online (' + n + ')';
  } catch(e) {}
}
async function ddpShowOnlineList(mehfilId) {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;margin-top:40px;">Loading online users...</p>';
  try {
    const { db } = getFirebase();
    const snap = await db.ref('mehfils/' + mehfilId + '/presence').once('value');
    /* (v29) 2-min cutoff — 24h wale purane users "Online now" dikhte thay */
    const cutoff = Date.now() - 120000;
    const users = [];
    snap.forEach(function(c) {
      const v = c.val() || {};
      if ((v.ts || 0) >= cutoff) users.push({ uid: c.key, username: v.username || 'user', ts: v.ts });
    });
    users.sort(function(a, b) { return (a.username || '').toLowerCase().localeCompare((b.username || '').toLowerCase()); });
    let m = {};
    try { const ms = await db.ref('mehfils/' + mehfilId).once('value'); m = ms.val() || {}; } catch(e) {}
    const mname = m.name || 'Mehfil';
    const isOwner = (m.uid === currentUserId);
    const canModerate = isOwner || ((m.mods || {})[currentUserId] === true);
    const topBtn = 'flex:1;background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:13px 8px;font-size:14px;font-weight:700;color:#64748b;cursor:pointer;';
    let h = '<div style="background:#f8fafc;min-height:100vh;padding-bottom:20px;">';
    h += '<div style="padding:12px 14px 4px;"><button onclick="openMehfil(\'' + mehfilId + '\',true)" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:700;color:#334155;cursor:pointer;">← Back</button></div>';
    h += '<div style="display:flex;gap:10px;padding:10px 14px;">';
    h += '<button onclick="ddpMehfilInfoPage(\'' + mehfilId + '\')" style="' + topBtn + '">ℹ️ Info</button>';
    h += '<button style="' + topBtn + 'border-color:#22c55e;color:#16a34a;">🟢 Online</button>';
    if (canModerate) h += '<button onclick="ddpOnlineGoSettings(\'' + mehfilId + '\')" style="' + topBtn + '">⚙️ Settings</button>';
    h += '</div>';
    h += '<div style="background:#fff;margin:2px 14px;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.07);overflow:hidden;">';
    if (users.length === 0) {
      h += '<p style="text-align:center;color:#888;padding:40px;">Koi online user nahi.</p>';
    } else {
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        h += '<div style="display:flex;align-items:center;padding:15px 18px;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="goToUserProfile(\'' + u.uid + '\')">';
        h += '<span style="width:10px;height:10px;border-radius:50%;background:#22c55e;margin-right:14px;flex-shrink:0;"></span>';
        h += '<span style="font-weight:700;font-size:16px;color:#111;">' + esc(u.username) + '</span>';
        h += '<span style="margin-left:auto;color:#94a3b8;font-size:13px;">Online now</span>';
        h += '</div>';
      }
    }
    h += '</div></div>';
    container.innerHTML = h;
  } catch(e) {
    container.innerHTML = '<p style="text-align:center;color:red;padding:40px;">Error loading online users</p>';
  }
}
async function ddpMehfilInfoPage(mehfilId) {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  try {
    const { db } = getFirebase();
    const ms = await db.ref('mehfils/' + mehfilId).once('value');
    const m = ms.val() || {};
    let adminName = 'Unknown';
    try { const a = await UserCache.get(m.uid); if (a && a.username) adminName = a.username; } catch(e) {}
    const memberCount = Object.keys(m.members || {}).length;
    const row = 'display:flex;justify-content:space-between;padding:13px 18px;border-bottom:1px solid #f1f5f9;font-size:14px;';
    let h = '<div style="background:#f8fafc;min-height:100vh;padding-bottom:20px;">';
    h += '<div style="padding:12px 14px 4px;"><button onclick="openMehfil(\'' + mehfilId + '\',true)" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:700;color:#334155;cursor:pointer;">← Back</button></div>';
    h += '<div style="background:#fff;margin:10px 14px;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.07);overflow:hidden;">';
    h += '<div style="padding:18px;text-align:center;border-bottom:1px solid #f1f5f9;"><div style="font-size:20px;font-weight:800;">' + esc(m.name || 'Mehfil') + '</div><div style="color:#94a3b8;font-size:12px;margin-top:4px;">' + esc(m.topic || '') + ' · ' + esc(m.privacy || 'Everyone') + ' · ' + esc(m.city || 'All cities') + '</div></div>';
    h += '<div style="' + row + '"><span style="color:#64748b;">👑 Admin</span><b>' + esc(adminName) + '</b></div>';
    h += '<div style="' + row + '"><span style="color:#64748b;">👥 Members</span><b>' + memberCount + '</b></div>';
    h += '<div style="' + row + '"><span style="color:#64748b;">🟢 Online (24h)</span><b id="ddpInfoOnlineCt">...</b></div>';
    if (m.createdAt) h += '<div style="' + row + '"><span style="color:#64748b;">📅 Banai gayi</span><b>' + esc(timeAgo(new Date(m.createdAt))) + '</b></div>';
    h += '</div>';
    /* (v27) Leave option — Info me (owner ke liye nahi, wo delete/transfer kare) */
    if (m.uid !== currentUserId) {
      h += '<div style="margin:10px 14px;"><button onclick="confirmLeaveMehfil(\'' + mehfilId + '\')" style="width:100%;background:#fee2e2;color:#dc2626;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;">🚪 Mehfil Leave Karein</button></div>';
    }
    h += '</div>';
    container.innerHTML = h;
    try {
      const ps = await db.ref('mehfils/' + mehfilId + '/presence').once('value');
      const cutoff = Date.now() - 24 * 3600 * 1000;
      let ct = 0;
      ps.forEach(function(c) { if (((c.val() || {}).ts || 0) >= cutoff) ct++; });
      const el = document.getElementById('ddpInfoOnlineCt');
      if (el) el.textContent = ct;
    } catch(e) {}
  } catch(e) {
    container.innerHTML = '<p style="text-align:center;color:red;padding:40px;">Error loading info</p>';
  }
}
async function ddpOnlineGoSettings(mehfilId) {
  await openMehfil(mehfilId, true);
  showMehfilPanel(mehfilId, 'settings');
}
var _ddpMentionMembers = {};
async function ddpMentionInput(mehfilId) {
  const ta = document.getElementById('ddpMehfilMsg');
  const pop = document.getElementById('ddpMentionPop_' + mehfilId);
  if (!ta || !pop) return;
  const pos = ta.selectionStart || 0;
  const before = ta.value.substring(0, pos);
  const m = before.match(/@(\w*)$/);
  if (!m) { pop.style.display = 'none'; return; }
  const partial = (m[1] || '').toLowerCase();
  try {
    if (!_ddpMentionMembers[mehfilId]) {
      const { db } = getFirebase();
      const snap = await db.ref('mehfils/' + mehfilId + '/members').once('value');
      const uids = [];
      snap.forEach(function(c) { uids.push(c.key); });
      const list = [];
      for (let i = 0; i < uids.length; i++) {
        const u = await UserCache.get(uids[i]);
        if (u && u.username) list.push(u.username);
      }
      _ddpMentionMembers[mehfilId] = list;
    }
    const list = _ddpMentionMembers[mehfilId] || [];
    const hits = list.filter(function(n) { return n.toLowerCase().indexOf(partial) === 0 && n !== safeUser().username; }).slice(0, 8);
    if (hits.length === 0) { pop.style.display = 'none'; return; }
    let h = '';
    for (let i = 0; i < hits.length; i++) {
      h += '<div class="ddp-mention-item" onclick="ddpPickMention(\'' + mehfilId + '\',\'' + escAttrJS(hits[i]) + '\')">👤 ' + esc(hits[i]) + '</div>';
    }
    pop.innerHTML = h;
    pop.style.display = 'block';
  } catch(e) { pop.style.display = 'none'; }
}
function ddpPickMention(mehfilId, username) {
  const ta = document.getElementById('ddpMehfilMsg');
  const pop = document.getElementById('ddpMentionPop_' + mehfilId);
  if (!ta) return;
  const pos = ta.selectionStart || 0;
  const before = ta.value.substring(0, pos);
  const after = ta.value.substring(pos);
  const nb = before.replace(/@\w*$/, '@' + username + ' ');
  ta.value = nb + after;
  if (pop) pop.style.display = 'none';
  ta.focus();
}
/* (v37) Ek user ka mention sirf PEHLI bar highlight ho — text me 100 bar likhne par bhi baqi plain rahenge */
/* (v37) damadam.pk custom emojis — 188 shortcodes (.a1-.x4), Cloudinary-hosted (permanent) */
const DDP_EMOJI_BASE = 'https://res.cloudinary.com/ldtfcva5/image/upload/';
const DDP_EMOJI_CODES = 'a1,a2,a3,a4,a5,a6,a7,a8,b1,b2,b3,b4,b5,b6,b7,b8,c1,c2,c3,c4,c5,c6,c7,c8,d1,d2,d3,d4,d5,d6,d7,d8,e1,e2,e3,e4,e5,e6,e7,e8,f1,f2,f3,f4,f5,f6,f7,f8,g1,g2,g3,g4,g5,g6,g7,g8,h1,h2,h3,h4,h5,h6,h7,h8,i1,i2,i3,i4,i5,i6,i7,i8,j1,j2,j3,j4,j5,j6,j7,j8,k1,k2,k3,k4,k5,k6,k7,k8,l1,l2,l3,l4,l5,l6,l7,l8,m1,m2,m3,m4,m5,m6,m7,m8,n1,n2,n3,n4,n5,n6,n7,n8,o1,o2,o3,o4,o5,o6,o7,o8,p1,p2,p3,p4,p5,p6,p7,p8,q1,q2,q3,q4,q5,q6,q7,q8,r1,r2,r3,r4,r5,r6,r7,r8,s1,s2,s3,s4,s5,s6,s7,s8,t1,t2,t3,t4,t5,t6,t7,t8,u1,u2,u3,u4,u5,u6,u7,u8,v1,v2,v3,v4,v5,v6,v7,v8,w1,w2,w3,w4,w5,w6,w7,x1,x2,x3,x4'.split(',');
var DDP_EMOJI_V2 = {s8:1,r2:1,r3:1,r4:1,r6:1,r7:1,r8:1,v1:1,v2:1,v3:1,v4:1,u5:1,m7:1,m8:1,n5:1,n6:1,n7:1,n8:1,a2:1,a3:1,a4:1,f7:1,f8:1,g2:1,a7:1,b3:1,b4:1,b6:1,b7:1,b8:1,c3:1,c7:1,c8:1,d3:1,d4:1,d7:1,d8:1,e3:1,e7:1,e8:1,f3:1,f4:1,g6:1,g7:1,h4:1,h7:1,h8:1,i3:1,i4:1,i7:1};
var DDP_EMOJI_V3 = {q1:1,q2:1,q5:1,q6:1,r6:1,r7:1,r1:1,r2:1,g4:1,s1:1,f6:1,w8:1};
function ddpEmojiURL(code) { var _u; if (DDP_EMOJI_V3[code] && code!=='w8') _u = DDP_EMOJI_BASE + 'ddp_emoji_' + code + '_v3.jpg?v44'; else if (code==='w8') _u = DDP_EMOJI_BASE + 'ddp_emoji_rukjao_v3.jpg?v44'; else _u = DDP_EMOJI_BASE + 'ddp_emoji_' + code + (DDP_EMOJI_V2[code] ? '_v2' : '') + '.png?v42'; return ddpThumbUrl(_u, 100); }
var DDP_EMOJI_BACKUP = ''; /* backup host base, e.g. second Cloudinary cloud URL ending with / */
function ddpEmojiFallback(img) {
  if (!DDP_EMOJI_BACKUP || !img || img.dataset.ddpFb) return;
  img.dataset.ddpFb = '1';
  try { img.src = img.src.replace(DDP_EMOJI_BASE, DDP_EMOJI_BACKUP); } catch(e) {}
}
function ddpEmojify(h) {
  /* (v104) FIX: codes ab kahin bhi match hote hain - .a1.b2 sath likhne par bhi, .A1 capital par bhi (case-insensitive, lookup lowercase me) */
  return String(h || '').replace(/\.([a-z][1-8])(?![0-9])/gi, function(m, raw) {
    var code = raw.toLowerCase();
    if (DDP_EMOJI_CODES.indexOf(code) === -1) return m;
    var ecls = DDP_EMOJI_V3[code] ? 'ddp-emoji ddp-emoji-text' : 'ddp-emoji';
    return '<img src="' + ddpEmojiURL(code) + '" alt=".' + code + '" class="' + ecls + '" loading="lazy" onerror="ddpEmojiFallback(this)"/>';
  });
}
function ddpOpenEmojiList() {
  const m = document.getElementById('ddpEmojiModal');
  if (m) m.style.display = 'flex';
  ddpBuildEmojiGrid();
}
function ddpCloseEmojiList(ev) {
  if (ev && ev.target && ev.target.id !== 'ddpEmojiModal' && ev.target.className !== 'modal-close') return;
  const m = document.getElementById('ddpEmojiModal');
  if (m) m.style.display = 'none';
}
function ddpBuildEmojiGrid() {
  const g = document.getElementById('ddpEmojiListGrid');
  if (!g || g.children.length) return;
  let h = '';
  for (let i = 0; i < DDP_EMOJI_CODES.length; i++) {
    const c = DDP_EMOJI_CODES[i];
    h += '<div class="ddp-emoji-cell"><img src="' + ddpEmojiURL(c) + '" alt=".' + c + '" loading="lazy" onerror="ddpEmojiFallback(this)"/><span>.' + c + '</span></div>';
  }
  g.innerHTML = h;
}
function ddpHL(text) {
  const _seen = {};
  return esc(text || '').replace(/@(\w+)/g, function(m, u) {
    const k = String(u || '').toLowerCase();
    if (_seen[k]) return m;
    _seen[k] = true;
    return '<span class="ddp-mention-hl">@' + u + '</span>';
  });
}
function ddpInsertMention(username) {
  const ta = document.getElementById('ddpMehfilMsg');
  if (!ta) return;
  ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '') + '@' + username + ' ';
  ta.focus();
}
async function ddpSendMehfilMsg(mehfilId) {
  const ta = document.getElementById('ddpMehfilMsg');
  const text = ta ? ta.value.trim() : '';
  const file = window._ddpMehfilImg || null;
  if (!text && !file) { alert('Pehle message likhein ya image attach karein.'); return; }
  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return;
  try {
    let imageUrl = '';
    if (file) imageUrl = await uploadImageToCloudinary(file);
    const _chk = document.getElementById('ddpSendAllChk');
    const _sendAll = !!(_chk && _chk.checked);
    if (_chk) _chk.checked = false;
    const msg = { user: safeUser().username, userId: currentUserId, text: text, time: firebase.database.ServerValue.TIMESTAMP };
    let _isAdminSendAll = false;
    let _mehfilVal = null;
    if (_sendAll) {
      try {
        const _ms = await db.ref('mehfils/' + mehfilId).once('value');
        _mehfilVal = _ms.val() || {};
        _isAdminSendAll = (_mehfilVal.uid === currentUserId) || ((_mehfilVal.mods || {})[currentUserId] === true);
        if (_isAdminSendAll) msg.announce = true;
      } catch(e) {}
    }
    /* (v29) Send to Admin / Send All notifications — pehle ye code tha hi nahi */
    if (_sendAll) {
      try {
        const _mname29 = (_mehfilVal && _mehfilVal.name) || 'Mehfil';
        if (_isAdminSendAll) {
          /* admin/mod ne "Send All" kiya: sab members ko mehfil_announce */
          try {
            const _memSnap = await db.ref('mehfils/' + mehfilId + '/members').once('value');
            const _notifPromises = [];
            _memSnap.forEach(function(mc) {
              const _muid = mc.key;
              if (!_muid || _muid === currentUserId) return;
              _notifPromises.push((async function() {
                try {
                  let _blk = false;
                  try { _blk = await isBlockedBetween(currentUserId, _muid); } catch(e) {}
                  if (_blk) return;
                  await db.ref('notifications').push({
                    toUid: _muid, fromUid: currentUserId,
                    sender_name: safeUser().username, type: 'mehfil_announce',
                    message: safeUser().username + ' announced in mehfil "' + _mname29 + '"',
                    replyPreview: text || (imageUrl ? 'photo bheji' : ''),
                    mehfilId: mehfilId, mehfilName: _mname29,
                    timestamp: Date.now(), read: false
                  });
                } catch(e) {}
              })());
            });
            await Promise.all(_notifPromises);
          } catch(e) {}
        } else {
          /* regular member ne "Send to Admin" kiya: mehfil owner ko notify */
          try {
            const _ownerUid = _mehfilVal && _mehfilVal.uid;
            if (_ownerUid && _ownerUid !== currentUserId) {
              let _blk2 = false;
              try { _blk2 = await isBlockedBetween(currentUserId, _ownerUid); } catch(e) {}
              if (!_blk2) {
                await db.ref('notifications').push({
                  toUid: _ownerUid, fromUid: currentUserId,
                  sender_name: safeUser().username, type: 'mehfil_admin_msg',
                  message: safeUser().username + ' sent a message for admin in mehfil "' + _mname29 + '"',
                  replyPreview: text || (imageUrl ? 'photo bheji' : ''),
                  mehfilId: mehfilId, mehfilName: _mname29,
                  timestamp: Date.now(), read: false
                });
              }
            }
          } catch(e) {}
        }
      } catch(e) {}
    }
    if (imageUrl) msg.image = imageUrl;
    try {
      const _fm = text.match(/@(\w+)/);
      if (_fm && _fm[1] !== safeUser().username) msg.replyToUser = _fm[1];
    } catch(e) {}
    /* (v36) Mehfil reply: jis message ka reply hai uska record save karo taake quote + click-jump kaam kare */
    try {
      const _rtm = window._ddpReplyTarget;
      if (_rtm && _rtm.msgId) msg.replyTo = { msgId: _rtm.msgId, user: _rtm.username || 'user', text: (_rtm.text || '').substring(0, 200) };
    } catch(e) {}
    await db.ref('mehfil_posts/' + mehfilId).push(msg);
    await db.ref('mehfils/' + mehfilId).update({ lastActivity: firebase.database.ServerValue.TIMESTAMP });
    /* (v27) message bhejne par foran presence refresh */
    try { await db.ref('mehfils/' + mehfilId + '/online/' + currentUserId + '/lastSeen').set(firebase.database.ServerValue.TIMESTAMP); } catch(e) {}
        /* @mentions: notify each mentioned user */
    try {
      const _mentions = {};
      const _re = /@(\w+)/g;
      let _mm;
      while ((_mm = _re.exec(text)) !== null) { _mentions[_mm[1]] = true; }
      const _names = Object.keys(_mentions).filter(function(n) { return n !== safeUser().username; });
      let _firstTarget = '';
      const _doneUids = {};
      /* (v24) explicit reply-target: @ text delete bhi ho jaye to notify jaye */
      try {
        const _rt = window._ddpReplyTarget;
        if (_rt && _rt.uid && _rt.uid !== currentUserId && _names.indexOf(_rt.username) === -1) {
          let _rb = false;
          try { _rb = await isBlockedBetween(currentUserId, _rt.uid); } catch(e) {}
          if (!_rb) {
            let _rmname = 'Mehfil';
            try { const _rms = await db.ref('mehfils/' + mehfilId).once('value'); _rmname = (_rms.val() || {}).name || 'Mehfil'; } catch(e) {}
            await db.ref('notifications').push({
              toUid: _rt.uid, fromUid: currentUserId,
              sender_name: safeUser().username, type: 'mehfil_reply',
              message: safeUser().username + ' replied to you in mehfil "' + _rmname + '"',
              replyPreview: text || (imageUrl ? 'photo bheji' : ''),
              mehfilId: mehfilId, mehfilName: _rmname,
              timestamp: Date.now(), read: false
            });
            _doneUids[_rt.uid] = true;
          }
        }
      } catch(e) {}
      window._ddpReplyTarget = null;

      for (let _ni = 0; _ni < _names.length; _ni++) {
        try {
          const unSnap = await db.ref('usernames/' + _names[_ni]).once('value');
          const targetUid = unSnap.val();
          if (targetUid && typeof targetUid === 'string' && targetUid !== currentUserId && !_doneUids[targetUid]) {
            _doneUids[targetUid] = true;
            if (!_firstTarget) _firstTarget = _names[_ni];
            let blocked = false;
            try { blocked = await isBlockedBetween(currentUserId, targetUid); } catch(e) {}
            if (!blocked) {
              let mname = 'Mehfil';
              try { const ms = await db.ref('mehfils/' + mehfilId).once('value'); mname = (ms.val() || {}).name || 'Mehfil'; } catch(e) {}
              await db.ref('notifications').push({
                toUid: targetUid,
                fromUid: currentUserId,
                sender_name: safeUser().username,
                type: 'mehfil_reply',
                message: safeUser().username + ' mentioned you in mehfil "' + mname + '"',
                replyPreview: text || (imageUrl ? 'photo bheji' : ''),
                mehfilId: mehfilId,
                mehfilName: mname,
                timestamp: Date.now(),
                read: false
              });
            }
          }
        } catch(e) {}
      }
      if (_names.length > 0 && typeof updateInboxBadge === 'function') updateInboxBadge();
    } catch(e) {}
    if (typeof dismissNotifByType === 'function') dismissNotifByType('mehfil_reply', 'mehfilId', mehfilId);
    if (ta) ta.value = '';
    ddpMehfilImgClear();
  } catch(e) { alert('Send failed: ' + e.message); }
}
/* (v24) Reply target uid bhi store karo taake @ text delete bhi ho jaye to notify jaye */
window._ddpReplyTarget = null;
/* (v37) Inline reply: usi chat ke nechy reply box khulta hai (1on1 wala style) */
function ddpToggleInlineReply(msgId) {
  if (!msgId) return;
  const box = document.getElementById('ddpReplyBox_' + msgId);
  if (!box) return;
  try {
    const all = document.querySelectorAll('[id^="ddpReplyBox_"]');
    for (let i = 0; i < all.length; i++) { if (all[i] !== box) all[i].style.display = 'none'; }
  } catch(e) {}
  if (box.style.display === 'none' || !box.style.display) {
    box.style.display = 'block';
    const input = document.getElementById('ddpReplyInput_' + msgId);
    if (input) input.focus();
  } else {
    box.style.display = 'none';
  }
}
async function ddpSendInlineReply(mehfilId, msgId, username, uid) {
  const input = document.getElementById('ddpReplyInput_' + msgId);
  const text = input ? input.value.trim() : '';
  if (!text || !mehfilId) return;
  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return;
  let qtext = '';
  try {
    const mel = document.getElementById('ddpmsg_' + msgId);
    const tx = mel && mel.querySelector('.ddp-msg-text');
    if (tx) qtext = (tx.innerText || tx.textContent || '').substring(0, 200);
  } catch(e) {}
  const msg = { user: safeUser().username, userId: currentUserId, text: text, time: firebase.database.ServerValue.TIMESTAMP,
    replyTo: { msgId: msgId, user: username || 'user', text: qtext } };
  try {
    const _fm = text.match(/@(\w+)/);
    if (_fm && _fm[1] !== safeUser().username) msg.replyToUser = _fm[1];
  } catch(e) {}
  try {
    await db.ref('mehfil_posts/' + mehfilId).push(msg);
    await db.ref('mehfils/' + mehfilId).update({ lastActivity: firebase.database.ServerValue.TIMESTAMP });
    try { await db.ref('mehfils/' + mehfilId + '/online/' + currentUserId + '/lastSeen').set(firebase.database.ServerValue.TIMESTAMP); } catch(e) {}
  } catch(e) { alert('Send failed: ' + e.message); return; }
  /* jis user ko reply kiya usay notify karo */
  try {
    if (uid && uid !== currentUserId) {
      let _blk = false;
      try { _blk = await isBlockedBetween(currentUserId, uid); } catch(e) {}
      if (!_blk) {
        let _rmname = 'Mehfil';
        try { const _rms = await db.ref('mehfils/' + mehfilId).once('value'); _rmname = (_rms.val() || {}).name || 'Mehfil'; } catch(e) {}
        await db.ref('notifications').push({
          toUid: uid, fromUid: currentUserId,
          sender_name: safeUser().username, type: 'mehfil_reply',
          message: safeUser().username + ' replied to you in mehfil "' + _rmname + '"',
          replyPreview: text, mehfilId: mehfilId, mehfilName: _rmname,
          timestamp: Date.now(), read: false
        });
      }
    }
  } catch(e) {}
  try {
    const box = document.getElementById('ddpReplyBox_' + msgId);
    if (box) box.style.display = 'none';
    if (input) input.value = '';
  } catch(e) {}
}
/* (v36) Quote par click: original message tak scroll + 2 sec highlight */
function ddpJumpToMsg(msgId) {
  if (!msgId) return;
  let el = document.getElementById('ddpmsg_' + msgId);
  if (!el) el = document.getElementById('chatmsg_' + msgId);
  if (!el) return;
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) { try { el.scrollIntoView(); } catch(ee) {} }
  try {
    const _oldBg = el.style.background;
    el.style.transition = 'background 0.4s';
    el.style.background = '#fef9c3';
    setTimeout(function() { try { el.style.background = _oldBg || ''; } catch(e) {} }, 2000);
  } catch(e) {}
}
function ddpToggleMsgActions(msgId) {
  const box = document.getElementById('ddpmsga_' + msgId);
  if (!box) return;
  box.style.display = (box.style.display === 'none' || !box.style.display) ? 'flex' : 'none';
}
function ddpToggleQuote(btn) {
  const wrap = btn.parentElement;
  if (!wrap) return;
  const sh = wrap.querySelector('.ddp-q-short');
  const fl = wrap.querySelector('.ddp-q-full');
  if (!sh || !fl) return;
  const showing = (fl.style.display !== 'none');
  fl.style.display = showing ? 'none' : 'inline';
  sh.style.display = showing ? 'inline' : 'none';
  btn.innerText = showing ? 'MORE▼' : 'LESS▲';
}
function ddpBackToChat(mehfilId) { loadMehfilMessages(mehfilId); }
function ddpMehfilMsgHTML(msg, mehfilId, username, canModerate, canDelete) {
  if (msg.system) {
    return '<div class="ddp-sysmsg"><i>' + esc(msg.text || '') + '</i></div>';
  }
  if (msg.deleted) {
    const _role = (msg.deletedBy === 'afsar') ? 'afsar' : 'admin';
    return '<div class="feed-item"><div class="ddp-tombstone"><i>' + esc(_role) + ' ne chat mita di</i></div></div>';
  }
  if (typeof canDelete === 'undefined') canDelete = canModerate;
  const isOwnMsg = (msg.userId === currentUserId);
  const timeText = msg.time ? timeAgo(new Date(msg.time)) : '';
  let h = '<div class="feed-item' + (msg.announce ? ' ddp-announce' : '') + '" id="ddpmsg_' + (msg.id || '') + '">';
  const _isOn = (window._ddpOnlineUids && window._ddpOnlineUids[mehfilId] && window._ddpOnlineUids[mehfilId].has(msg.userId));
  h += '<div class="ddp-msg-line"><span class="ddp-dot ' + (_isOn ? 'online' : 'offline') + '" data-uid="' + (msg.userId || '') + '"></span>';
  h += '<span class="ddp-msg-user" data-uid="' + msg.userId + '" onclick="event.stopPropagation();goToUserProfile(\'' + msg.userId + '\')">' + esc(username) + redStarHTMLByUid(msg.userId) + '</span>';
  h += '<span class="ddp-msg-text">' + (msg.announce ? '<span class="ddp-announce-tag">📢 ADMIN</span>' : '') + ddpEmojify(ddpHL(msg.text || '')) + '</span>';
  h += '<span class="ddp-msg-time">' + timeText + '</span></div>';
  if (safeUrl(msg.image)) {
    h += '<img src="' + ddpThumbUrl(safeUrl(msg.image), 800) + '" class="ddp-msg-img" loading="lazy" onclick="event.stopPropagation();showFullImage(\'' + safeUrl(msg.image) + '\')"/>';
  }
  if (msg.replyTo && msg.replyTo.text) {
    const q = msg.replyTo.text;
    const qu = msg.replyTo.user || 'user';
    /* (v36) Quote clickable: click karne se original message par jump + highlight */
    const _qjump = (msg.replyTo.msgId) ? ' style="cursor:pointer;" title="Original message dekhein" onclick="event.stopPropagation();ddpJumpToMsg(\'' + escAttrJS(msg.replyTo.msgId) + '\')"' : '';
    if (q.length > 60) {
      h += '<div class="ddp-quote"' + _qjump + '><span class="ddp-q-short">➔ to ' + esc(qu) + ': ' + esc(q.substring(0, 60)) + '...</span><span class="ddp-q-full" style="display:none;">➔ to ' + esc(qu) + ': ' + esc(q) + '</span> <button class="ddp-more-btn" onclick="event.stopPropagation();ddpToggleQuote(this)">MORE▼</button></div>';
    } else {
      h += '<div class="ddp-quote"' + _qjump + '>➔ to ' + esc(qu) + ': ' + esc(q) + '</div>';
    }
  } else if (msg.replyToUser) {
    h += '<div class="ddp-quote">➔ to ' + esc(msg.replyToUser) + '</div>';
  }
  h += '<div class="ddp-msg-actions">';
  h += '<button onclick="event.stopPropagation();ddpToggleInlineReply(\'' + (msg.id || '') + '\')">↩ Reply</button>';
  if (!isOwnMsg && msg.userId) h += '<button onclick="event.stopPropagation();startChatWith(\'' + msg.userId + '\')">💬 1on1</button>';
  if (canDelete) {
    h += '<button onclick="event.stopPropagation();hideMehfilMsg(\'' + mehfilId + '\',\'' + msg.id + '\')">🗑 Hide</button>';
    if (!isOwnMsg && msg.userId) {
      let _kickOk = true;
      try {
        const _mm = (window._ddpMehfilMeta && window._ddpMehfilMeta.id === mehfilId) ? (window._ddpMehfilMeta.m || {}) : {};
        if (msg.userId === _mm.uid) _kickOk = false; /* (v110) owner par Kick button hi nahi ayega */
        else if (_mm.uid !== currentUserId && (((_mm.afsars || {})[msg.userId]) || ((_mm.mods || {})[msg.userId]))) _kickOk = false; /* afsar/mod ko sirf owner kick kar sakta hai */
      } catch(e) {}
      if (_kickOk) h += '<button onclick="event.stopPropagation();kickFromMehfil(\'' + mehfilId + '\',\'' + msg.userId + '\')">👢 Kick</button>';
    }
  }
  h += '</div>';
  /* (v37) Inline reply box: usi chat ke nechy khulta hai */
  h += '<div id="ddpReplyBox_' + (msg.id || '') + '" style="display:none;margin-top:6px;">' +
    '<div style="display:flex;gap:6px;align-items:center;">' +
    '<input id="ddpReplyInput_' + (msg.id || '') + '" placeholder="' + escAttr('Reply to ' + username + '...') + '" ' +
    'onkeydown="if(event.key===\'Enter\'){event.preventDefault();ddpSendInlineReply(\'' + mehfilId + '\',\'' + (msg.id || '') + '\',\'' + escAttrJS(username) + '\',\'' + (msg.userId || '') + '\');}" ' +
    'style="flex:1;min-width:0;border:1.5px solid #e2e8f0;border-radius:14px;padding:7px 12px;font-size:13px;outline:none;background:#fff;" />' +
    '<button onclick="event.stopPropagation();ddpSendInlineReply(\'' + mehfilId + '\',\'' + (msg.id || '') + '\',\'' + escAttrJS(username) + '\',\'' + (msg.userId || '') + '\')" ' +
    'style="background:#0d9488;color:#fff;border:none;border-radius:14px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;">Send</button>' +
    '</div></div>';
  h += '</div>';
  return h;
}
function ddpMehfilShellHTML(mehfilId, m, isMember) {
  const topic = m.topic || 'General';
  const topicIcon = ((typeof categoryConfig !== 'undefined' && categoryConfig[topic]) || { icon: '📌' }).icon;
  const memberCount = m.memberCount || Object.keys(m.members || {}).length;
  const isOwner = (m.uid === currentUserId);
  const canModerate = isOwner || ((m.mods || {})[currentUserId] === true);
  let h = '<div id="ddpMehfil">';
  h += '<div class="ddp-backrow"><button onclick="openPage(\'mehfils\')">← Back</button></div>';
  h += '<div class="ddp-chat-head"><div class="ddp-chat-title"><span>' + topicIcon + '</span><span>' + esc(m.name || 'Mehfil') + '</span>' + (isOwner ? '<span class="star">★</span>' : '') + '</div>';
  h += '<div class="ddp-chat-pills"><span class="tag-pill">' + esc(topic) + '</span><span class="tag-pill">' + esc(m.privacy || 'Everyone') + '</span><span class="tag-pill">' + esc(m.city || 'All cities') + '</span></div>';
  h += '<div class="ddp-util-row" style="' + (isMember ? 'display:none;' : '') + '">';
  h += '<button onclick="showMehfilMembers(\'' + mehfilId + '\')">👥 ' + memberCount + '</button>';
  if (!isOwner) h += '<button onclick="confirmLeaveMehfil(\'' + mehfilId + '\')" style="color:#dc2626;">🚪 Leave</button>';
  h += '</div></div>';
  if (!isMember) {
    h += '<div class="join-card"><p class="join-text">Is mehfil ke member banney ke liye \'JOIN\' dabain:</p>';
    h += '<button class="btn-purple" onclick="ddpJoinAndOpen(\'' + mehfilId + '\')">JOIN</button>';
    h += '<div class="join-note">Neeche mehfil ki chats ka preview dekh sakte hain — likhne ya reply ke liye JOIN zaroori hai.</div>';
    h += '<div class="join-note"><b>Note:</b> Join karney ke baad apko kam az kam 1 hour tak member rehna ho ga</div></div>';
  } else {
    h += '<div class="ddp-member-bar">';
    h += '<div id="ddpMentionPop_' + mehfilId + '" class="ddp-mention-pop" style="display:none;"></div>';
    h += '<textarea id="ddpMehfilMsg" rows="1" maxlength="500" placeholder="kuch likho or send dabao" oninput="ddpMentionInput(\'' + mehfilId + '\')"></textarea>';
    h += '<div class="ddp-msg-row"><label class="ddp-attach">📷 Attach<input type="file" accept="image/*" style="display:none" onchange="ddpMehfilImgSel(this)"/></label>';
    if (isOwner || canModerate) h += '<label class="ddp-sendall-chk"><input type="checkbox" id="ddpSendAllChk"/> Send All</label>';
    else h += '<label class="ddp-sendall-chk"><input type="checkbox" id="ddpSendAllChk"/> Send to Admin</label>';
    h += '<button class="ddp-send" onclick="ddpSendMehfilMsg(\'' + mehfilId + '\')">Send</button></div>';
    h += '<div id="ddpMehfilImgPrev" class="ddp-img-prev" style="display:none;">📷 Image attached and ready <button onclick="ddpMehfilImgClear()">✕</button></div></div>';
    h += '<div class="ddp-navbtn-row">';
    h += '<button id="ddpOnlineBtn_' + mehfilId + '" onclick="ddpShowOnlineList(\'' + mehfilId + '\')">🟢 Online</button>';
    h += '<button onclick="ddpMehfilInfoPage(\'' + mehfilId + '\')">ℹ️ Info</button>';
    if (canModerate) h += '<button onclick="showMehfilPanel(\'' + mehfilId + '\',\'settings\')">⚙️ Settings</button>';
    h += '<button onclick="showMehfilMembers(\'' + mehfilId + '\')">👥 ' + memberCount + '</button>';
    h += '</div>';
    h += '<div class="ddp-pills-row" id="ddpPills_' + mehfilId + '"></div>';
  }
  h += '<div id="mehfilChatArea" class="ddp-chat-area">';
  h += isMember ? '<p class="ddp-empty">Loading messages...</p>' : '<p class="ddp-empty">Join karke mehfil ki guftagu dekhein 💬</p>';
  h += '</div></div>';
  return h;
}

function loadMehfilTabs(tab) {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  container.style.marginTop = '82px';
  container.innerHTML = '<div id="ddpMehfil">' + ddpMehfilSubnav(tab) + '<div id="mehfilContent" class="ddp-content"></div></div>';
  loadMehfilContent(tab);
}
var ddpMehfilActiveTab = 'mehfils';
function ddpMehfilAlive(tab) { return ddpMehfilActiveTab === tab && document.getElementById('mehfilContent'); }
function loadMehfilContent(tab) {
  ddpMehfilActiveTab = tab;
  const tabs = ['create', 'explore', 'mehfils', 'invites'];
  const allBtns = document.querySelectorAll('#ddpMehfil .ddp-subnav-item');
  for (let i = 0; i < allBtns.length; i++) {
    allBtns[i].classList.toggle('active', tabs[i] === tab);
  }

  const content = document.getElementById('mehfilContent');
  if (!content) return;
  
  if (tab === 'mehfils') loadMyMehfilsUI();
  else if (tab === 'create') showCreateMehfilForm();
  else if (tab === 'explore') loadExploreMehfilsUI();
  else if (tab === 'invites') loadInvitesUI();
}

function showCreateMehfilForm() {
  const content = document.getElementById('mehfilContent');
  if (!content) return;
  window._ddpPickedTopic = '';
  let pillsHtml = '<div class="ddp-mtopic-pill" data-topic="Video Games" onclick="ddpPickMTopic(this)"><span class="tic">🎮</span><span>Video Games</span></div>' +
    '<div class="ddp-mtopic-pill" data-topic="Shughal & Fun" onclick="ddpPickMTopic(this)"><span class="tic">😜</span><span>Shughal & Fun</span></div>' +
    '<div class="ddp-mtopic-pill" data-topic="Relationships" onclick="ddpPickMTopic(this)"><span class="tic">💕</span><span>Relationships</span></div>' +
    '<div class="ddp-mtopic-pill" data-topic="Poetry & Literature" onclick="ddpPickMTopic(this)"><span class="tic">📖</span><span>Poetry & Literature</span></div>' +
    '<div class="ddp-mtopic-pill" data-topic="Religion" onclick="ddpPickMTopic(this)"><span class="tic">🕌</span><span>Religion</span></div>' +
    '<div class="ddp-mtopic-pill" data-topic="Exam Prep" onclick="ddpPickMTopic(this)"><span class="tic">📚</span><span>Exam Prep</span></div>' +
    '<div class="ddp-mtopic-pill" data-topic="Mixed interests" onclick="ddpPickMTopic(this)"><span class="tic">🧊</span><span>Mixed interests</span></div>';
  content.innerHTML = '<div style="background:#fff;padding:20px 15px;">' +
    '<div style="font-size:16px;color:#1e293b;text-align:center;margin-bottom:6px;font-weight:700;">Create new mehfil:</div>' +
    '<div style="font-size:13px;color:#475569;text-align:center;margin-bottom:16px;">Topic ke lehaz se select karein:</div>' +
    '<div id="ddpMTopicPills">' + pillsHtml + '</div>' +
    '<div style="max-width:340px;margin:16px auto 0;">' +
    '<div class="form-group"><label style="font-size:12px;color:#64748b;">Mehfil Name:</label>' +
    '<input id="mehfilName" placeholder="Mehfil ka naam likhein..." maxlength="50" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;"/></div>' +
    '<div class="form-group"><label style="font-size:12px;color:#64748b;">Privacy:</label>' +
    '<select id="mehfilPrivacy" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;background:#fff;box-sizing:border-box;"><option value="Everyone">🌍 Everyone (public)</option><option value="Private">🔒 Private (list me nahi dikhegi)</option></select></div>' +
    '<div class="form-group"><label style="font-size:12px;color:#64748b;">City (Optional):</label>' +
    '<input id="mehfilCity" placeholder="All cities" maxlength="30" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;"/></div>' +
    '</div>' +
    '<button class="ddp-create-btn" onclick="createMehfil()">CREATE MEHFIL</button>' +
    '</div>';
}
function ddpPickMTopic(el) {
  const pills = document.querySelectorAll('#ddpMTopicPills .ddp-mtopic-pill');
  for (let i = 0; i < pills.length; i++) pills[i].classList.remove('sel');
  el.classList.add('sel');
  window._ddpPickedTopic = el.getAttribute('data-topic');
}

async function createMehfil() {
  if (!currentUserId) { alert("Pehle login karein!"); return; }
  
  const nameEl = document.getElementById('mehfilName');
  const rulesEl = document.getElementById('mehfilRules');
  
  const name = nameEl ? nameEl.value.trim() : '';
  const topic = (window._ddpPickedTopic || '');
  const rules = rulesEl ? rulesEl.value.trim() : '';
  const privacyEl = document.getElementById('mehfilPrivacy');
  const cityEl = document.getElementById('mehfilCity');
  const privacy = privacyEl ? privacyEl.value : 'Everyone';
  const city = (cityEl && cityEl.value.trim()) ? cityEl.value.trim() : 'All cities';
  
  if (!name) { alert("Mehfil ka naam zaroori hai!"); return; }
  if (name.length < 2) { alert("Naam bohot chota hai!"); return; }
  if (!topic) { alert("Topic choose karein!"); return; }
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const members = {};
    members[currentUserId] = true;
    
    await db.ref('mehfils').push({
      name: name,
      topic: topic,
      rules: rules,
      privacy: privacy,
      city: city,
      creator: safeUser().username,
      uid: currentUserId,
      members: members,
      mods: {},
      banned: {},
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      lastActivity: firebase.database.ServerValue.TIMESTAMP,
      memberCount: 1
    });
    
    if (nameEl) nameEl.value = '';
    window._ddpPickedTopic = '';
    try { const _tp = document.querySelectorAll('.ddp-mtopic-pill.sel'); for (let _i = 0; _i < _tp.length; _i++) _tp[_i].classList.remove('sel'); } catch(e) {}
    if (rulesEl) rulesEl.value = '';
    
    alert('🎉 Mehfil create ho gayi!');
    loadMehfilContent('mehfils');
    
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

async function loadExploreMehfilsUI() {
  const content = document.getElementById('mehfilContent');
  if (!content) return;
  
  content.innerHTML = '<p style="text-align:center;padding:40px;">🔍 Loading mehfils...</p>';
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    /* Stage 3 perf: bounded to the 100 most recently active mehfils (was: full node read).
       Add ".indexOn": ["lastActivity"] to your Realtime Database rules for scale. */
    const snap = await db.ref('mehfils').orderByChild('lastActivity').limitToLast(100).once('value');
    
    if (!snap.exists()) {
      if (!ddpMehfilAlive('explore')) return;
      content.innerHTML = '<div style="text-align:center;padding:50px;"><div style="font-size:48px;">🏕️</div><p style="color:#94a3b8;margin-top:12px;">Koi mehfil nahi mili</p><p style="font-size:12px;color:#94a3b8;">Sab se pehli mehfil create karein!</p></div>';
      return;
    }
    
    const mehfils = [];
    snap.forEach(function(doc) {
      const m = doc.val();
      m.id = doc.key;
      mehfils.push(m);
    });
    
    mehfils.sort(function(a, b) {
      const aJoined = (a.members && a.members[currentUserId]) ? 1 : 0;
      const bJoined = (b.members && b.members[currentUserId]) ? 1 : 0;
      if (aJoined !== bJoined) return bJoined - aJoined;
      return (b.lastActivity || b.createdAt || 0) - (a.lastActivity || a.createdAt || 0);
    });
    
    let html = '<div class="ddp-main-title">Latest active mehfils:</div><div class="ddp-sub-title">"PRIVATE" mehfils are not shown</div>';

    for (let i = 0; i < mehfils.length; i++) {
      const m = mehfils[i];
      if ((m.privacy || 'Everyone') === 'Private') continue;
      const isMember = (m.members && m.members[currentUserId]);
      if (isMember) continue; /* (v88) Joined only in My Mehfils */
      const isBanned = (m.banned && m.banned[currentUserId]);
      html += ddpMehfilCardHTML(m, isBanned ? '🚫 Banned' : (isMember ? '✅ Joined' : ''), !!isBanned);
    }

    if (!ddpMehfilAlive('explore')) return;
    content.innerHTML = html;
    
  } catch(e) {
    if (!ddpMehfilAlive('explore')) return;
    content.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Error loading mehfils</p>';
  }
}

async function loadMyMehfilsUI() {
  const content = document.getElementById('mehfilContent');
  if (!content) return;
  
  content.innerHTML = '<p style="text-align:center;padding:40px;">Loading your mehfils...</p>';
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    /* Stage 3 perf: scan at most the 200 most recent mehfils for membership (was: full node read). */
    const snap = await db.ref('mehfils').orderByChild('createdAt').limitToLast(200).once('value');
    const myMehfils = [];
    snap.forEach(function(doc) {
      const m = doc.val();
      if (m.members && m.members[currentUserId]) {
        m.id = doc.key;
        myMehfils.push(m);
      }
    });
    
    if (myMehfils.length === 0) {
      if (!ddpMehfilAlive('mehfils')) return;
      content.innerHTML = '<div style="text-align:center;padding:50px;"><div style="font-size:48px;">🏕️</div><p style="color:#94a3b8;margin-top:12px;">Aap kisi mehfil ke member nahi hain</p><button onclick="loadMehfilContent(\'explore\')" style="margin-top:16px;padding:10px 24px;background:#14b8a6;color:#fff;border:none;border-radius:20px;font-size:14px;font-weight:600;cursor:pointer;">Explore Mehfils</button></div>';
      return;
    }
    
    myMehfils.sort(function(a, b) { return (b.lastActivity || b.createdAt || 0) - (a.lastActivity || a.createdAt || 0); });
    
    let html = '<div class="ddp-main-title">My mehfils:</div><div class="ddp-sub-title">Mehfils you have joined</div>';

    for (let i = 0; i < myMehfils.length; i++) {
      const m = myMehfils[i];
      const isOwner = (m.uid === currentUserId);
      html += ddpMehfilCardHTML(m, (isOwner ? '👑 Owner ' : '') + '✅ Joined', false);
    }

    if (!ddpMehfilAlive('mehfils')) return;
    content.innerHTML = html;
    
  } catch(e) {
    if (!ddpMehfilAlive('mehfils')) return;
    content.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Error loading mehfils</p>';
  }
}

async function loadInvitesUI() {
  const content = document.getElementById('mehfilContent');
  if (!content) return;
  
  content.innerHTML = '<p style="text-align:center;padding:40px;">📩 Loading invites...</p>';
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const snap = await db.ref('notifications').orderByChild('toUid').equalTo(currentUserId).once('value');
    const invites = [];
    snap.forEach(function(doc) {
      const n = doc.val();
      if (n.type === 'mehfil_invite' && !n.autoDismissed) {
        invites.push({ id: doc.key, mehfilId: n.mehfilId, fromUser: n.sender_name, timestamp: n.timestamp });
      }
    });
    
    if (invites.length === 0) {
      if (!ddpMehfilAlive('invites')) return;
      content.innerHTML = '<div style="text-align:center;padding:50px;"><div style="font-size:48px;">📭</div><p style="color:#94a3b8;margin-top:12px;">Koi pending invites nahi hain</p></div>';
      return;
    }
    
    let html = '<div style="padding:10px 0;"><div style="padding:8px 15px;font-weight:700;font-size:14px;color:#1e293b;">📩 Pending Invites (' + invites.length + ')</div>';
    
    for (let i = 0; i < invites.length; i++) {
      const inv = invites[i];
      const mehfilSnap = await db.ref('mehfils/' + inv.mehfilId).once('value');
      const m = mehfilSnap.val() || {};
      const cfg = categoryConfig[m.topic] || { icon: '📌' };
      const timeText = inv.timestamp ? timeAgo(new Date(inv.timestamp)) : '';
      
      html += '<div style="background:#fff;margin:8px 15px;border-radius:12px;padding:14px;border:1px solid #e5e7eb;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:18px;">' + cfg.icon + '</span></div>' +
        '<div style="flex:1;">' +
        '<div style="font-weight:700;font-size:13px;">' + esc(m.name || 'Mehfil') + '</div>' +
        '<div style="font-size:11px;color:#94a3b8;">Invited by: ' + esc(inv.fromUser || 'Someone') + ' • ' + timeText + '</div>' +
        '</div></div>' +
        '<div style="display:flex;gap:8px;">' +
        '<button onclick="acceptMehfilInvite(\'' + inv.mehfilId + '\',\'' + inv.id + '\')" style="flex:1;padding:10px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">✅ Accept</button>' +
        '<button onclick="declineMehfilInvite(\'' + inv.mehfilId + '\',\'' + inv.id + '\')" style="flex:1;padding:10px;background:#fff;color:#dc2626;border:1.5px solid #fca5a5;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">❌ Decline</button>' +
        '</div></div>';
    }
    
    html += '</div>';
    if (!ddpMehfilAlive('invites')) return;
    content.innerHTML = html;
    
  } catch(e) {
    if (!ddpMehfilAlive('invites')) return;
    content.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Error loading invites</p>';
  }
}

async function acceptMehfilInvite(mid, nid) {
  const { db } = getFirebase();
  if (!db) return;
  try {
    const doc = await db.ref('mehfils/' + mid).once('value');
    const m = doc.val();
    if (!m) { alert('Mehfil not found!'); return; }
    
    if ((m.banned || {})[currentUserId]) {
      alert('🚫 Aap is mehfil se banned hain!');
      await db.ref('notifications/' + nid).remove();
      return;
    }
    
    await db.ref('mehfils/' + mid + '/members/' + currentUserId).set(true);
    await db.ref('mehfils/' + mid).update({ memberCount: (m.memberCount || 0) + 1 });
    await db.ref('notifications/' + nid).remove();
    
    alert('🎉 Mehfil join kar li!');
    updateInboxBadge();
    loadMehfilContent('mehfils');
    
  } catch(e) { alert('Error: ' + e.message); }
}

async function declineMehfilInvite(mid, nid) {
  const { db } = getFirebase();
  if (!db) return;
  await db.ref('notifications/' + nid).remove();
  updateInboxBadge();
  loadMehfilContent('invites');
}

function confirmLeaveMehfil(mid) {
  if (!confirm('Kya aap really ye mehfil chorna chahte hain?')) return;
  leaveMehfil(mid);
}

async function leaveMehfil(mid) {
  const { db } = getFirebase();
  if (!db) return;
  try {
    await db.ref('mehfils/' + mid + '/members/' + currentUserId).remove();
    await db.ref('mehfils/' + mid + '/online/' + currentUserId).remove();
    if (window._presenceMehfils) delete window._presenceMehfils[mid];
    
    const snap = await db.ref('mehfils/' + mid).once('value');
    const m = snap.val() || {};
    await db.ref('mehfils/' + mid).update({ memberCount: Math.max(0, (m.memberCount || 1) - 1) });
    
    alert('Mehfil chor di!');
    loadMehfilContent('mehfils');
    
  } catch(e) { alert('Error leaving mehfil'); }
}

async function joinMehfil(mid) {
  if (!currentUserId) { alert("Pehle login karein!"); return; }
  
  const { db } = getFirebase();
  if (!db) return;
  try {
    const doc = await db.ref('mehfils/' + mid).once('value');
    const m = doc.val();
    
    if (!m) { alert('Mehfil not found!'); return; }
    if ((m.banned || {})[currentUserId]) { alert('🚫 Aap banned hain!'); return; }
    if ((m.members || {})[currentUserId]) { alert('Aap pehle se member hain!'); return; }
    
    await db.ref('mehfils/' + mid + '/members/' + currentUserId).set(true);
    await db.ref('mehfils/' + mid).update({ memberCount: (m.memberCount || 0) + 1 });
    
    alert('Mehfil join kar li! 🎉');
    loadMehfilContent('mehfils');
    
  } catch(e) { alert('Error joining mehfil'); }
}

/* loadAllMehfils removed (Stage 3): it did a full `mehfils` read on every login/join/leave
   but its result was never read anywhere. The explore list fetches its own bounded query. */

/* (v145) Audit fix: inbox "Open Mehfil" button ka missing function */
function openMehfilChat(mehfilId) { if (!mehfilId) return; openMehfil(mehfilId); }
async function openMehfil(mehfilId, isBack) {
  if (!isBack) {
    NavigationHistory.push('mehfil', { mehfilId: mehfilId });
  }
  
  currentMehfilId = mehfilId;
  const topHeader = document.querySelector('.top-header');
  const subNav = document.querySelector('.sub-nav');
  if (topHeader) topHeader.style.display = 'none';
  if (subNav) subNav.style.display = 'none';
  const container = document.getElementById('main-content-area');
  if (!container) return;
  hideSortBar();
  container.style.marginTop = '0px';
  
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const doc = await db.ref('mehfils/' + mehfilId).once('value');
    const m = doc.val();
    
    if (!m) {
      container.innerHTML = '<div style="text-align:center;padding:40px;background:#fff;">' +
        '<p style="color:red;">Mehfil not found!</p>' +
        '<button onclick="openPage(\'mehfils\')" style="margin-top:12px;padding:10px 20px;background:#14b8a6;color:#fff;border:none;border-radius:8px;cursor:pointer;">← Back to Mehfils</button>' +
        '</div>';
      return;
    }
    
    const isMember = (m.members && m.members[currentUserId]);
    const isAdmin = (m.uid === currentUserId);
    const mods = m.mods || {};
    const isMod = mods[currentUserId] === true;
    const canModerate = (isAdmin || isMod);
    const topicIcon = (categoryConfig[m.topic] || { icon: '📌' }).icon;
    const memberCount = m.memberCount || Object.keys(m.members || {}).length;
    
    if (!isMember) {
      const isBanned = (m.banned || {})[currentUserId];
      if (isBanned) {
        container.innerHTML = '<div id="ddpMehfil"><div style="text-align:center;padding:50px 20px;">' +
          '<div style="font-size:48px;">🚫</div>' +
          '<p style="font-size:16px;color:#dc2626;margin-top:12px;">Aap is mehfil se banned hain!</p>' +
          '<button onclick="openPage(\'mehfils\')" style="margin-top:20px;padding:10px 20px;background:#8e24aa;color:#fff;border:none;border-radius:4px;cursor:pointer;">← Back</button>' +
          '</div></div>';
        return;
      }
      container.innerHTML = ddpMehfilShellHTML(mehfilId, m, false);
      loadMehfilPreview(mehfilId, m);
      return;
    }

    container.innerHTML = ddpMehfilShellHTML(mehfilId, m, true);
    
    loadMehfilMessages(mehfilId);
    loadMehfilOnlineBar(mehfilId);
    setupMehfilOnlinePresence(mehfilId);
    
    setTimeout(function() {
      const inp = document.getElementById('ddpMehfilMsg');
      if (inp) inp.focus();
    }, 500);
    
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;"><p style="color:red;">Error opening mehfil</p><button onclick="openPage(\'mehfils\')" style="margin-top:12px;padding:10px 20px;background:#14b8a6;color:#fff;border:none;border-radius:8px;cursor:pointer;">← Back</button></div>';
  }
  saveViewState({ mehfilId: mehfilId });
}

async function loadMehfilMessages(mehfilId) {
  const chatArea = document.getElementById('mehfilChatArea');
  if (!chatArea) return;

  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return;

  if (mehfilListener) mehfilListener.off();

  ddpMarkMehfilActive(mehfilId);
  ddpUpdateOnlineBtn(mehfilId);
  try { if (window._ddpOnlineTimer) clearInterval(window._ddpOnlineTimer); } catch(e) {}
  window._ddpOnlineTimer = setInterval(function() {
    if (!document.getElementById('ddpOnlineBtn_' + mehfilId)) { try { clearInterval(window._ddpOnlineTimer); } catch(e) {} return; }
    ddpMarkMehfilActive(mehfilId);
    ddpUpdateOnlineBtn(mehfilId);
  }, 60000);
  /* (v136) FIX: mehfil me bhi wahi 1on1 wala masla — naya msg ate hi poori list dobara banti hai aur khula hua inline reply box + likha hua mit jata hai */
  const _saveMehfilDrafts = function() {
    const drafts = {};
    let focused = null;
    try {
      const inputs = document.querySelectorAll('[id^="ddpReplyInput_"]');
      for (let i = 0; i < inputs.length; i++) {
        const inp = inputs[i];
        const mid = inp.id.replace('ddpReplyInput_', '');
        const bx = document.getElementById('ddpReplyBox_' + mid);
        if (bx && bx.style.display !== 'none') {
          drafts[mid] = inp.value;
          if (document.activeElement === inp) focused = mid;
        }
      }
    } catch (e) {}
    return { drafts: drafts, focused: focused };
  };
  const _restoreMehfilDrafts = function(saved) {
    if (!saved) return;
    try {
      Object.keys(saved.drafts).forEach(function(mid) {
        const bx = document.getElementById('ddpReplyBox_' + mid);
        const inp = document.getElementById('ddpReplyInput_' + mid);
        if (bx && inp) { bx.style.display = 'block'; inp.value = saved.drafts[mid]; }
      });
      if (saved.focused) {
        const fi = document.getElementById('ddpReplyInput_' + saved.focused);
        if (fi) { fi.focus(); try { const l = fi.value.length; fi.setSelectionRange(l, l); } catch (e2) {} }
      }
    } catch (e) {}
  };
  let _mSaved = null;
  mehfilListener = db.ref('mehfil_posts/' + mehfilId).orderByChild('time').limitToLast(50);
  mehfilListener.on('value', async function(snap) {
    const msgs = [];
    snap.forEach(function(c) {
      const msg = c.val();
      msg.id = c.key;
      if (msg.hidden && !msg.deleted) return;
      msgs.push(msg);
    });

    msgs.sort(function(a, b) {
      return (b.time || 0) - (a.time || 0);
    });

    const ca = document.getElementById('mehfilChatArea');
    if (!ca) return;
    _mSaved = _saveMehfilDrafts();

    if (msgs.length === 0) {
      ca.innerHTML = '<p class="ddp-empty">No messages yet. Start the conversation! 👋</p>';
      return;
    }

    const userIds = [...new Set(msgs.map(function(m) { return m.userId; }).filter(Boolean))];
    const userData = await batchGetUsers(userIds);

    /* speed: cache mehfil meta 60s — avoids a doc read on EVERY new message */
    let m = null;
    try {
      const _mc = window._ddpMehfilMeta;
      if (_mc && _mc.id === mehfilId && (Date.now() - _mc.t) < 60000) { m = _mc.m; }
      else {
        const doc = await db.ref('mehfils/' + mehfilId).once('value');
        m = doc.val() || {};
        window._ddpMehfilMeta = { id: mehfilId, m: m, t: Date.now() };
      }
    } catch(e) { m = m || {}; }
    const canModerate = (m.uid === currentUserId) || ((m.mods || {})[currentUserId] === true);
    const isAfsar = !!((m.afsars || {})[currentUserId]);
    const canDelete = canModerate || isAfsar;

    let h = '';
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const user = userData[msg.userId] || { username: msg.user || 'User' };
      h += ddpMehfilMsgHTML(msg, mehfilId, user.username || msg.user || 'User', canModerate, canDelete);
    }
    _mSaved = _saveMehfilDrafts();
    const ca2 = document.getElementById('mehfilChatArea');
    if (ca2) ca2.innerHTML = h;
    _restoreMehfilDrafts(_mSaved);
  });
}


/* (v111) Mehfil preview: non-member ko akhri 30 chats sirf dekhne ke liye.
   One-time read (live listener nahi), actions CSS se chhupi hui.
   Private mehfil ka preview nahi — wahan sirf join card rahega. */
async function loadMehfilPreview(mehfilId, m) {
  try {
    if (m && (m.privacy || 'Everyone') === 'Private') return;
    const ca = document.getElementById('mehfilChatArea');
    if (!ca) return;
    ca.classList.add('ddp-preview');
    ca.innerHTML = '<p class="ddp-empty">Chats ka preview load ho raha hai...</p>';
    const fb = getFirebase(); const db = fb && fb.db;
    if (!db) return;
    const snap = await db.ref('mehfil_posts/' + mehfilId).orderByChild('time').limitToLast(30).once('value');
    const msgs = [];
    snap.forEach(function(c) {
      const msg = c.val(); msg.id = c.key;
      if (msg.hidden && !msg.deleted) return;
      msgs.push(msg);
    });
    msgs.sort(function(a, b) { return (b.time || 0) - (a.time || 0); });
    const ca2 = document.getElementById('mehfilChatArea');
    if (!ca2) return;
    if (msgs.length === 0) {
      ca2.innerHTML = '<p class="ddp-empty">Abhi koi chat nahi — JOIN karke pehli chat karein 👋</p>';
      return;
    }
    const userIds = [...new Set(msgs.map(function(x) { return x.userId; }).filter(Boolean))];
    const userData = await batchGetUsers(userIds);
    let h = '';
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const user = userData[msg.userId] || { username: msg.user || 'User' };
      h += ddpMehfilMsgHTML(msg, mehfilId, user.username || msg.user || 'User', false, false);
    }
    const ca3 = document.getElementById('mehfilChatArea');
    if (ca3) ca3.innerHTML = h;
  } catch(e) { /* preview fail ho to join-card hi rahega */ }
}

async function ddpMakeAfsar(mehfilId, uid) {
  if (!confirm('Is user ko Afsar banana hai? Afsar dusron ki chat mita sakega.')) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    const _am = (await db.ref('mehfils/' + mehfilId).once('value')).val() || {};
    if (_am.uid !== currentUserId) { alert('Sirf mehfil admin afsar bana sakta hai.'); return; }
    if (uid === _am.uid) return;
    const u = await UserCache.get(uid);
    await db.ref('mehfils/' + mehfilId + '/afsars/' + uid).set({
      username: (u && u.username) || uid, appointedBy: currentUserId, ts: Date.now()
    });
    showMehfilMembers(mehfilId);
  } catch(e) { alert('Error: ' + e.message); }
}
async function ddpTransferMehfil(mehfilId) {
  try {
    const { db } = getFirebase();
    if (!db) return;
    const snap = await db.ref('mehfils/' + mehfilId).once('value');
    const m = snap.val() || {};
    if (m.uid !== currentUserId) { alert('Sirf admin transfer kar sakta hai.'); return; }
    const members = Object.keys(m.members || {}).filter(function(x) { return x !== currentUserId; });
    if (members.length === 0) { alert('Koi aur member nahi hai.'); return; }
    let opts = 'Kis ko admin banana hai?\n';
    const names = [];
    for (let i = 0; i < Math.min(members.length, 20); i++) {
      const u = await UserCache.get(members[i]);
      const nm = (u && u.username) || members[i];
      names.push({ uid: members[i], name: nm });
      opts += (i + 1) + '. ' + nm + '\n';
    }
    const choice = prompt(opts + '\nNumber likhein (1-' + names.length + '):');
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= names.length) return;
    const nu = names[idx];
    if (!confirm('"' + nu.name + '" ko mehfil ka admin banana hai? Aap admin nahi rahenge!')) return;
    /* (v110) Mukammal transfer: uid ke sath creator name bhi naye admin ka, membership/memberCount theek,
       naye admin ki afsar entry saaf, aur purana meta cache invalidate - warna 60 second tak purana admin
       hi admin rehta aur naye admin ko powers na milte. Profile page uid se parhta hai, is liye mehfil ab
       naye admin ki profile me show hogi. */
    await db.ref('mehfils/' + mehfilId).update({ uid: nu.uid, creator: nu.name });
    try { await db.ref('mehfils/' + mehfilId + '/members/' + nu.uid).set(true); } catch(e) {}
    try { await db.ref('mehfils/' + mehfilId + '/afsars/' + nu.uid).remove(); } catch(e) {}
    try {
      const _nm = (await db.ref('mehfils/' + mehfilId).once('value')).val() || {};
      await db.ref('mehfils/' + mehfilId).update({ memberCount: Object.keys(_nm.members || {}).length });
    } catch(e) {}
    try { if (window._ddpMehfilMeta && window._ddpMehfilMeta.id === mehfilId) window._ddpMehfilMeta.t = 0; } catch(e) {}
    alert('Mehfil transfer ho gayi! Naya admin: ' + nu.name);
    ddpBackToChat(mehfilId);
  } catch(e) { alert('Error: ' + e.message); }
}
async function ddpRemoveAfsar(mehfilId, uid) {
  if (!confirm('Afsar se hatana hai?')) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    const _rm = (await db.ref('mehfils/' + mehfilId).once('value')).val() || {};
    if (_rm.uid !== currentUserId) { alert('Sirf mehfil admin afsar hata sakta hai.'); return; }
    await db.ref('mehfils/' + mehfilId + '/afsars/' + uid).remove();
    showMehfilMembers(mehfilId);
  } catch(e) { alert('Error: ' + e.message); }
}
async function hideMehfilMsg(mehfilId, msgId) {
  if (!confirm('Is message ko mitana hai?')) return;
  const { db } = getFirebase();
  if (!db) return;
  let role = 'admin';
  try {
    const ms = await db.ref('mehfils/' + mehfilId).once('value');
    const mv = ms.val() || {};
    const _isStaff = (mv.uid === currentUserId) || !!((mv.mods || {})[currentUserId]) || !!((mv.afsars || {})[currentUserId]);
    if (!_isStaff) { alert('Aap ko chat mitane ki ijazat nahi.'); return; }
    if ((mv.afsars || {})[currentUserId] && mv.uid !== currentUserId && !(mv.mods || {})[currentUserId]) role = 'afsar';
  } catch(e) {}
  await db.ref('mehfil_posts/' + mehfilId + '/' + msgId).update({
    deleted: true, deletedBy: role, deletedByName: safeUser().username, deletedAt: Date.now()
  });
}

/* H4: detach all mehfil online-bar listeners (called on logout via cleanupListeners) */
function detachMehfilOnlineBars() {
  const refs = window._mehfilOnlineRefs || {};
  Object.keys(refs).forEach(function(k) { try { refs[k].off(); } catch (e) {} });
  window._mehfilOnlineRefs = {};
}

function loadMehfilOnlineBar(mehfilId) {
  const bar = document.getElementById('ddpPills_' + mehfilId);
  if (!bar) return;

  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return;

  /* one active listener per mehfil — detach the previous one before re-attaching */
  window._mehfilOnlineRefs = window._mehfilOnlineRefs || {};
  if (window._mehfilOnlineRefs[mehfilId]) { try { window._mehfilOnlineRefs[mehfilId].off(); } catch (e) {} }
  const __onlineRef = db.ref('mehfils/' + mehfilId + '/online');
  window._mehfilOnlineRefs[mehfilId] = __onlineRef;
  __onlineRef.on('value', function(snap) {
    const b = document.getElementById('ddpPills_' + mehfilId);
    if (!b) return;
    if (!snap.exists()) { b.innerHTML = ''; return; }
    const users = [];
    const now = Date.now();
    const _stale = [];
    snap.forEach(function(doc) {
      const d = doc.val();
      let last = 0;
      if (d.lastSeen) {
        if (typeof d.lastSeen === 'object' && d.lastSeen.toDate) last = d.lastSeen.toDate().getTime();
        else last = d.lastSeen;
      }
      /* (v27) 5 min se zyada purani entries self-clean (stale presence) */
      if (now - last > 300000 && doc.key !== currentUserId) { _stale.push(doc.key); return; }
      users.push({ uid: d.uid || doc.key, username: d.username || 'user', online: (now - last < 120000), lastSeenTs: last });
    });
    if (_stale.length > 0) {
      try {
        const _db2 = (function(){ try { return getFirebase().db; } catch(e) { return null; } })();
        if (_db2) { const _b = {}; for (let _si = 0; _si < _stale.length; _si++) _b['mehfils/' + mehfilId + '/online/' + _stale[_si]] = null; _db2.ref().update(_b); }
      } catch(e) {}
    }
    users.sort(function(a, b) { return (b.online - a.online); });
    let h = '';
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      /* (v26) online = green dot, offline = gray dot + "Xm ago" */
      const _dot = u.online
        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:5px;"></span>'
        : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#9ca3af;margin-right:5px;"></span>';
      const _ago = u.online ? '' : '<span style="font-size:10px;color:#9ca3af;margin-left:4px;">' + ddpAgoShort(u.lastSeenTs) + '</span>';
      h += '<button class="user-pill" onclick="ddpInsertMention(\'' + escAttrJS(u.username) + '\')">' + _dot + '@' + esc(u.username) + _ago + '</button>';
    }
    b.innerHTML = h;
    /* cache online uids for message dots + refresh dot colors live */
    try {
      window._ddpOnlineUids = window._ddpOnlineUids || {};
      const set = {};
      for (let k = 0; k < users.length; k++) if (users[k].online) set[users[k].uid] = true;
      window._ddpOnlineUids[mehfilId] = { has: function(uid) { return !!set[uid]; } };
      const dots = document.querySelectorAll('.ddp-dot[data-uid]');
      for (let d = 0; d < dots.length; d++) {
        const on = !!set[dots[d].getAttribute('data-uid')];
        dots[d].classList.toggle('online', on);
        dots[d].classList.toggle('offline', !on);
      }
    } catch(e) {}
  });
}

function setupMehfilOnlinePresence(mehfilId) {
  if (!currentUserId) return;
  const { db } = getFirebase();
  if (!db) return;
  /* Stage 3: track session presence so logout can clean up without scanning all mehfils */
  window._presenceMehfils = window._presenceMehfils || {};
  window._presenceMehfils[mehfilId] = true;
  db.ref('mehfils/' + mehfilId + '/online/' + currentUserId).set({
    uid: currentUserId,
    username: safeUser().username,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });
  db.ref('mehfils/' + mehfilId + '/online/' + currentUserId).onDisconnect().remove();
}


/* ===== v147 block (orig theme lines 7919-9244) ===== */

/* ===== SITE ADMIN PANEL =====
   TWO LEVELS OF ADMIN:
   1. SUPER ADMINS (SITE_ADMINS below): full access, managed only by editing the
      theme file and re-uploading. They can never be removed from the panel.
   2. DELEGATED ADMINS: stored in Firebase at admins/<uid> = { posts:true,
      reports:true, ban:true, admins:true }. Super admins (and anyone with the
      "Manage admins" permission) can grant/revoke these from the Users tab.
   PERMISSIONS: posts = delete posts | reports = manage reports |
                ban = ban/unban users | admins = manage other admins */
const SITE_ADMINS = ['cr83cDZ4jYc1XtYt67jvUuEtX4f2','cr83cDZ4jYclXtYt67jvUuEtX4f2','o1v6E1Fx1BeOEn8QN8dT1GpPU2S2'] /* (v138) damadam bhi super admin */;
const ADMIN_PERM_LABELS = { posts: 'Delete posts', reports: 'Manage reports', ban: 'Ban users', admins: 'Manage admins' };
window._isSiteAdmin = false;
window._adminPerms = null; /* null = not loaded yet; object = granted permissions */
window._adminTab = 'reports';

function isSuperAdminUid(uid) { return !!(uid && SITE_ADMINS.indexOf(uid) !== -1); }
function isSuperAdmin() { return isSuperAdminUid(currentUserId); }

async function checkSiteAdmin() {
  window._isSiteAdmin = false;
  window._adminPerms = null;
  try {
    const fb = getFirebase();
    if (fb && fb.db && currentUserId) {
      if (isSuperAdmin()) {
        window._isSiteAdmin = true;
        window._adminPerms = { posts: true, reports: true, ban: true, admins: true };
      } else {
        const snap = await fb.db.ref('admins/' + currentUserId).once('value');
        const v = snap.val();
        if (v) {
          window._isSiteAdmin = true;
          window._adminPerms = (v === true) ? { posts: true, reports: true, ban: true } : v;
        }
      }
    }
  } catch (e) { /* stay non-admin on error */ }
  refreshAdminTile();
}

function hasPerm(p) {
  if (!currentUserId || !window._isSiteAdmin) return false;
  if (isSuperAdmin()) return true;
  return !!(window._adminPerms && window._adminPerms[p]);
}

function requirePerm(p) {
  if (!requireSiteAdmin()) return false;
  if (!hasPerm(p)) {
    alert('⛔ You do not have the "' + (ADMIN_PERM_LABELS[p] || p) + '" permission.');
    return false;
  }
  return true;
}

function refreshAdminTile() {
  try {
    const tile = document.getElementById('adminTile');
    if (tile) tile.style.display = (window._isSiteAdmin && currentUserId) ? '' : 'none';
  } catch (e) {}
}

// Shows the "GET APP" tile in the MORE menu and the "Download App" link on the
// login screen, only when APP_DOWNLOAD_URL is set.
function refreshAppDownloadTile() {
  try {
    const tile = document.getElementById('appDownloadTile');
    if (tile) tile.style.display = APP_DOWNLOAD_URL ? '' : 'none';
    const loginLink = document.getElementById('loginAppLink');
    if (loginLink) loginLink.style.display = APP_DOWNLOAD_URL ? '' : 'none';
  } catch (e) {}
}
refreshAppDownloadTile();

// Wires [data-app-download] buttons inside static pages (the "Download App"
// install guide) to the configured APK link. Same-window navigation so the
// Android app's DownloadManager can intercept it.
function wireAppDownloadButtons(root) {
  try {
    var btns = root.querySelectorAll('[data-app-download]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        if (APP_DOWNLOAD_URL) {
          btn.setAttribute('href', APP_DOWNLOAD_URL);
        } else {
          btn.setAttribute('href', '#');
          btn.style.opacity = '0.55';
          btn.onclick = function (e) {
            if (e) e.preventDefault();
            alert('App download link coming soon.');
            return false;
          };
        }
      })(btns[i]);
    }
  } catch (e) {}
}

function requireSiteAdmin() {
  if (!currentUserId || !window._isSiteAdmin) {
    alert('⛔ Admins only.');
    return false;
  }
  return true;
}

async function openAdminPanel(container) {
  /* (v145) Audit fix: admin flag ka wait karo — login ke foran baad ADMIN dabane par "Admin only!" na aaye */
  if (!window._isSiteAdmin) { try { await checkSiteAdmin(); } catch(e) {} }
  if (!requireSiteAdmin()) { navigateToInternal('home', {}, true); return; }
  currentView = 'admin';
  const tabBtn = function(id, label) {
    return '<button id="' + id + '" onclick="adminShowTab(\'' + id.replace('admTab', '').toLowerCase() + '\')" style="flex:1;padding:10px;border:none;border-radius:10px;font-weight:700;cursor:pointer;">' + label + '</button>';
  };
  container.innerHTML =
    '<div style="padding:12px;">' +
    '<div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;padding:14px;border-radius:12px;margin-bottom:12px;">' +
    '<div style="font-size:18px;font-weight:800;">🛡️ Admin Panel' + (isSuperAdmin() ? ' <span style="font-size:10px;background:rgba(255,255,255,.25);padding:2px 8px;border-radius:8px;">SUPER ADMIN</span>' : '') + '</div>' +
    '<div style="font-size:11px;opacity:.85;margin-top:4px;">Your user ID: <span style="font-family:monospace;word-break:break-all;">' + esc(currentUserId) + '</span></div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
    (hasPerm('reports') ? tabBtn('admTabReports', '🚩 Reports') : '') +
    (hasPerm('posts') ? tabBtn('admTabPosts', '📝 Posts') : '') +
    tabBtn('admTabUsers', '👥 Users') +
    (isSuperAdmin() ? tabBtn('admTabActivity', '📊 Activity') : '') +
    '</div>' +
    '<div id="adminContent"><p style="text-align:center;color:#94a3b8;">Loading…</p></div>' +
    '</div>';
  adminShowTab(hasPerm('reports') ? 'reports' : (hasPerm('posts') ? 'posts' : 'users'));
}

function adminShowTab(tab) {
  if (!requireSiteAdmin()) return;
  if (tab === 'reports' && !requirePerm('reports')) return;
  if (tab === 'posts' && !requirePerm('posts')) return;
  window._adminTab = tab;
  ['reports', 'posts', 'users', 'activity'].forEach(function(t) {
    const b = document.getElementById('admTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (b) {
      const active = (t === tab);
      b.style.background = active ? '#4f46e5' : '#eef2ff';
      b.style.color = active ? '#fff' : '#4f46e5';
    }
  });
  if (tab === 'reports') adminLoadReports();
  else if (tab === 'posts') adminLoadPosts();
  else if (tab === 'activity') { if (!isSuperAdmin()) return; adminLoadActivity(); }
  else adminShowUsers();
}

async function adminLoadReports() {
  const box = document.getElementById('adminContent');
  if (!box || !requirePerm('reports')) return;
  box.innerHTML = '<p style="text-align:center;color:#94a3b8;">Loading reports…</p>';
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const snap = await db.ref('reports').orderByChild('timestamp').limitToLast(50).once('value');
    const reps = [];
    snap.forEach(function(c) { const r = c.val() || {}; r.id = c.key; reps.push(r); });
    reps.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    if (!reps.length) { box.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:30px;">No reports 🎉</p>'; return; }
    let h = '';
    reps.forEach(function(r) {
      h += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:8px;">' +
        '<div style="font-size:13px;font-weight:700;">🚩 ' + esc(r.reason || 'Report') + '</div>' +
        '<div style="font-size:11px;color:#64748b;margin:4px 0;">By ' + esc(r.reportedByUser || 'unknown') +
        ' • ' + (r.timestamp ? timeAgo(new Date(r.timestamp)) : '') + '</div>' +
        '<div style="font-size:10px;color:#94a3b8;font-family:monospace;word-break:break-all;">post: ' + esc(r.postId || '') + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:8px;">' +
        '<button onclick="adminViewPost(\'' + r.postId + '\')" style="flex:1;padding:8px;background:#eef2ff;color:#4f46e5;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">View</button>' +
        '<button onclick="adminDeletePost(\'' + r.postId + '\',\'' + r.id + '\')" style="flex:1;padding:8px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Delete post</button>' +
        '<button onclick="adminDismissReport(\'' + r.id + '\')" style="flex:1;padding:8px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Dismiss</button>' +
        '</div></div>';
    });
    box.innerHTML = h;
  } catch (e) {
    box.innerHTML = '<p style="color:red;text-align:center;">Error loading reports</p>';
  }
}

async function adminViewPost(postId) {
  if (!requireSiteAdmin()) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    const snap = await db.ref('posts/' + postId).once('value');
    const p = snap.val();
    if (!p) { alert('Post not found (may already be deleted).'); return; }
    showFullPost(postId, p.image_url ? 'image' : 'text');
  } catch (e) { alert('Could not load post.'); }
}

async function adminDeletePost(postId, reportId) {
  if (!requirePerm('posts')) return;
  if (!confirm('Delete this post permanently?')) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    /* (2026-10-10) RULE: profile Total likes KABHI kam nahi hote — admin delete par minus NAHI karna. */
    await db.ref('posts/' + postId).remove();
    if (reportId) { try { await db.ref('reports/' + reportId).remove(); } catch (e) {} }
    clearPostCache();
    alert('🗑️ Post deleted.');
    adminShowTab(window._adminTab || 'reports');
  } catch (e) { alert('Error deleting post: ' + e.message); }
}

async function adminDismissReport(reportId) {
  if (!requirePerm('reports')) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    await db.ref('reports/' + reportId).remove();
    adminShowTab('reports');
  } catch (e) { alert('Error dismissing report.'); }
}

/* (v134) Activity Report tabs: summary cards ab tabs hain — card par tap karo to sirf wahi section dikhega */
async function adminLoadActivity() {
  const box = document.getElementById('adminContent');
  if (!box) return;
  if (!isSuperAdmin()) { box.innerHTML = '<p style="text-align:center;color:#dc2626;padding:30px;">⛔ Super admins only.</p>'; return; }
  box.innerHTML = '<p style="text-align:center;color:#94a3b8;">Activity report ban rahi hai…</p>';
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const now = Date.now();
    const DAY = 86400000;
    const snapS = await db.ref('status').once('value');
    const snapU = await db.ref('users').once('value');
    const users = {};
    snapU.forEach(function(doc) { users[doc.key] = doc.val() || {}; });
    const active = [];
    snapS.forEach(function(doc) {
      const s = doc.val() || {};
      const la = Number(s.last_active) || 0;
      if (la > 0 && (now - la) < DAY) active.push({ uid: doc.key, lastActive: la });
    });
    const fresh = [];
    Object.keys(users).forEach(function(uid) {
      const u = users[uid];
      const j = Number(u.joined) || 0;
      if (j > 0 && (now - j) < DAY) fresh.push({ uid: uid, joined: j });
    });
    const byIP = {};
    let noIPActive = 0;
    active.forEach(function(a) {
      const u = users[a.uid] || {};
      const ip = u.lastIP || '';
      if (!ip) { noIPActive++; return; }
      if (!byIP[ip]) byIP[ip] = [];
      byIP[ip].push(a);
    });
    const ipGroups = Object.keys(byIP).map(function(ip) { return { ip: ip, ids: byIP[ip] }; });
    ipGroups.sort(function(a, b) { return b.ids.length - a.ids.length || a.ip.localeCompare(b.ip); });
    const multi = ipGroups.filter(function(g) { return g.ids.length >= 2; });
    let sharedIds = 0;
    multi.forEach(function(g) { sharedIds += g.ids.length; });
    active.sort(function(a, b) { return b.lastActive - a.lastActive; });
    fresh.sort(function(a, b) { return b.joined - a.joined; });
    window._ddpActivityData = { now: now, users: users, active: active, fresh: fresh, ipGroups: ipGroups, multi: multi, sharedIds: sharedIds, noIPActive: noIPActive };
    adminRenderActivity(window._ddpActivityFilter || 'all');
  } catch (e) { box.innerHTML = '<p style="color:red;text-align:center;">Error: ' + esc(e.message) + '</p>'; }
}

function adminRenderActivity(filter) {
  const box = document.getElementById('adminContent');
  const d = window._ddpActivityData;
  if (!box || !d) return;
  window._ddpActivityFilter = filter;
  const users = d.users;
  const uname = function(uid) { const u = users[uid] || {}; return u.username || uid.substring(0, 8); };
  const bannedBadge = function(uid) { return (users[uid] && users[uid].banned) ? ' <span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:8px;">BANNED</span>' : ''; };
  const userChip = function(uid) { return '<span style="cursor:pointer;font-weight:700;color:#1e293b;" onclick="goToUserProfile(\'' + uid + '\')">' + esc(uname(uid)) + '</span>' + bannedBadge(uid); };
  const isSharedView = (filter === 'ips' || filter === 'shared');
  const sel = function(f) { return (filter === f || (isSharedView && (f === 'ips' || f === 'shared'))) ? '2px solid #4f46e5' : '1px solid #e5e7eb'; };
  const card = function(big, label, bg, f) {
    return '<div onclick="adminRenderActivity(\'' + f + '\')" style="flex:1;background:' + bg + ';border:' + sel(f) + ';border-radius:12px;padding:12px;text-align:center;cursor:pointer;">' +
      '<div style="font-size:22px;font-weight:800;color:#1e293b;">' + big + '</div>' +
      '<div style="font-size:11px;color:#64748b;margin-top:2px;">' + label + '</div></div>';
  };
  let h = '';
  h += '<div style="background:linear-gradient(135deg,#0f766e,#0ea5e9);color:#fff;padding:14px;border-radius:12px;margin-bottom:12px;">' +
    '<div style="font-size:18px;font-weight:800;">📊 Activity Report</div>' +
    '<div style="font-size:11px;opacity:.9;margin-top:4px;">Aakhri 24 ghante • Generated: ' + esc(new Date(d.now).toLocaleString()) + '</div>' +
    '<button onclick="adminLoadActivity()" style="margin-top:10px;padding:8px 16px;background:#fff;color:#0f766e;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">🔄 Refresh</button></div>';
  h += '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
    card(d.active.length, '🟢 Active IDs (24h)', '#ecfdf5', 'active') +
    card(d.fresh.length, '🆕 Nayi IDs (24h)', '#eff6ff', 'new') +
    card(d.multi.length, '🌐 IPs with 2+ active', '#fffbeb', 'ips') +
    card(d.sharedIds, '👥 IDs on shared IPs', '#fef2f2', 'shared') + '</div>';
  if (filter !== 'all') {
    h += '<div style="margin-bottom:12px;"><button onclick="adminRenderActivity(\'all\')" style="padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✖ Sab sections dikhao</button></div>';
  }
  if (filter === 'all' || filter === 'active') {
    h += '<div style="font-size:14px;font-weight:800;margin:14px 0 8px;">🟢 Aakhri 24 ghante me active IDs (' + d.active.length + ')</div>';
    if (!d.active.length) { h += '<p style="color:#94a3b8;font-size:12px;">Koi ID aakhri 24 ghante me active nahi.</p>'; }
    else {
      d.active.forEach(function(a) {
        h += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' + userChip(a.uid) + '</div>' +
          '<div style="font-size:11px;color:#64748b;">active ' + timeAgo(new Date(a.lastActive)) + '</div></div>';
      });
    }
  }
  if (filter === 'all' || filter === 'new') {
    h += '<div style="font-size:14px;font-weight:800;margin:14px 0 8px;">🆕 Aakhri 24 ghante me nayi IDs (' + d.fresh.length + ')</div>';
    if (!d.fresh.length) { h += '<p style="color:#94a3b8;font-size:12px;">Aakhri 24 ghante me koi nayi ID nahi bani.</p>'; }
    else {
      d.fresh.forEach(function(f) {
        h += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' + userChip(f.uid) + '</div>' +
          '<div style="font-size:11px;color:#64748b;">joined ' + timeAgo(new Date(f.joined)) + '</div></div>';
      });
    }
  }
  if (filter === 'all' || isSharedView) {
    const groups = (filter === 'all') ? d.ipGroups : d.multi;
    const head = (filter === 'all')
      ? '🌐 1 IP par active IDs (24h) — ' + d.ipGroups.length + ' IPs'
      : '🌐 IPs with 2+ active (' + d.multi.length + ') • IDs on shared IPs (' + d.sharedIds + ')';
    h += '<div style="font-size:14px;font-weight:800;margin:14px 0 8px;">' + head + '</div>';
    if (!groups.length) { h += '<p style="color:#94a3b8;font-size:12px;">Kisi IP par active ID ka record nahi.</p>'; }
    else {
      groups.forEach(function(g) {
        const isMulti = g.ids.length >= 2;
        const chips = g.ids.map(function(a) { return userChip(a.uid); }).join(', ');
        h += '<div style="background:' + (isMulti ? '#fffbeb' : '#fff') + ';border:1px solid ' + (isMulti ? '#f59e0b' : '#e5e7eb') + ';border-radius:10px;padding:10px;margin-bottom:6px;">' +
          '<div style="font-family:monospace;font-weight:700;font-size:13px;">' + esc(g.ip) + ' <span style="font-size:11px;background:' + (isMulti ? '#f59e0b' : '#e2e8f0') + ';color:' + (isMulti ? '#fff' : '#475569') + ';padding:2px 8px;border-radius:8px;">' + g.ids.length + ' IDs</span></div>' +
          '<div style="font-size:13px;margin-top:6px;line-height:1.8;">' + chips + '</div></div>';
      });
    }
  }
  if (filter === 'all' && d.noIPActive > 0) { h += '<p style="font-size:11px;color:#94a3b8;">Note: ' + d.noIPActive + ' active IDs ki IP record nahi hai (purani IDs, lastIP maujood nahi).</p>'; }
  if (filter === 'all') { h += '<p style="font-size:11px;color:#94a3b8;margin-top:12px;">Shared IP = shak, saboot nahi — ban se pehle chats/reports check karein. Ye report sirf parhti hai, koi data change nahi karti. Active = app khula hua (2-minute heartbeat); Nayi = joined timestamp.</p>'; }
  box.innerHTML = h;
}

async function adminLoadPosts() {
  const box = document.getElementById('adminContent');
  if (!box || !requirePerm('posts')) return;
  box.innerHTML = '<p style="text-align:center;color:#94a3b8;">Loading posts…</p>';
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const snap = await db.ref('posts').orderByChild('timestamp').limitToLast(50).once('value');
    const posts = [];
    snap.forEach(function(c) { const p = c.val() || {}; p.id = c.key; posts.push(p); });
    posts.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    if (!posts.length) { box.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:30px;">No posts.</p>'; return; }
    let h = '';
    posts.forEach(function(p) {
      const preview = p.image_url ? '🖼️ [image post]' : esc(String(p.text || '').substring(0, 90));
      h += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:8px;">' +
        '<div style="font-size:13px;">' + preview + '</div>' +
        '<div style="font-size:11px;color:#64748b;margin:4px 0;">By ' + esc(p.username || p.user_id || 'unknown') +
        ' • ' + (p.timestamp ? timeAgo(new Date(p.timestamp)) : '') + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:8px;">' +
        '<button onclick="adminViewPost(\'' + p.id + '\')" style="flex:1;padding:8px;background:#eef2ff;color:#4f46e5;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">View</button>' +
        '<button onclick="adminDeletePost(\'' + p.id + '\',null)" style="flex:1;padding:8px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Delete</button>' +
        '</div></div>';
    });
    box.innerHTML = h;
  } catch (e) {
    box.innerHTML = '<p style="color:red;text-align:center;">Error loading posts</p>';
  }
}

function adminShowUsers() {
  if (!requireSiteAdmin()) return;
  const box = document.getElementById('adminContent');
  if (!box) return;
  box.innerHTML =
    '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
    '<input id="adminUserSearch" placeholder="username…" style="flex:1;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;" />' +
    '<button onclick="adminFindUser()" style="padding:10px 16px;background:#4f46e5;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;">Find</button>' +
    '</div><div id="adminUserResult"></div>' +
    (isSuperAdmin() ? '<div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;">' +
    '<div style="font-size:12px;font-weight:700;margin-bottom:6px;">🔍 IP Check — ek IP par kitni IDs</div>' +
    '<div style="display:flex;gap:6px;">' +
    '<input id="adminIPSearch" placeholder="IP, jaise 1.2.3.4" style="flex:1;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;" />' +
    '<button onclick="adminCheckIP()" style="padding:10px 16px;background:#0f766e;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;">Check</button>' +
    '</div><div id="adminIPResult" style="margin-top:8px;"></div></div>' : '') +
    (hasPerm('admins') ? '<button onclick="adminRecalcLikes()" style="width:100%;margin-top:14px;padding:10px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">🔄 Recalculate all users\u2019 total likes</button>' : '');
}

async function adminFindUser() {
  if (!requireSiteAdmin()) return;
  const box = document.getElementById('adminUserResult');
  const nameEl = document.getElementById('adminUserSearch');
  const name = (nameEl && nameEl.value.trim()) || '';
  if (!box) return;
  if (!name) { box.innerHTML = '<p style="color:#94a3b8;">Type a username.</p>'; return; }
  box.innerHTML = '<p style="color:#94a3b8;">Searching…</p>';
  try {
    const { db } = getFirebase();
    if (!db) return;
    const mapSnap = await db.ref('usernames/' + name).once('value');
    const uid = mapSnap.val();
    if (!uid || typeof uid !== 'string') { box.innerHTML = '<p style="color:#94a3b8;">User not found.</p>'; return; }
    const uSnap = await db.ref('users/' + uid).once('value');
    const u = uSnap.val() || {};
    const isSuper = isSuperAdminUid(uid);
    let targetPerms = null;
    if (!isSuper) {
      try { const pSnap = await db.ref('admins/' + uid).once('value'); targetPerms = pSnap.val() || null; } catch (e) {}
    }
    const isDbAdmin = !!targetPerms;
    const isBanned = !!u.banned;
    const canBan = hasPerm('ban');
    const canManageAdmins = hasPerm('admins') && !isSuper;
    const badge = isSuper
      ? ' <span style="font-size:10px;background:#4f46e5;color:#fff;padding:2px 8px;border-radius:8px;">SUPER ADMIN</span>'
      : (isDbAdmin ? ' <span style="font-size:10px;background:#ede9fe;color:#6d28d9;padding:2px 8px;border-radius:8px;">ADMIN</span>' : '');
    let permEditor = '';
    if (canManageAdmins) {
      const cur = (targetPerms === true) ? { posts: true, reports: true, ban: true } : (targetPerms || {});
      permEditor = '<div style="margin-top:10px;border-top:1px solid #e5e7eb;padding-top:10px;">' +
        '<div style="font-size:12px;font-weight:700;margin-bottom:6px;">Admin permissions</div>';
      Object.keys(ADMIN_PERM_LABELS).forEach(function(p) {
        permEditor += '<label style="display:flex;align-items:center;gap:8px;font-size:13px;padding:5px 0;cursor:pointer;">' +
          '<input type="checkbox" id="perm_' + p + '" ' + (cur[p] ? 'checked' : '') + ' style="width:16px;height:16px;" /> ' + ADMIN_PERM_LABELS[p] + '</label>';
      });
      permEditor += '<div style="display:flex;gap:6px;margin-top:8px;">' +
        '<button onclick="adminSavePerms(\'' + uid + '\')" style="flex:1;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Save permissions</button>' +
        (isDbAdmin ? '<button onclick="adminRemoveAdmin(\'' + uid + '\')" style="flex:1;padding:10px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Remove admin</button>' : '') +
        '</div></div>';
    }
    box.innerHTML =
      '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">' +
      '<div style="font-size:15px;font-weight:800;">' + esc(u.username || name) + badge + (isBanned ? ' <span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:8px;">BANNED</span>' : '') + '</div>' +
      '<div style="font-size:11px;color:#64748b;margin:6px 0;font-family:monospace;word-break:break-all;">UID: ' + esc(uid) + '</div>' +
      (isSuperAdmin() ? '<div style="font-size:11px;color:#64748b;">Last IP: ' + esc(u.lastIP || '—') + (u.lastIP ? ' <button onclick="adminCheckIP(\'' + escAttrJS(u.lastIP) + '\')" style="padding:2px 10px;background:#ccfbf1;color:#0f766e;border:1px solid #99f6e4;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">🔍 Is IP ki IDs</button>' : '') + '</div>' : '') +
      '<div style="font-size:11px;color:#64748b;">' + esc(u.email || '') + (u.joined ? ' • joined ' + timeAgo(new Date(u.joined)) : '') + '</div>' +
      (canBan
        ? '<div style="display:flex;gap:6px;margin-top:10px;">' +
          (isBanned
            ? '<button onclick="adminBanUser(\'' + uid + '\',false)" style="flex:1;padding:10px;background:#dcfce7;color:#166534;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Unban user</button>'
            : '<button onclick="adminBanUser(\'' + uid + '\',true)" style="flex:1;padding:10px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Ban user</button>') +
          (isSuperAdmin() ? '<button onclick="adminBanIP(\'' + uid + '\')" style="flex:1;padding:10px;background:#fef3c7;color:#92400e;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px;">🚫 Ban IP</button>' : '') +
          '</div>'
        : '') +
      permEditor +
      (isSuper ? '<div style="font-size:11px;color:#64748b;margin-top:10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:8px;">Super admins are managed in the <b>SITE_ADMINS</b> list in the theme file.</div>' : '') +
      '</div>';
  } catch (e) {
    box.innerHTML = '<p style="color:red;">Error finding user.</p>';
  }
}

/* (v124) IP Check: ek IP par chal rahi saari IDs dikhao (ipHistory + lastIP fallback; koi write nahi) */
async function adminCheckIP(ipArg) {
  if (!requireSiteAdmin()) return;
  if (!isSuperAdmin()) { alert('⛔ Super admins only.'); return; }
  const box = document.getElementById('adminIPResult');
  const input = document.getElementById('adminIPSearch');
  const ip = (ipArg || (input && input.value.trim()) || '');
  if (!ip) { if (box) box.innerHTML = '<p style="color:#94a3b8;">IP likhein (jaise 1.2.3.4).</p>'; return; }
  if (input) input.value = ip;
  if (box) box.innerHTML = '<p style="color:#94a3b8;">Checking…</p>';
  try {
    const { db } = getFirebase();
    if (!db) return;
    const key = ip.replace(/\./g, '_');
    const snap = await db.ref('users').once('value');
    const rows = [];
    snap.forEach(function(doc) {
      const u = doc.val() || {};
      const uid = doc.key;
      let ent = null, legacy = false;
      if (u.ipHistory && u.ipHistory[key]) ent = u.ipHistory[key];
      else if (u.lastIP && u.lastIP.replace(/\./g, '_') === key) legacy = true;
      if (ent || legacy) rows.push({ uid: uid, u: u, ent: ent, legacy: legacy });
    });
    if (rows.length === 0) { let _b0 = false; try { _b0 = !!(await db.ref('bannedIPs/' + key).once('value')).val(); } catch(e) {} if (box) box.innerHTML = _b0 ? '<p>🔍 ' + esc(ip) + ' par koi ID nahi mili, lekin ye IP <b>BANNED</b> hai.</p><button onclick="adminUnbanIP(\'' + escAttrJS(ip) + '\')" style="padding:6px 12px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Unban IP</button>' : '<p style="color:#94a3b8;">Is IP par koi ID nahi mili.</p>'; return; }
    let _ipBanned = false;
    try { _ipBanned = !!(await db.ref('bannedIPs/' + key).once('value')).val(); } catch(e) {}
    let h = '<div style="font-weight:700;font-size:13px;margin-bottom:8px;">🔍 ' + esc(ip) + ' par ' + rows.length + ' ID' + (rows.length > 1 ? 's' : '') + (_ipBanned ? ' <span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:8px;">BANNED IP</span> <button onclick="adminUnbanIP(\'' + escAttrJS(ip) + '\')" style="padding:2px 10px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">Unban IP</button>' : '') + '</div>';
    rows.forEach(function(r) {
      const e = r.ent;
      const fs = (e && e.firstSeen) ? timeAgo(new Date(e.firstSeen)) : '—';
      const ls = (e && e.lastSeen) ? timeAgo(new Date(e.lastSeen)) : (r.legacy ? 'sirf lastIP' : '—');
      const ct = (e && e.count) ? e.count : (r.legacy ? '—' : 1);
      h += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:8px;">' +
        '<div style="font-weight:700;font-size:13px;">' + esc(r.u.username || 'User') + (r.u.banned ? ' <span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:8px;">BANNED</span>' : '') + '</div>' +
        '<div style="font-size:11px;color:#64748b;">pehli: ' + fs + ' • aakhri: ' + ls + ' • logins: ' + ct + '</div>' +
        '<button onclick="document.getElementById(\'adminUserSearch\').value=\'' + escAttrJS(r.u.username || '') + '\';adminFindUser()" style="margin-top:6px;padding:6px 12px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">View user</button></div>';
    });
    box.innerHTML = h;
  } catch(e) { if (box) box.innerHTML = '<p style="color:red;">Error: ' + esc(e.message) + '</p>'; }
}

async function adminBanUser(uid, ban) {
  /* (v68) FIX: Super admins bypass permission check - fixes dead ban button */
  if (!isSuperAdmin() && !requirePerm('ban')) return;
  if (ban) {
    if (uid === currentUserId) {
      if (!confirm('Ban YOURSELF? You will be logged out immediately and lose access.')) return;
    } else if (!confirm('Ban this user? They will be logged out and unable to log in again.')) return;
  } else {
    if (!confirm('Unban this user?')) return;
  }
  try {
    const { db } = getFirebase();
    if (!db) return;
    if (ban) {
      var _bu = {};
      _bu['users/' + uid + '/banned'] = firebase.database.ServerValue.TIMESTAMP;
      _bu['users/' + uid + '/redStar'] = null; /* (v46) banned user loses star immediately */
      _bu['users/' + uid + '/bannedBy'] = currentUserId;
      await db.ref().update(_bu);
      /* (v125) NO auto IP ban: user ban kabhi IP ban nahi karega — IP ban sirf super admin ke manual Ban IP se hoga. */
      
    }
    else await db.ref('users/' + uid + '/banned').remove();
    alert(ban ? '🚫 User banned.' : '✅ User unbanned.');
    adminFindUser();
  } catch (e) { alert('Error: ' + e.message); }
}

/* (v47) Ban a user's IP address */
async function adminBanIP(uid) {
  /* (v125) IP ban/unban sirf super admin */
  if (!isSuperAdmin()) { alert('⛔ Super admins only.'); return; }
  if (!confirm('Ban this user\'s IP address? They will be unable to log in from this IP.')) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    const ipSnap = await db.ref('users/' + uid + '/lastIP').once('value');
    const ip = ipSnap.val();
    if (!ip) { alert('No IP recorded for this user yet.'); return; }
    const ipKey = ip.replace(/\./g, '_');
    await db.ref('bannedIPs/' + ipKey).set({ ip: ip, uid: uid, bannedAt: firebase.database.ServerValue.TIMESTAMP, by: currentUserId });
    alert('🚫 IP ' + ip + ' banned.');
  } catch (e) { alert('Error: ' + e.message); }
}

/* (v125) IP unban — sirf super admin */
async function adminUnbanIP(ip) {
  if (!isSuperAdmin()) { alert('⛔ Super admins only.'); return; }
  if (!ip) return;
  if (!confirm('Unban IP ' + ip + '? Is IP se login phir se ho sakega.')) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    await db.ref('bannedIPs/' + ip.replace(/\./g, '_')).remove();
    alert('✅ IP ' + ip + ' unbanned.');
    adminCheckIP(ip);
  } catch (e) { alert('Error: ' + e.message); }
}

/* Save delegated-admin permissions for a user (writes admins/<uid>). */
async function adminSavePerms(uid) {
  if (!requirePerm('admins')) return;
  if (isSuperAdminUid(uid)) { alert('Super admins are managed in the theme file.'); return; }
  if (uid === currentUserId && !isSuperAdmin()) {
    if (!confirm('Change YOUR OWN permissions? You could lock yourself out.')) return;
  }
  const perms = {};
  Object.keys(ADMIN_PERM_LABELS).forEach(function(p) {
    const cb = document.getElementById('perm_' + p);
    if (cb && cb.checked) perms[p] = true;
  });
  try {
    const { db } = getFirebase();
    if (!db) return;
    if (Object.keys(perms).length) {
      await db.ref('admins/' + uid).set(perms);
      alert('✅ Permissions saved.');
    } else {
      if (!confirm('No permissions selected — remove admin access entirely?')) return;
      await db.ref('admins/' + uid).remove();
      alert('Admin access removed.');
    }
    if (uid === currentUserId) { try { checkSiteAdmin(); } catch (e) {} }
    adminFindUser();
  } catch (e) { alert('Error: ' + e.message); }
}

async function adminRemoveAdmin(uid) {
  if (!requirePerm('admins')) return;
  if (isSuperAdminUid(uid)) { alert('Super admins are managed in the theme file.'); return; }
  if (!confirm('Remove admin access from this user?')) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    await db.ref('admins/' + uid).remove();
    alert('Admin access removed.');
    adminFindUser();
  } catch (e) { alert('Error: ' + e.message); }
}

/* One-time repair: recompute users/<uid>/likes from actual post likeCounts.
   (2026-10-10) RULE: Total likes KABHI kam nahi hote — ye tool sirf counter BARHA sakta hai,
   ghata nahi (deleted posts ke likes lifetime total me rehte hain). */
async function adminRecalcLikes() {
  if (!requirePerm('admins')) return;
  if (!confirm('Recalculate total likes for ALL users? This scans all posts once.')) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    const snap = await db.ref('posts').once('value');
    const totals = {};
    snap.forEach(p => {
      const v = p.val() || {};
      if (!v.user_id) return;
      // Ground truth: count actual likes object keys (likeCount counter can be out-of-sync)
      let c = 0;
      if (v.likes && typeof v.likes === 'object') c = Object.keys(v.likes).length;
      else c = v.likeCount || v.like_count || 0;
      totals[v.user_id] = (totals[v.user_id] || 0) + c;
    });
    const uids = Object.keys(totals);
    for (let i = 0; i < uids.length; i += 200) {
      const chunk = uids.slice(i, i + 200);
      const batch = {};
      for (let k = 0; k < chunk.length; k++) {
        const u = chunk[k];
        let cur = 0;
        try { const cs = await db.ref('users/' + u + '/likes').once('value'); cur = cs.val() || 0; } catch(e) {}
        batch['users/' + u + '/likes'] = Math.max(cur, totals[u] || 0); /* kabhi minus nahi */
      }
      await db.ref().update(batch);
    }
    alert('✅ Recalculated total likes for ' + uids.length + ' users.');
  } catch (e) { alert('Error: ' + e.message); }
}

async function adminDeleteMehfil(mid, mname) {
  if (!window._isSiteAdmin) { alert('Admin only!'); return; }
  if (!confirm('Mehfil "' + mname + '" delete karni hai?\nYe wapas nahi hogi!')) return;
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('DB not ready');
    await db.ref('mehfils/' + mid).remove();
    try { await db.ref('mehfil_posts/' + mid).remove(); } catch(e) {}
    alert('Mehfil delete ho gayi!');
    if (typeof loadExploreMehfilsUI === 'function') loadExploreMehfilsUI();
    else if (typeof loadMehfilContent === 'function') loadMehfilContent('explore');
  } catch(e) { alert('Error: ' + e.message); }
}

/* ===== RED STAR SYSTEM v4 =====
   - Top 10 by weekly likes ALL get auto red star
   - Drop to #11 = star removed (dynamic)
   - Friday-to-Friday weeks (resets every Friday)
   - Admin: permanent stars + remove
   - 2-min memory cache for speed
*/
var _starCache = { weekId: null, time: 0, data: null };

function getWeekStart(d) {
  d = d || new Date();
  // Friday-based weeks: week starts Friday 00:00 (local time)
  var day = d.getDay(); // 0=Sun..5=Fri..6=Sat
  var diff = (day + 2) % 7; // days since Friday
  var fri = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  fri.setHours(0, 0, 0, 0);
  return fri.getTime();
}

function getWeekId(d) {
  var fri = new Date(getWeekStart(d));
  return 'FRI-' + fri.getFullYear() + '-' + (fri.getMonth() + 1) + '-' + fri.getDate();
}

function hasRedStar(userData) {
  if (!userData || !userData.redStar) return false;
  var rs = userData.redStar;
  if (rs.type === 'permanent') return true;
  if (rs.type === 'weekly') return rs.weekId === getWeekId();
  return false;
}

/* (v37) Top-3 rank: username medal-color + superscript Top1/Top2/Top3 (x^2 style) */
/* (v59) FIX: Rank badge ONLY from live top10 — stale redStar se kabhi rank mat dikhao */
function ddpRankMedalHTML(uid, userData) {
  let rank = 0;
  try {
    if (uid && typeof _starCache !== 'undefined' && _starCache && _starCache.data && _starCache.data.top10) {
      const i = _starCache.data.top10.indexOf(uid);
      if (i >= 0) rank = i + 1;
    }
    /* (v59) REMOVED stale redStar fallback — sirf live top10 se rank */
  } catch(e) {}
  if (rank === 1) return '<sup class="ddp-rank1" title="Top 1">Top1</sup>';
  if (rank === 2) return '<sup class="ddp-rank2" title="Top 2">Top2</sup>';
  if (rank === 3) return '<sup class="ddp-rank3" title="Top 3">Top3</sup>';
  /* (v104) Top 4-10 ko bhi badge - sab ko ek hi color (ddp-rankx, slate) */
  if (rank >= 4 && rank <= 10) return '<sup class="ddp-rankx" title="Top ' + rank + '">Top' + rank + '</sup>';
  return '';
}
/* (v138) Blue tick verified badge — sirf VERIFIED_UIDS (filhal sirf damadam) ke naam ke aage */
const VERIFIED_UIDS = ['o1v6E1Fx1BeOEn8QN8dT1GpPU2S2'];
function verifiedTickHTML(uid) {
  if (!uid || VERIFIED_UIDS.indexOf(uid) === -1) return '';
  return ' <span style="display:inline-block;background:#1d9bf0;color:#fff;border-radius:50%;width:14px;height:14px;font-size:9px;line-height:14px;text-align:center;vertical-align:middle;margin-left:2px;" title="Verified">✓</span>';
}
function redStarHTML(userData, uid) {
  let h = '';
  if (uid) h += ddpRankMedalHTML(uid, userData);
  var _tc2 = false;
  try { _tc2 = (typeof _starCache !== 'undefined' && _starCache && _starCache.data && _starCache.data.top10); } catch(e) {}
  var _showStar = false;
  if (_tc2) {
    /* (v45) top10 available: weekly star only if in top10; permanent always */
    if (uid && isStarUid(uid)) _showStar = true;
    else if (userData && userData.redStar && userData.redStar.type === 'permanent') _showStar = true;
  } else {
    if (hasRedStar(userData)) _showStar = true;
    else if (uid && isStarUid(uid)) _showStar = true;
  }
  if (_showStar) h += ' <span class="ddp-redstar" style="color:#e11d48;font-size:14px;" title="Red Star">★</span>';
  return h + verifiedTickHTML(uid);
}
function isStarUid(uid) {
  if (!uid) return false;
  try {
    if (typeof _starCache !== 'undefined' && _starCache && _starCache.data && _starCache.data.top10) {
      return _starCache.data.top10.indexOf(uid) !== -1;
    }
  } catch(e) {}
  return false;
}
function redStarHTMLByUid(uid) {
  if (isStarUid(uid)) return (uid ? ' ' + ddpRankMedalHTML(uid, null) : '') + ' <span class="ddp-redstar" style="color:#e11d48;font-size:13px;" title="Red Star">★</span>' + verifiedTickHTML(uid);
  return verifiedTickHTML(uid);
}
/* Friday ranking: background refresh so stars show from day 1 (even with 1 like) */
function ddpRefreshStarsBg() {
  try {
    if (typeof calculateWeeklyStarsLive === 'function') {
      calculateWeeklyStarsLive().then(function() {
        if (typeof ddpPaintStars === 'function') ddpPaintStars();
      }).catch(function() {
        setTimeout(function() {
          try {
            calculateWeeklyStarsLive().then(function() {
              if (typeof ddpPaintStars === 'function') ddpPaintStars();
            }).catch(function() {});
          } catch(e2) {}
        }, 8000);
      });
    }
  } catch(e) {}
}
function ddpPaintStars() {
  try {
    const els = document.querySelectorAll('[data-uid]');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const uid = el.getAttribute('data-uid');
      if (uid && isStarUid(uid) && !el.querySelector('.ddp-redstar')) {
        const _medal = (typeof ddpRankMedalHTML === 'function') ? ddpRankMedalHTML(uid, null) : '';
        el.insertAdjacentHTML('beforeend', (_medal ? ' ' + _medal : '') + ' <span class="ddp-redstar" style="color:#e11d48;font-size:13px;" title="Red Star">★</span>');
      }
    }
  } catch(e) {}
}

async function calculateWeeklyStarsLive(force) {
  const weekId = getWeekId();
  // Speed: 15-min cache (v150: 5-min se barhaya)
  if (!force && _starCache.weekId === weekId && (Date.now() - _starCache.time) < 900000 && _starCache.data) {
    return _starCache.data;
  }
  /* (v150) Weekly cache localStorage me bhi - reload par dobara hisab nahi. */
  if (!force) {
    try {
      const _wls = JSON.parse(localStorage.getItem('ddpWeeklyStars') || 'null');
      if (_wls && _wls.weekId === weekId && (Date.now() - _wls.time) < 900000 && _wls.data) { _starCache = { weekId: weekId, time: _wls.time, data: _wls.data }; return _wls.data; }
    } catch(e) {}
  }
  const { db } = getFirebase();
  if (!db) throw new Error('DB not ready');
  // True Friday reset: count only likes/posts from Friday 00:00 (start of this week)
  const weekStart = getWeekStart();

  /* (v71) WEEKLY STARS FIX: persistent board se parho — post SCAN KHATAM.
     Pehle: 200 recent posts scan hote thay → naye posts aane par purane bahar,
     delete/expire par likes ghayab → "daily refresh" wali complaint.
     Ab: har like par board increment hota hai (like handler me, 3-cap ke saath).
     Post delete/expire/window-slide se board kabhi kam nahi hota. */
  let userLikes = {};
  const userNames = {};
  try {
    const _bSnap71 = await db.ref('stars/weekly/' + weekId + '/board').once('value');
    userLikes = _bSnap71.val() || {};
  } catch(_e71) { userLikes = {}; }

  const sorted = Object.keys(userLikes).sort(function(a, b) { return (userLikes[b] || 0) - (userLikes[a] || 0); });
  const newTop10 = sorted.slice(0, 10);
  /* (v71) Board me sirf UID→count hai — top-10 ke display names lao */
  /* (v150) Naam aik sath lao (parallel) - pehle aik ke baad aik 10 reads hoti theen. */
  await Promise.all(newTop10.map(async function(_uid71) {
    try {
      const _un71 = await db.ref('users/' + _uid71 + '/username').once('value');
      if (_un71.val()) userNames[_uid71] = _un71.val();
    } catch(_e71) {}
  }));

  // Dynamic top-10 stars: diff old vs new, update only changes
  try {
    const prevSnap = await db.ref('stars/weekly/' + weekId + '/top10uids').once('value');
    const prevTop10 = prevSnap.val() || [];
    /* (v36) Flap-guard: agar is hafte ka count khaali/mashkook aaya (network ya query masla)
       aur pehle se stars lage thay, to kisi ka star mat hatao — yehi "daily reset" wala flap tha. */
    let _totalCounted = 0;
    try { const _cks = Object.keys(userLikes); for (let _cki = 0; _cki < _cks.length; _cki++) _totalCounted += (userLikes[_cks[_cki]] || 0); } catch(_fge) {}
    if (newTop10.length === 0 && _totalCounted === 0 && prevTop10.length > 0) {
      const _fgData = { top10: prevTop10, board: {}, names: {}, weekId: weekId, _flapGuard: true };
      _starCache = { weekId: weekId, time: Date.now(), data: _fgData };
      try { localStorage.setItem('ddpWeeklyStars', JSON.stringify({ weekId: weekId, time: Date.now(), data: _fgData })); } catch(e) {}
      return _fgData;
    }
    const updates = {};
    // Remove stars from those who dropped out
    /* (v150) redStar reads aik sath (parallel) - pehle aik ke baad aik hoti theen. */
    const _dropped = prevTop10.filter(function(_du) { return newTop10.indexOf(_du) === -1; });
    const _rsSnaps = await Promise.all(_dropped.map(function(_du) { return db.ref('users/' + _du + '/redStar').once('value').catch(function() { return null; }); }));
    _rsSnaps.forEach(function(rsSnap, _di) {
      if (!rsSnap) return;
      const rs = rsSnap.val();
      if (rs && rs.type === 'weekly' && rs.weekId === weekId) {
        updates['users/' + _dropped[_di] + '/redStar'] = null;
      }
    });
    // Add stars to new top-10
    /* (v150) banned + redStar reads aik sath (parallel). */
    const _top10Checks = await Promise.all(newTop10.map(async function(uid) {
      let banned = false, rs2 = null;
      try { const _banChk = await db.ref('users/' + uid + '/banned').once('value'); if (_banChk && _banChk.val()) banned = true; } catch(e) {}
      try { const rsSnap2 = await db.ref('users/' + uid + '/redStar').once('value'); rs2 = rsSnap2.val(); } catch(e) {}
      return { uid: uid, banned: banned, rs2: rs2 };
    }));
    _top10Checks.forEach(function(_chk, j) {
      const uid = _chk.uid;
      /* (v46) Skip banned users - they cannot earn stars */
      if (_chk.banned) return;
      const rs2 = _chk.rs2;
      if (!rs2 || rs2.type !== 'weekly' || rs2.weekId !== weekId) {
        // Don't overwrite permanent stars!
        if (!rs2 || rs2.type !== 'permanent') {
          updates['users/' + uid + '/redStar'] = { type: 'weekly', weekId: weekId, likes: userLikes[uid], rank: j + 1, grantedAt: Date.now() };
        }
      }
    });
    updates['stars/weekly/' + weekId + '/top10uids'] = newTop10;

    updates['stars/weekly/' + weekId + '/names'] = userNames;
    updates['stars/weekly/' + weekId + '/updatedAt'] = Date.now();
    const keys = Object.keys(updates);
    if (keys.length > 0) await db.ref().update(updates);
  } catch(e) { console.warn('Top10 star sync failed:', e.message); }

  const result = { top10: newTop10, board: userLikes, names: userNames, weekId: weekId };
  _starCache = { weekId: weekId, time: Date.now(), data: result };
  try { localStorage.setItem('ddpWeeklyStars', JSON.stringify({ weekId: weekId, time: Date.now(), data: result })); } catch(e) {}
  return result;
}

/* (v113) STARS page ke andar doosra tab: Trending users.
   Top 10 = sab se zyada trending posts wale users (v112 rule: 7 din + 5 likes).
   Cards search-result wali style me (ddpUserCardHTML reuse). */
var ddpStarsTab = 'weekly';
var _starsTrendingCache = { time: 0, html: '' }; /* (v150) STARS trending 15-min cache */

async function ddpRenderStarsTrendingList() {
  const box = document.getElementById('ddpStarsTrendingList');
  if (!box) return;
  /* (v150) 15-min cache: dobara kholne par scan nahi */
  if (_starsTrendingCache.html && Date.now() - _starsTrendingCache.time < 900000) { box.innerHTML = _starsTrendingCache.html; return; }
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    /* (v115) Ranking ke liye gehra scan: akhri 300 posts sirf ~4 ghante cover
       karte hain, is liye list chhoti thi aur har waqt badal jati thi (kuch der
       pehle 2 users, ab sirf 1). Batch-wise 200 trending posts tak jama karo. */
    /* (v139) Ranking ab shared function se — badge aur tab hamesha ek number */
    let uids = (await ddpGetTrendingUserRanks()).slice(0, 10);
    if (uids.length === 0) {
      box.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Abhi koi trending post nahi</p>';
      _starsTrendingCache = { time: Date.now(), html: box.innerHTML };
      return;
    }
    let h = '';
    /* (v145) Audit fix: 10 cards parallel (pehle sequential the); ek kharab card baaki ko nahi rokega */
    const _tc = window._ddpTrendCounts || {};
    const _cards = await Promise.all(uids.map(function(uid, i) { return ddpUserCardHTML(uid, 'user', i + 1, (typeof _tc[uid] === 'number' ? _tc[uid] : undefined)).catch(function() { return ''; }); }));
    h += _cards.join('');
    box.innerHTML = h;
    _starsTrendingCache = { time: Date.now(), html: h };
  } catch(e) {
    box.innerHTML = '<p style="color:red;text-align:center;padding:20px;">Load nahi ho saka</p>';
  }
}

async function loadStarsTab() {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;margin-top:40px;">⭐ Loading...</p>';
  try {
    /* (v122) STARS Trending ko weekly kaam ki zaroorat nahi — admin/weekly/user-fetch sirf weekly tab par */
    const _isTrendTab = (ddpStarsTab === 'trending');
    let result = null, errMsg = '';
    let isAdmin = false;
    let board = {}, names = {}, top10 = [], userData = {};
    const { db } = getFirebase();
    if (!_isTrendTab) {
      try { await checkSiteAdmin(); } catch(e) {}
      isAdmin = !!window._isSiteAdmin;
      try { result = await calculateWeeklyStarsLive(); }
      catch(e) { errMsg = e.message; console.error(e); }
      board = (result && result.board) || {};
      names = (result && result.names) || {};
      top10 = (result && result.top10) || [];
      /* (v122) user details aik sath (parallel), aik ke baad aik nahi */
      const _uArr = await Promise.all(top10.map(async function(uid) {
        try { const us = await db.ref('users/' + uid).once('value'); return us.exists() ? (us.val() || {}) : {}; }
        catch(e) { return {}; }
      }));
      top10.forEach(function(uid, idx) { userData[uid] = _uArr[idx]; });
    }

    let html = '<div style="background:#fff;min-height:100vh;padding-bottom:80px;">';
    html += '<div style="text-align:center;padding:20px 16px;background:linear-gradient(135deg,#fef3c7,#fde68a);">';
    html += '<div style="font-size:40px;">⭐</div>';
    html += '<div style="font-size:18px;font-weight:800;">' + (ddpStarsTab === 'trending' ? '🔥 Trending Users' : 'Weekly Red Stars') + '</div>';
    html += '<div style="font-size:12px;color:#92400e;margin-top:4px;">' + (ddpStarsTab === 'trending' ? 'Top 10 = sab se zyada trending posts (7 din + 5 likes)' : 'Top 10 = Red Star ⭐<br/>Har Friday reset • Live ranking') + '</div>';
    html += '</div>';
    /* (v113) STARS sub-tabs: Weekly | Trending */
    html += '<div style="display:flex;gap:8px;padding:12px 16px 0 16px;">';
    html += '<button onclick="ddpStarsTab=\'weekly\';loadStarsTab()" style="flex:1;padding:10px;border-radius:20px;border:1.5px solid #f59e0b;cursor:pointer;font-weight:700;background:' + (ddpStarsTab === 'trending' ? '#fff' : '#fef3c7') + ';">⭐ Weekly</button>';
    html += '<button onclick="ddpStarsTab=\'trending\';loadStarsTab()" style="flex:1;padding:10px;border-radius:20px;border:1.5px solid #f59e0b;cursor:pointer;font-weight:700;background:' + (ddpStarsTab === 'trending' ? '#fef3c7' : '#fff') + ';">🔥 Trending</button>';
    html += '</div>';
    if (ddpStarsTab === 'trending') {
      html += '<div style="padding:0 16px;"><div style="font-weight:700;font-size:15px;margin:12px 0;">🔥 Top 10 trending users:</div><div id="ddpStarsTrendingList"><p style="text-align:center;color:#999;padding:20px;">Loading...</p></div></div>';
      html += '</div>';
      container.innerHTML = html;
      ddpRenderStarsTrendingList();
      return;
    }
    if (errMsg) html += '<div style="margin:16px;padding:12px;background:#fef2f2;border-radius:8px;text-align:center;color:#991b1b;font-size:13px;">⚠️ ' + esc(errMsg) + '</div>';

    html += '<div style="padding:0 16px;"><div style="font-weight:700;font-size:15px;margin:12px 0;">🏅 Top 10 this week:</div>';
    if (top10.length === 0) {
      html += '<p style="text-align:center;color:#999;padding:20px;">Abhi koi likes nahi<br/><span style="font-size:12px;">Posts par likes aao → top 10 me ⭐ milega</span></p>';
    } else {
      const medals = ['🥇', '🥈', '🥉'];
      for (let i = 0; i < top10.length; i++) {
        const uid = top10[i];
        const ud = userData[uid] || {};
        const uname = ud.username || names[uid] || 'user';
        const likes = board[uid] || 0;
        const medal = medals[i] || ('<span style="font-weight:800;color:#999;">' + (i + 1) + '</span>');
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#f8fafc;border-radius:8px;margin-bottom:8px;border:1.5px solid #fde68a;">';
        html += '<div style="font-size:20px;width:30px;text-align:center;">' + medal + '</div>';
        html += '<div style="flex:1;font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(uname) + ' <span style="color:#e11d48;">★</span></div>';
        html += '<div style="font-size:13px;color:#666;white-space:nowrap;">❤️ ' + likes + '</div>';
        if (isAdmin) {
          html += '<button onclick="adminGrantRedStar(\'' + uid + '\',\'' + esc(uname).replace(/\'/g, "\\'") + '\')" style="font-size:11px;padding:5px 8px;background:#fef3c7;border:1.5px solid #f59e0b;border-radius:6px;cursor:pointer;font-weight:700;">⭐ Give</button>';
        }
        html += '</div>';
      }
    }
    html += '</div>';
    if (isAdmin) {
      html += '<div style="margin:16px;padding:12px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#166534;text-align:center;">👑 <b>Admin:</b> <b>⭐ Give</b> = permanent star (kabhi expire nahi)<br/>Kisi ki <b>profile</b> khol kar bhi de sakte ho — wahan bhi button hai</div>';
    }
    html += '<div style="text-align:center;padding:16px;"><button onclick="_starCache.time=0;loadStarsTab()" style="padding:10px 30px;background:#f1f5f9;border:1.5px solid #e5e7eb;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;">🔄 Refresh</button></div>';
    html += '</div>';
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;"><p style="color:red;">⭐ Load nahi ho saka</p><p style="color:#999;font-size:12px;">' + esc(e.message) + '</p><button onclick="loadStarsTab()" style="margin-top:12px;padding:10px 24px;border-radius:20px;border:1.5px solid #e5e7eb;background:#fff;cursor:pointer;">Dobara try karein</button></div>';
  }
}

async function adminGrantRedStar(uid, uname) {
  if (!window._isSiteAdmin) { alert('Sirf admin de sakta hai!'); return; }
  const name = uname || uid;
  if (!confirm('"' + name + '" ko PERMANENT ⭐ red star dena hai?\nYe kabhi expire nahi hogi.')) return;
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('DB not ready');
    await db.ref('users/' + uid + '/redStar').set({ type: 'permanent', grantedAt: Date.now(), grantedBy: currentUserId });
    try { if (typeof UserCache !== 'undefined' && UserCache.cache) UserCache.cache.delete(uid); } catch(e) {}
    _starCache.time = 0;
    alert('⭐ "' + name + '" ko permanent red star mil gayi!');
    loadStarsTab();
  } catch(e) { alert('Error: ' + e.message); }
}

async function adminRemoveRedStar(uid) {
  if (!window._isSiteAdmin) { alert('Sirf admin remove kar sakta hai!'); return; }
  if (!confirm('Is user ka red star remove karna hai?')) return;
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('DB not ready');
    await db.ref('users/' + uid + '/redStar').remove();
    try { if (typeof UserCache !== 'undefined' && UserCache.cache) UserCache.cache.delete(uid); } catch(e) {}
    _starCache.time = 0;
    alert('Red star remove ho gaya!');
    loadStarsTab();
  } catch(e) { alert('Error: ' + e.message); }
}

function adminStarButtonsProfile(uid, userData) {
  if (!window._isSiteAdmin) return '';
  const has = hasRedStar(userData);
  let h = '<div style="display:flex;gap:8px;margin-top:10px;">';
  h += '<button onclick="adminGrantRedStar(\'' + uid + '\')" style="flex:1;padding:10px;background:#fef3c7;border:1.5px solid #f59e0b;border-radius:8px;font-weight:700;cursor:pointer;">⭐ Give Permanent Star</button>';
  if (has) h += '<button onclick="adminRemoveRedStar(\'' + uid + '\');setTimeout(function(){loadProfile(\'' + uid + '\');},800);" style="padding:10px 14px;background:#fef2f2;border:1.5px solid #fca5a5;border-radius:8px;cursor:pointer;">✖</button>';
  h += '</div>';
  return h;
}


/* ===== MEHFIL ADMIN FUNCTIONS ===== */
function showMehfilPanel(mehfilId, panel) {
  const allBtns = document.querySelectorAll('.mehfil-admin-btn');
  for (let i = 0; i < allBtns.length; i++) { allBtns[i].classList.remove('active'); }
  
  const buttons = document.querySelectorAll('.mehfil-admin-btn');
  for (let j = 0; j < buttons.length; j++) {
    if (buttons[j].getAttribute('onclick').indexOf("'" + panel + "'") !== -1) {
      buttons[j].classList.add('active');
    }
  }
  
  if (panel === 'info') showMehfilInfo(mehfilId);
  else if (panel === 'online') showMehfilOnlineList(mehfilId);
  else if (panel === 'settings') showMehfilSettings(mehfilId);
  else loadMehfilMessages(mehfilId);
}

async function showMehfilInfo(mehfilId) {
  const ca = document.getElementById('mehfilChatArea');
  if (!ca) return;
  
  const { db } = getFirebase();
  if (!db) return;
  const doc = await db.ref('mehfils/' + mehfilId).once('value');
  const m = doc.val();
  let adminName = 'Unknown';
  if (m.uid) {
    try {
      const ad = await UserCache.get(m.uid);
      adminName = ad?.username || 'Unknown';
    } catch(e) {}
  }
  
  ca.innerHTML = '<div style="background:#fff;padding:15px;border-radius:8px;">' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid #f3f4f6;"><span style="color:#64748b;">Name</span><span style="font-weight:600;">' + esc(m.name) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid #f3f4f6;"><span style="color:#64748b;">Topic</span><span style="font-weight:600;">' + (categoryConfig[m.topic] || { icon: '📌' }).icon + ' ' + esc(m.topic) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid #f3f4f6;"><span style="color:#64748b;">Admin</span><span style="font-weight:600;">' + esc(adminName) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid #f3f4f6;"><span style="color:#64748b;">Members</span><span style="font-weight:600;">' + (m.memberCount || 1) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid #f3f4f6;"><span style="color:#64748b;">Created</span><span style="font-weight:600;">' + (m.createdAt ? timeSince(new Date(m.createdAt)) : 'Unknown') + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;"><span style="color:#64748b;">Rules</span><span style="font-weight:600;white-space:pre-wrap;">' + esc(m.rules || 'No rules set') + '</span></div>' +
    '</div>';
}

async function showMehfilOnlineList(mehfilId) {
  const ca = document.getElementById('mehfilChatArea');
  if (!ca) return;
  
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('mehfils/' + mehfilId + '/online').once('value');
  const users = [];
  const now = Date.now();
  snap.forEach(function(doc) {
    const d = doc.val();
    let last = 0;
    if (d.lastSeen) {
      if (typeof d.lastSeen === 'object' && d.lastSeen.toDate) {
        last = d.lastSeen.toDate().getTime();
      } else {
        last = d.lastSeen;
      }
    }
    const minsAgo = Math.floor((now - last) / 60000);
    users.push({ uid: d.uid, username: d.username, lastSeenAgo: minsAgo });
  });
  
  users.sort(function(a, b) { return a.lastSeenAgo - b.lastSeenAgo; });
  
  let html = '<div style="background:#fff;padding:10px;border-radius:8px;">';
  if (users.length === 0) {
    html += '<p style="text-align:center;color:#94a3b8;padding:20px;">No users online</p>';
  } else {
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const online = u.lastSeenAgo < 2;
      html += '<div style="padding:12px 10px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:10px;">' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + (online ? '#16a34a' : '#94a3b8') + ';"></span>' +
        '<span style="font-weight:600;cursor:pointer;" onclick="goToUserProfile(\'' + u.uid + '\')">' + esc(u.username) + '</span>' +
        '<span style="font-size:11px;color:#94a3b8;margin-left:auto;">' + (online ? 'Online now' : u.lastSeenAgo + ' mins ago') + '</span>' +
        '</div>';
    }
  }
  html += '</div>';
  ca.innerHTML = html;
}

function showMehfilSettings(mehfilId) {
  const ca = document.getElementById('mehfilChatArea');
  if (!ca) return;
  
  ca.innerHTML = '<div style="background:#fff;padding:15px;border-radius:8px;">' +
    '<button onclick="ddpBackToChat(\'' + mehfilId + '\')" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:10px;">← Chat</button>' +
    '<h4 style="margin-bottom:12px;">⚙️ Mehfil Settings</h4>' +
    '<button onclick="inviteToMehfil(\'' + mehfilId + '\')" style="width:100%;margin:4px 0;padding:12px;background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;text-align:left;">📩 Invite Users</button>' +
    '<button onclick="showMehfilMembers(\'' + mehfilId + '\')" style="width:100%;margin:4px 0;padding:12px;background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;text-align:left;">👥 Members List <span style="color:#94a3b8;font-size:11px;">(⭐ Afsar banao / 👢 Kick)</span></button>' +
    '<button onclick="ddpTransferMehfil(\'' + mehfilId + '\')" style="width:100%;margin:4px 0;padding:12px;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:8px;cursor:pointer;font-size:13px;text-align:left;">🔄 Transfer Mehfil <span style="color:#94a3b8;font-size:11px;">(admin kisi aur ko banao)</span></button>' +
    '<button onclick="deleteMehfilConfirm(\'' + mehfilId + '\')" style="width:100%;margin:4px 0;padding:12px;background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;border-radius:8px;cursor:pointer;font-size:13px;text-align:left;">🗑 Delete Mehfil</button>' +
    '</div>';
}

async function showMehfilMembers(mehfilId) {
  const ca = document.getElementById('mehfilChatArea');
  if (!ca) return;
  
  ca.innerHTML = '<p style="text-align:center;padding:20px;">Loading members...</p>';
  
  const { db } = getFirebase();
  if (!db) return;
  const doc = await db.ref('mehfils/' + mehfilId).once('value');
  const m = doc.val();
  const members = m.members || {};
  const banned = m.banned || {};
  const mods = m.mods || {};
  const isAdmin = (m.uid === currentUserId);
  const memberIds = Object.keys(members);
  
  let html = '<div style="background:#fff;padding:10px;border-radius:8px;">';
  html += '<button onclick="ddpBackToChat(\'' + mehfilId + '\')" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:6px;">← Chat</button>';
  html += '<h4 style="padding:10px 0;">👥 Members (' + memberIds.length + ')</h4>';
  
  /* (v145) Audit fix: members parallel fetch (pehle sequential the) */
  const _memberUsers = await Promise.all(memberIds.map(function(mid) { return UserCache.get(mid).catch(function() { return null; }); }));
  for (let i = 0; i < memberIds.length; i++) {
    const mid = memberIds[i];
    const u = _memberUsers[i];
    const name = u?.username || mid;
    
    html += '<div style="padding:12px 10px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:10px;">' +
      '<span style="font-weight:600;cursor:pointer;" onclick="goToUserProfile(\'' + mid + '\')">' + esc(name) + '</span>' +
      (mid === m.uid ? '<span style="font-size:9px;background:#fef3c7;color:#b45309;padding:2px 6px;border-radius:8px;">Admin</span>' : '') +
      (mods[mid] ? '<span style="font-size:9px;background:#eef2ff;color:#6366f1;padding:2px 6px;border-radius:8px;">Mod</span>' : '') +
      ((m.afsars || {})[mid] ? '<span style="font-size:9px;background:#fef9c3;color:#a16207;padding:2px 6px;border-radius:8px;">⭐ Afsar</span>' : '') +
      (isAdmin && mid !== currentUserId && mid !== m.uid ? '<span style="margin-left:auto;display:flex;gap:4px;">' +
        (((m.afsars || {})[mid])
          ? '<button onclick="ddpRemoveAfsar(\'' + mehfilId + '\',\'' + mid + '\')" style="background:#fef9c3;color:#a16207;border:1px solid #fde047;padding:6px 10px;border-radius:14px;font-size:10px;cursor:pointer;">⭐ Unafsar</button>'
          : '<button onclick="ddpMakeAfsar(\'' + mehfilId + '\',\'' + mid + '\')" style="background:#fffbeb;color:#b45309;border:1.5px solid #fcd34d;padding:6px 10px;border-radius:14px;font-size:10px;cursor:pointer;">⭐ Afsar banao</button>') +
        '<button onclick="kickFromMehfil(\'' + mehfilId + '\',\'' + mid + '\')" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 12px;border-radius:14px;font-size:10px;cursor:pointer;">👢 Kick</button></span>' : '') +
      '</div>';
  }
  
  const bIds = Object.keys(banned);
  if (bIds.length > 0 && isAdmin) {
    html += '<h4 style="padding:10px 0;color:#dc2626;">🚫 Banned (' + bIds.length + ')</h4>';
    for (let j = 0; j < bIds.length; j++) {
      const buid = bIds[j];
      const bu = await UserCache.get(buid);
      html += '<div style="padding:12px 10px;border-bottom:1px solid #f3f4f6;background:#fef2f2;display:flex;align-items:center;gap:10px;">' +
        '<span style="font-weight:600;color:#dc2626;">🚫 ' + esc(bu?.username || buid) + '</span>' +
        '<button onclick="unbanFromMehfil(\'' + mehfilId + '\',\'' + buid + '\')" style="margin-left:auto;background:#fff;color:#16a34a;border:1.5px solid #86efac;padding:6px 12px;border-radius:14px;font-size:10px;cursor:pointer;">✅ Unban</button>' +
        '</div>';
    }
  }
  html += '</div>';
  ca.innerHTML = html;
}

async function kickFromMehfil(mid, uid) {
  const { db } = getFirebase();
  if (!db) return;
  /* (v110) MEHFIL HIERARCHY GUARDS:
     - Owner (admin) ko KOI kick nahi kar sakta.
     - Kick sirf owner/mod/afsar kar sakta hai.
     - Afsar/Mod ko sirf owner kick kar sakta hai.
     - Kick par target ke afsar/mod roles bhi saaf hote hain. */
  let m = null;
  try { const _kd = await db.ref('mehfils/' + mid).once('value'); m = _kd.val(); } catch(e) {}
  if (!m) return;
  if (uid === m.uid) { alert('👑 Mehfil admin ko kick nahi kiya ja sakta.'); return; }
  if (uid === currentUserId) { alert('Aap khud ko kick nahi kar sakte.'); return; }
  const callerIsOwner = (m.uid === currentUserId);
  const callerIsMod = !!((m.mods || {})[currentUserId]);
  const callerIsAfsar = !!((m.afsars || {})[currentUserId]);
  if (!callerIsOwner && !callerIsMod && !callerIsAfsar) { alert('Aap ko kick karne ki ijazat nahi.'); return; }
  const targetIsStaff = !!((m.mods || {})[uid]) || !!((m.afsars || {})[uid]);
  if (targetIsStaff && !callerIsOwner) { alert('Afsar/Mod ko sirf mehfil admin kick kar sakta hai.'); return; }
  if (!confirm('Kick and ban this user?')) return;
  try {
    const ku = await UserCache.get(uid);
    const kname = (ku && ku.username) || 'user';
    await db.ref('mehfil_posts/' + mid).push({
      system: true, text: safeUser().username + ' ne ' + kname + ' ko kick krdia',
      userId: 'system', time: firebase.database.ServerValue.TIMESTAMP
    });
  } catch(e) {}
  await db.ref('mehfils/' + mid + '/members/' + uid).remove();
  await db.ref('mehfils/' + mid + '/banned/' + uid).set(true);
  await db.ref('mehfils/' + mid + '/online/' + uid).remove();
  if ((m.mods || {})[uid]) await db.ref('mehfils/' + mid + '/mods/' + uid).remove();
  if ((m.afsars || {})[uid]) await db.ref('mehfils/' + mid + '/afsars/' + uid).remove();
  const doc2 = await db.ref('mehfils/' + mid).once('value');
  const m2 = doc2.val();
  await db.ref('mehfils/' + mid).update({ memberCount: Object.keys((m2 && m2.members) || {}).length });
  alert('Kicked! 🚫');
  showMehfilMembers(mid);
}

async function unbanFromMehfil(mid, uid) {
  if (!confirm('Unban this user?')) return;
  const { db } = getFirebase();
  if (!db) return;
  const _um = (await db.ref('mehfils/' + mid).once('value')).val() || {};
  if (_um.uid !== currentUserId) { alert('Sirf mehfil admin unban kar sakta hai.'); return; }
  await db.ref('mehfils/' + mid + '/banned/' + uid).remove();
  alert('Unbanned! ✅');
  showMehfilMembers(mid);
}

async function inviteToMehfil(mehfilId) {
  const ca = document.getElementById('mehfilChatArea');
  if (!ca) return;
  
  ca.innerHTML = '<p style="text-align:center;padding:20px;">Loading online users...</p>';
  
  const { db } = getFirebase();
  if (!db) return;
  const doc = await db.ref('mehfils/' + mehfilId).once('value');
  const m = doc.val();
  const existingMembers = m.members || {};
  const banned = m.banned || {};
  
  /* Stage 3 perf: query only users active in the last 5 min (was: full status node scan).
     Same filter semantics; add ".indexOn": ["last_active"] to DB rules for scale. */
  const now = Date.now();
  const onlineUserIds = [];
  const statusSnap = await db.ref('status').orderByChild('last_active').startAt(now - 300000).once('value');
  statusSnap.forEach(function(doc) {
    const uid = doc.key;
    if (uid === currentUserId) return;
    if (existingMembers[uid]) return;
    if (banned[uid]) return;
    onlineUserIds.push(uid);
  });
  
  if (onlineUserIds.length === 0) {
    ca.innerHTML = '<div style="text-align:center;padding:20px;background:#fff;border-radius:8px;">' +
      '<p style="color:#94a3b8;">No online users available to invite!</p>' +
      '<button onclick="showMehfilSettings(\'' + mehfilId + '\')" style="margin-top:12px;padding:8px 16px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;">← Back</button></div>';
    return;
  }
  
  const usersData = await batchGetUsers(onlineUserIds);
  const onlineUsers = [];
  for (let i = 0; i < onlineUserIds.length; i++) {
    const uid = onlineUserIds[i];
    const userInfo = usersData[uid] || {};
    onlineUsers.push({ uid: uid, username: userInfo.username || uid, dp_url: userInfo.profilePic || '' });
  }
  
  let html = '<div style="background:#fff;min-height:300px;border-radius:8px;padding:10px;">' +
    '<h4 style="padding:10px;">📩 Invite Online Users (' + onlineUsers.length + ')</h4>' +
    '<p style="padding:0 10px;font-size:11px;color:#94a3b8;">Active users (last 5 min) jo abhi member nahi hain:</p>';
  
  for (let i = 0; i < onlineUsers.length; i++) {
    const u = onlineUsers[i];
    const __udp = ddpThumbUrl(safeUrl(u.dp_url), 100);
    html += '<div style="display:flex;align-items:center;gap:10px;padding:12px 10px;border-bottom:1px solid #f3f4f6;">' +
      (__udp ? '<img src="' + __udp + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'"/>' : '') +
      '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:' + (__udp ? 'none' : 'flex') + ';align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;flex-shrink:0;">' + (u.username || 'U').charAt(0).toUpperCase() + '</div>' +
      '<span style="flex:1;font-weight:600;font-size:14px;">' + esc(u.username) + '</span>' +
      '<span style="font-size:10px;color:#16a34a;">🟢 Online</span>' +
      '<button onclick="sendMehfilInvite(\'' + mehfilId + '\',\'' + u.uid + '\',\'' + escAttrJS(u.username) + '\',this)" style="background:#14b8a6;color:#fff;border:none;padding:8px 14px;border-radius:16px;font-size:11px;cursor:pointer;font-weight:600;">📩 Invite</button>' +
      '</div>';
  }
  html += '<div style="padding:15px;"><button onclick="showMehfilSettings(\'' + mehfilId + '\')" style="width:100%;padding:12px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;color:#64748b;">← Back to Settings</button></div></div>';
  ca.innerHTML = html;
}

async function sendMehfilInvite(mehfilId, targetUid, targetUsername, btn) {
  if (btn) { btn.disabled = true; btn.innerText = 'Sending...'; }
  const { db } = getFirebase();
  if (!db) return;
  try {
    const existingInvite = await db.ref('mehfils/' + mehfilId + '/invites/' + targetUid).once('value');
    if (existingInvite.exists()) {
      alert('Is user ko pehle se invite bheja ja chuka hai!');
      if (btn) { btn.disabled = false; btn.innerText = '📩 Invite'; }
      return;
    }
    
    await db.ref('mehfils/' + mehfilId + '/invites/' + targetUid).set({
      uid: targetUid,
      invitedBy: currentUserId,
      invitedAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    const mehfilDoc = await db.ref('mehfils/' + mehfilId).once('value');
    const m = mehfilDoc.val();
    await db.ref('notifications').push({
      toUid: targetUid,
      fromUid: currentUserId,
      sender_name: safeUser().username,
      type: 'mehfil_invite',
      message: safeUser().username + ' invited you to join "' + (m.name || 'Mehfil') + '"',
      mehfilId: mehfilId,
      timestamp: Date.now(),
      read: false
    });
    updateInboxBadge();
    
    if (btn) { btn.innerText = '✅ Invited'; btn.style.background = '#16a34a'; }
    alert('✅ Invite sent to ' + targetUsername + '!');
  } catch(e) {
    alert('Error: ' + e.message);
    if (btn) { btn.disabled = false; btn.innerText = '📩 Invite'; }
  }
}

async function deleteMehfilConfirm(mid) {
  if (!confirm('DELETE this mehfil permanently? This cannot be undone!')) return;
  const { db } = getFirebase();
  if (!db) return;
  const _dm = (await db.ref('mehfils/' + mid).once('value')).val() || {};
  if (_dm.uid !== currentUserId) { alert('Sirf mehfil admin hi mehfil delete kar sakta hai.'); return; }
  await db.ref('mehfils/' + mid).remove();
  await db.ref('mehfil_posts/' + mid).remove();
  alert('Mehfil deleted!');
  openPage('mehfils');
}


/* ===== v147 block (orig theme lines 9245-10390) ===== */

/* ============================================================
   ===== PATCH 4: PAGE CACHE (Blogger Pages Feed) ===== 
   ===== Added just before openStaticPage ===== 
   ============================================================ */
const PageCache = {
  data: null,
  time: 0,
  TTL: 3600000,
  loading: null,

  async fetchAll() {
    if (this.data && Date.now() - this.time < this.TTL) return this.data;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const res = await fetch('/feeds/pages/default?alt=json&max-results=50');
        const json = await res.json();
        const pages = {};
        const entries = (json && json.feed && json.feed.entry) || [];

        entries.forEach(function(e) {
          const title = (e.title && e.title.$t) || '';
          const content = (e.content && e.content.$t) || '';
          const link = (e.link || []).filter(function(l) { return l.rel === 'alternate'; })[0];
          const url = (link && link.href) || '';

          const m = url.match(/\/p\/([^\/]+)\.html/);
          if (m) pages[m[1].toLowerCase()] = { title: title, content: content, url: url };

          const titleSlug = title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
          if (titleSlug) pages[titleSlug] = { title: title, content: content, url: url };
        });

        this.data = pages;
        this.time = Date.now();
        this.loading = null;
        return pages;
      } catch (e) {
        console.error('PageCache fetch failed:', e);
        this.loading = null;
        return {};
      }
    })();

    return this.loading;
  }
};

/* ============================================================
   ===== PATCH 5: NEW openStaticPage (uses PageCache) ===== 
   ===== Bypasses login for static pages ===== 
   ============================================================ */
async function openStaticPage(page, container) {
  if (!container) container = document.getElementById('main-content-area');
  if (!container) return;

  /* SECURITY (C1): page slug comes from the URL — neutralize markup before any HTML interpolation */
  page = esc(String(page));

  // Bypass login: show content area, hide auth screen
  var authContainer = document.getElementById('auth-container');
  var homeUI = document.getElementById('home-page-ui');
  if (authContainer) authContainer.classList.remove('show-auth');
  if (homeUI) homeUI.classList.add('show-home');

  closeMoreDirect();
  const topHeader = document.querySelector('.top-header');
  const subNav = document.querySelector('.sub-nav');
  if (topHeader) topHeader.style.display = '';
  if (subNav) subNav.style.display = '';
  hideSortBar();

  currentView = page;
  NavigationHistory.push(page);

  container.style.marginTop = '82px';
  var pageTitle = (page === 'download-app') ? 'Download App' : page;
  container.innerHTML = '<div style="padding:16px;">' +
    '<button onclick="goBack()" style="background:none;border:none;font-size:16px;color:#2563eb;cursor:pointer;margin-bottom:12px;">← Back</button>' +
    '<h2 style="text-transform:capitalize;margin-bottom:12px;">' + pageTitle + '</h2>' +
    '<div id="staticPageContent" style="line-height:1.7;font-size:15px;color:#333;">' +
    '<p style="text-align:center;color:#94a3b8;">Loading...</p>' +
    '</div>' +
    '</div>';

  const contentEl = document.getElementById('staticPageContent');
  const pages = await PageCache.fetchAll();
  const data = pages[page.toLowerCase()];

  if (data && contentEl) {
    contentEl.innerHTML = data.content;
    if (page.toLowerCase() === 'about') { /* (v127) Site admin ki ID — logo ko pta chale admin kaun hai */
      contentEl.innerHTML += '<div style="margin-top:18px;padding:12px;background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:12px;font-size:14px;">👑 <b>Site Admin:</b> <a onclick="goToUserProfile(\'o1v6E1Fx1BeOEn8QN8dT1GpPU2S2\')" style="color:#4f46e5;font-weight:800;cursor:pointer;text-decoration:underline;">@damadam</a></div>';
    }
    wireAppDownloadButtons(contentEl);
  } else if (contentEl) {
    contentEl.innerHTML =
      '<p style="text-align:center;color:#94a3b8;">Page "' + page + '" not found.</p>' +
      '<p style="text-align:center;color:#94a3b8;font-size:12px;">Blogger me page check karo: <code>/p/' + page + '.html</code></p>';
  }

  saveViewState();
}

function openPage(page, isBack) {
  closeMoreDirect();
  const topHeader = document.querySelector('.top-header');
  const subNav = document.querySelector('.sub-nav');
  if (topHeader) topHeader.style.display = '';
  if (subNav) subNav.style.display = '';
  const container = document.getElementById('main-content-area');
  hideSortBar();
  
  if (!isBack && page !== 'about' && page !== 'contact' && page !== 'policy' && page !== 'download-app') {
    NavigationHistory.push(page);
  }
  
  if (page === 'mehfils') {
    currentView = 'mehfils';
    loadMehfilTabs('mehfils');
  } else if (page === 'topics') {
    currentView = 'topics';
    loadTopics(container);
  } else if (page === 'online') {
    currentView = 'online';
    loadOnline(container);
  } else if (page === 'search') {
    currentView = 'search';
    openSearch(container);
  } else if (page === 'admin') {
    currentView = 'admin';
    openAdminPanel(container);
  } else if (page === 'about') {
    openStaticPage('about', container);
  } else if (page === 'contact') {
    openStaticPage('contact', container);
  } else if (page === 'policy') {
    openStaticPage('policy', container);
  } else if (page === 'download-app') {
    openStaticPage('download-app', container);
  }
  saveViewState();
}

function loadTopics(container) {
  const tc = [
    { id: 'Poetry', name: 'Poetry', icon: '📝', g: '#6366f1' },
    { id: 'Romantic', name: 'Romantic', icon: '💕', g: '#ec4899' },
    { id: 'Sad', name: 'Sad', icon: '🥀', g: '#6b7280' },
    { id: 'Funny', name: 'Funny', icon: '😂', g: '#fbbf24' },
    { id: 'Motivational', name: 'Motivational', icon: '💪', g: '#14b8a6' },
    { id: 'Islamic', name: 'Islamic', icon: '🕌', g: '#10b981' },
    { id: 'Friendship', name: 'Friendship', icon: '🤝', g: '#3b82f6' },
    { id: 'Love', name: 'Love', icon: '💖', g: '#f43f5e' },
    { id: 'Breakup', name: 'Breakup', icon: '💔', g: '#94a3b8' },
    { id: 'Birthday', name: 'Birthday', icon: '🎂', g: '#ec4899' },
    { id: 'Random', name: 'Random', icon: '🎲', g: '#64748b' }
  ];
  
  let h = '<div style="padding-top:10px;"><h3 style="text-align:center;">Topics</h3><div class="topics-grid">';
  for (let i = 0; i < tc.length; i++) {
    const t = tc[i];
    h += '<div class="topic-card" onclick="loadTopicPosts(\'' + t.id + '\',\'' + t.name + '\')"><div class="topic-icon" style="background:' + t.g + '">' + t.icon + '</div><div class="topic-name">' + t.name + '</div></div>';
  }
  h += '</div></div>';
  container.innerHTML = h;
}

function loadTopicPosts(tid, tn) {
  const c = document.getElementById('main-content-area');
  c.style.marginTop = '82px';
  c.innerHTML = '<p style="text-align:center;">Loading ' + tn + '...</p>';
  
  const { db } = getFirebase();
  if (!db) return;
  
  db.ref('posts').orderByChild('category').equalTo(tid).once('value').then(function(snap) {
    const posts = [];
    snap.forEach(function(doc) {
      const p = doc.val();
      p.id = doc.key;
      if (!isExpired(p)) posts.push(p);
    });
    posts.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    
    let h = '<div><div style="padding:8px 15px;cursor:pointer;color:#2563eb;font-weight:600;" onclick="openPage(\'topics\')">← Back</div><h3 style="text-align:center;">' + tn + ' Posts</h3>';
    if (posts.length === 0) h += '<p style="text-align:center;">No posts.</p>';
    else {
      for (let i = 0; i < posts.length; i++) {
        const p = posts[i];
        h += '<div class="post-card"><div class="post-body" onclick="showFullPost(\'' + p.id + '\',\'' + (p.image_url ? 'image' : 'text') + '\')">' + esc(p.text || '') + '</div>' + (safeUrl(p.image_url) ? '<img loading="lazy" src="' + ddpThumbUrl(safeUrl(p.image_url), 800) + '" style="width:100%;max-height:300px;object-fit:cover"/>' : '') + '</div>';
      }
    }
    h += '</div>';
    c.innerHTML = h;
  });
}

function loadOnline(container) {
  container.innerHTML = '<p style="text-align:center;">Loading online users...</p>';
  const { db } = getFirebase();
  if (!db) return;
  
  /* Stage 3 perf: query only users active in the last 10 min (was: full status node scan).
     Add ".indexOn": ["last_active"] to DB rules for scale. */
  const __onlineCutoff = Date.now();
  db.ref('status').orderByChild('last_active').startAt(__onlineCutoff - 600000).once('value', async function(snap) {
    const onlineUserIds = [];
    
    snap.forEach(function(doc) {
      onlineUserIds.push(doc.key);
    });
    
    if (onlineUserIds.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:40px;">No users online right now 😴</p>';
      return;
    }
    
    const usersData = await batchGetUsers(onlineUserIds);
    
    const users = [];
    for (let i = 0; i < onlineUserIds.length; i++) {
      const uid = onlineUserIds[i];
      const userInfo = usersData[uid];
      const username = userInfo?.username || uid.substring(0, 8);
      users.push({ uid: uid, username: username });
    }
    
    users.sort(function(a, b) {
      return (a.username || '').toLowerCase().localeCompare((b.username || '').toLowerCase());
    });
    
    let html = '<div style="padding:15px 0;">';
    html += '<div style="background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;padding:12px 15px;text-align:center;font-weight:700;margin-bottom:10px;">🟢 Online Users (' + users.length + ')</div>';
    
    let currentLetter = '';
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const displayName = u.username;
      const firstLetter = (displayName.charAt(0) || '?').toUpperCase();
      
      if (firstLetter !== currentLetter) {
        currentLetter = firstLetter;
        html += '<div class="alphabet-header" style="font-size:18px;font-weight:800;color:#1e293b;padding:12px 15px 4px 15px;border-bottom:1px solid #e5e7eb;margin-top:8px;">' + currentLetter + '</div>';
      }
      
      html += '<div class="online-user-card" style="display:flex;align-items:center;justify-content:space-between;background:#fff;padding:12px 15px;margin-bottom:1px;border-bottom:1px solid #f3f4f6;">';
      html += '<div style="display:flex;align-items:center;gap:10px;">';
      html += '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#06b6d4,#22d3ee);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;cursor:pointer;" onclick="goToUserProfile(\'' + u.uid + '\')">' + esc(displayName).charAt(0).toUpperCase() + '</div>';
      html += '<span class="online-user-name" style="font-weight:700;font-size:15px;color:#1e293b;cursor:pointer;" onclick="goToUserProfile(\'' + u.uid + '\')">' + esc(displayName) + '</span>';
      html += '</div>';
      html += '<div class="online-user-status" style="font-size:11px;color:#16a34a;font-weight:600;background:#dcfce7;padding:4px 10px;border-radius:20px;">🟢 Online</div>';
      html += '</div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
  });
}

function openSearch(container) {
  container.style.marginTop = '82px';
  container.innerHTML = '<div class="search-container"><h3 style="padding:0 15px;">Search Users</h3><div class="search-box"><input id="searchInput" placeholder="Nickname..." onkeypress="if(event.key==\'Enter\')searchUser()"/><button onclick="searchUser()">Search</button></div><div id="searchResults"></div></div>';
}

async function searchUser() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const rd = document.getElementById('searchResults');
  if (!q) { rd.innerHTML = ''; return; }
  rd.innerHTML = '<p style="color:#666;">Searching...</p>';
  
  const { db } = getFirebase();
  if (!db) return;
  /* (2026-10-12) AUDIT 2.2: full-scan ki bajaye prefix search — bara usernames node par fast. */
  const snap = await db.ref('usernames').orderByKey().startAt(q).endAt(q + '\uf8ff').limitToFirst(30).once('value');
  const res = [];
  snap.forEach(function(doc) {
    if (doc.key.toLowerCase().indexOf(q) !== -1) res.push({ id: doc.key, uid: doc.val() });
  });

  /* (2026-10-02) Blocked users search me na dikhao (dono taraf) */
  const myBlocked = await getMyBlockedList();
  const filtered = [];
  for (let i = 0; i < res.length; i++) {
    if (myBlocked.indexOf(res[i].uid) !== -1) continue;
    const ud = await UserCache.get(res[i].uid);
    if (ud && (ud.blockedUsers || []).indexOf(currentUserId) !== -1) continue;
    filtered.push(res[i]);
  }

  if (filtered.length === 0) { rd.innerHTML = '<p style="color:#666;">No users found.</p>'; return; }
  let h = '';
  for (let i = 0; i < filtered.length; i++) {
    h += await ddpUserCardHTML(filtered[i].uid, filtered[i].id);
  }
  rd.innerHTML = h;
}
async function ddpUserCardHTML(uid, uname, trendRank, trendCount) {
  const u = await UserCache.get(uid);
  const nm = esc((u && u.username) || uname || 'user');
  const pic = ddpThumbUrl(safeUrl(u && u.profilePic), 100);
  let postCount = 0;
  /* (v150) Ranking wali gin-ti mil jaye to card dobara query na kare - 10 cards ki 10 poori downloads khatam. */
  if (typeof trendCount === 'number') {
    postCount = trendCount;
  } else try {
    const { db } = getFirebase();
    if (db) {
      const psnap = await db.ref('posts').orderByChild('user_id').equalTo(uid).once('value');
      /* (v112) popup me total nahi — trending rule wala count (7 din + 5 likes), feed/profile se match */
      let _n = 0;
      psnap.forEach(function(c) { const _p = c.val() || {}; if (!isExpired(_p) && typeof ddpIsTrending === 'function' && ddpIsTrending(_p)) _n++; });
      postCount = _n;
    }
  } catch(e) {}
  const isF = (typeof followedUsers !== 'undefined') && followedUsers.indexOf(uid) !== -1;
  let h = '<div class="ddp-user-card">';
  h += '<div class="ddp-uc-top">';
  if (pic) h += '<img src="' + pic + '" class="ddp-uc-ava" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"/>';
  h += '<div class="ddp-uc-ava-fb" style="' + (pic ? 'display:none;' : '') + '">' + nm.charAt(0).toUpperCase() + '</div>';
  h += '<span class="ddp-uc-name" data-uid="' + uid + '" onclick="goToUserProfile(\'' + uid + '\')">' + nm + ((typeof trendRank !== 'undefined' && trendRank) ? '<sup style="color:#ea580c;font-size:11px;margin-left:4px;" title="Trending #' + trendRank + '">\uD83D\uDD25 #' + trendRank + '</sup>' + verifiedTickHTML(uid) : redStarHTML(u, uid)) + '</span></div>';
  h += '<div class="ddp-uc-count" style="cursor:pointer;text-decoration:underline;" onclick="ddpShowUserTrending(\'' + uid + '\')"><span class="st">★</span> ' + postCount + ' TRENDING POSTS</div>';
  h += '<div class="ddp-uc-btns">';
  h += '<button class="ddp-uc-btn" onclick="goToUserProfile(\'' + uid + '\')"><span class="ic">👤</span>PROFILE</button>';
  h += '<button class="ddp-uc-btn" onclick="ddpSearchGoPosts(\'' + uid + '\')"><span class="ic">📝</span>POSTS</button>';
  if (uid !== currentUserId) {
    var _isReqC = !isF && (typeof _pendingFollowReqs !== 'undefined') && _pendingFollowReqs.indexOf(uid) !== -1;
    h += '<button class="ddp-uc-btn" onclick="toggleFollow(\'' + uid + '\')"><span class="ic">👥</span>' + (isF ? 'FOLLOWING' : (_isReqC ? 'REQUESTED' : 'FOLLOW')) + '</button>';
  }
  h += '</div></div>';
  return h;
}
function ddpSearchGoPosts(uid) {
  try { localStorage.setItem('ddp_profile_tab', 'posts'); } catch(e) {}
  goToUserProfile(uid);
}

/* (v112) Profile/user-card par TRENDING POSTS par click — us user ki tamam
   trending posts (7 din + 5 likes, likes order, text + image dono). */
async function ddpShowUserTrending(uid) {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;margin-top:40px;">Loading trending posts...</p>';
  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const u = await UserCache.get(uid);
    const nm = esc((u && u.username) || 'user');
    const snap = await db.ref('posts').orderByChild('user_id').equalTo(uid).once('value');
    let posts = [];
    snap.forEach(function(c) { const p = c.val(); p.id = c.key; if (!isExpired(p) && ddpIsTrending(p)) posts.push(p); });
    posts.sort(function(a, b) { const la = ddpLikeCount(a), lb = ddpLikeCount(b); if (lb !== la) return lb - la; return (b.timestamp || 0) - (a.timestamp || 0); });
    let html = '<div style="padding:12px;"><button class="btn-purple" onclick="goToUserProfile(\'' + uid + '\')">\u2190 Back to profile</button><h3 style="margin:12px 0;">\uD83D\uDD25 ' + nm + ' ki trending posts</h3></div>';
    if (posts.length === 0) {
      html += '<p style="text-align:center;color:#666;">Is user ki koi trending post nahi hai.</p>';
    } else {
      const parts = await Promise.all(posts.map(function(p) { return createPostCardHTML(p.id, p.image_url ? 'image' : 'text', p, u || {}); }));
      html += parts.join('');
    }
    container.innerHTML = html;
    initLazyImages();
    if (typeof ddpRefreshStarsBg === 'function') ddpRefreshStarsBg();
    ddpLoadInlineReplies(ddpCollectCardIds());
    ddpLoadHomeNotif();
  } catch(e) {
    container.innerHTML = '<p style="color:red;text-align:center;padding:40px;">Error loading trending posts</p>';
  }
}

/* ===== PROFILE SYSTEM ===== */

/* (v141) Complaint system — sirf damadam ke liye */
async function ddpSubmitComplaint() {
  try {
    const ta = document.getElementById('ddpComplaintText');
    const msg = document.getElementById('ddpComplaintMsg');
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) { if (msg) msg.textContent = 'Pehle shikayat likhein.'; return; }
    if (!currentUserId) { if (msg) msg.textContent = 'Login zaroori hai.'; return; }
    const fb = getFirebase(); const db = fb && fb.db;
    if (!db) { if (msg) msg.textContent = 'Connection nahi hai.'; return; }
    await db.ref('complaints').push({
      fromUid: currentUserId,
      fromUsername: safeUser().username || 'user',
      text: text,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    ta.value = '';
    if (msg) msg.textContent = '✓ Complaint bhej di gayi hai. Shukriya!';
  } catch(e) {
    const msg = document.getElementById('ddpComplaintMsg');
    if (msg) msg.textContent = 'Save nahi hui — admin ne rules update nahi kiye, thori der baad dobara try karein.';
  }
}
async function ddpLoadComplaints() {
  try {
    const box = document.getElementById('ddpComplaintList');
    if (!box) return;
    const fb = getFirebase(); const db = fb && fb.db;
    if (!db) { box.innerHTML = '<p class="ddp-muted">Connection nahi hai.</p>'; return; }
    const snap = await db.ref('complaints').orderByChild('timestamp').limitToLast(50).once('value');
    const items = [];
    snap.forEach(function(c) { const v = c.val() || {}; v.id = c.key; items.push(v); });
    items.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    if (items.length === 0) { box.innerHTML = '<p class="ddp-muted">Abhi koi complaint nahi hai.</p>'; return; }
    let h = '';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      h += '<div style="border-bottom:1px solid #f1f5f9;padding:8px 0;"><div style="font-weight:700;font-size:13px;">@' + esc(it.fromUsername || 'user') + ' <span style="color:#94a3b8;font-weight:400;font-size:11px;">' + (it.timestamp ? timeAgo(new Date(it.timestamp)) : '') + '</span> <button onclick="ddpDeleteComplaint(\'' + escAttrJS(it.id || '') + '\')" style="float:right;background:none;border:none;color:#dc2626;font-size:12px;cursor:pointer;">🗑 Delete</button></div><div style="font-size:13px;color:#334155;margin-top:2px;">' + esc(it.text || '') + '</div></div>';
    }
    box.innerHTML = h;
  } catch(e) {
    const box = document.getElementById('ddpComplaintList');
    if (box) box.innerHTML = '<p class="ddp-muted">Load nahi ho saka.</p>';
  }
}
async function ddpDeleteComplaint(cid) {
  if (!cid) return;
  try {
    const fb = getFirebase(); const db = fb && fb.db;
    if (!db) return;
    await db.ref('complaints/' + cid).remove();
    ddpLoadComplaints();
  } catch(e) { alert('Delete nahi hua.'); }
}
async function loadProfile(uid) {
  _profileUid = uid;
  _profilePostsLoaded = false;
  try { if (typeof ddpLoadPendingReqs === 'function') await ddpLoadPendingReqs(); } catch(e) {}
  ddpSelectedPhotoFile = null;
  ddpSelectedPhotoDataUrl = null;
  const container = document.getElementById('main-content-area');
  container.style.marginTop = '82px';
  container.innerHTML = '<p style="text-align:center;margin-top:40px;">Loading profile...</p>';

  try {
    const { db } = getFirebase();
    if (!db) throw new Error('Firebase not ready');
    const userDoc = await db.ref('users/' + uid).once('value');
    if (!userDoc.exists()) { container.innerHTML = '<p style="color:red;">User not found</p>'; return; }

    const d = userDoc.val();
    const nickname = d.username || 'user';
    const profilePic = d.banned ? '' : safeUrl(d.profilePic);
    let bio = d.bio || '';
    /* (v141) damadam ki professional bio — jab tak wo khud Intro na likhe */
    if (!bio && uid === 'o1v6E1Fx1BeOEn8QN8dT1GpPU2S2') bio = '👑 Admin & Founder, damadam-pk.blogspot.com — 2017 ki yaadon wali community ko dobara zinda karne ke liye. Yahan izzat aur dosti sab se pehle hai. 📩 Koi masla ya shikayat ho to neeche complaint box me likhein, baat sirf mujh tak pahunchegi.';
    const city = d.city || 'Not set';
    const starSign = d.starSign || d.star_sign || 'Not set';
    const gender = d.gender || 'Not set';
    const married = d.married || 'Not set';
    const age = (d.age === undefined || d.age === null || d.age === '') ? 'Not set' : d.age;
    const joined = d.joined ? timeSince(new Date(d.joined)) : 'Unknown';
    const totalLikes = d.likes || 0;
    const verifiedFollowers = d.verifiedFollowers || 0;
    const isOwn = (uid === currentUserId);

    /* (2026-10-02) Blocked users ek doosre ki profile nahi dekh sakte */
    if (!isOwn && await isBlockedBetween(currentUserId, uid)) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;"><div style="font-size:48px;">🚫</div><p style="font-weight:700;margin-top:10px;">Ye profile available nahi hai</p><p style="color:#94a3b8;font-size:12px;">Blocked users ek doosre ki profile nahi dekh sakte.</p></div>';
      return;
    }

    const followersSnap = await db.ref('followers/' + uid).once('value');
    const followersTotal = followersSnap.numChildren();
    const unverifiedFollowers = Math.max(0, followersTotal - verifiedFollowers);

    const postsSnap = await db.ref('posts').orderByChild('user_id').equalTo(uid).once('value');
    const posts = [];
    postsSnap.forEach(function(c) { const p = c.val(); p.id = c.key; if (!isExpired(p)) posts.push(p); });
    posts.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    /* likes in last 24h — posts already loaded, no extra reads */
    const dayAgo = Date.now() - 86400000;
    let likes24h = 0;
    for (let li = 0; li < posts.length; li++) {
      const lp = posts[li];
      if ((lp.timestamp || 0) >= dayAgo) likes24h += Object.keys(lp.likes || {}).length;
    }

    /* active trending posts — same rule as the TRENDING feed (7 din + 5 likes) */
    let trendingActive = 0;
    for (let ti = 0; ti < posts.length; ti++) {
      const tp = posts[ti];
      if (typeof ddpIsTrending === 'function' && ddpIsTrending(tp)) trendingActive++;
    }

    const mehfilsSnap = await db.ref('mehfils').orderByChild('uid').equalTo(uid).once('value');
    const ownedMehfils = [];
    mehfilsSnap.forEach(function(c) { const m = c.val(); m.id = c.key; ownedMehfils.push(m); });

    const starHtml = (typeof redStarHTML === 'function') ? redStarHTML(d, uid) : '';
    const titleText = isOwn ? 'My profile:' : esc(nickname) + '\'s profile:';

    /* (v70) BANNED PROFILE: show ID BLOCKED banner, hide pic */
    const _isBannedProfile = !!d.banned;
    let html = '<div id="ddpProfile">';
    if (_isBannedProfile) {
      html += '<div class="ddp-banned-profile-banner">🚫 ID BLOCKED</div>';
    }
    html += '<div class="ddp-backbar"><button onclick="handleBackPress()">← Back</button><span>' + esc(nickname) + starHtml + '</span></div>';

    /* PROFILE / POSTS tabs — damadam.pk design */
    html += '<div class="profile-tabs"><div class="tab-box">';
    html += '<button class="tab-btn active" id="ddpProfileTabBtn" onclick="switchProfileTab(\'profileInfo\')">👤<br/>PROFILE</button>';
    html += '<button class="tab-btn" id="ddpPostsTabBtn" onclick="switchProfileTab(\'userPosts\')"><span class="count">' + posts.length + '</span>POSTS</button>';
    html += '</div></div>';

    /* ---------- VIEW PAGE ---------- */
    html += '<div id="viewProfilePage" class="content-section">';
    html += '<h1 class="section-title">' + titleText + '</h1>';
    html += '<div class="sub-title">Profile photo:</div>';
    html += '<div class="profile-photo-wrapper">';
    if (profilePic) html += '<img src="' + profilePic + '" alt="Profile Photo" onerror="this.style.display=\'none\'"/>';
    else html += '<div class="ddp-no-photo">👤</div>';
    html += '</div>';

    if (isOwn) {
      html += '<button class="action-btn btn-edit" onclick="showEditPage()">EDIT PROFILE</button>';
      html += '<button class="action-btn btn-password" onclick="openChangePasswordModal()">CHANGE PASSWORD</button>';
      html += '<button class="action-btn btn-privacy" onclick="openPrivacyPage()">PRIVACY SETTINGS</button>';
    } else {
      const isFollowing = (typeof followedUsers !== 'undefined') && followedUsers.indexOf(uid) !== -1;
      var _isReqP = !isFollowing && (typeof _pendingFollowReqs !== 'undefined') && _pendingFollowReqs.indexOf(uid) !== -1;
      html += '<button class="action-btn btn-edit" onclick="toggleFollow(\'' + uid + '\');setTimeout(function(){loadProfile(\'' + uid + '\');},500)">' + (isFollowing ? '✅ FOLLOWING' : (_isReqP ? '⏳ REQUESTED' : '👥 FOLLOW')) + '</button>';
      html += '<button class="action-btn btn-password" onclick="startChatWith(\'' + uid + '\')">💬 1 ON 1</button>';
      if (typeof adminStarButtonsProfile === 'function') html += '<div class="ddp-admin-star-row">' + adminStarButtonsProfile(uid, d) + '</div>';
    }

    /* mehfils owned — damadam.pk card design */
    if (ownedMehfils.length > 0) {
      html += '<div class="info-card">';
      for (let mi = 0; mi < ownedMehfils.length; mi++) {
        const m = ownedMehfils[mi];
        const tIcon = (typeof categoryConfig !== 'undefined' && categoryConfig[m.topic]) ? categoryConfig[m.topic].icon : '📌';
        html += '<div class="mehfil-card" onclick="openMehfil(\'' + m.id + '\')">';
        html += '<div class="mehfil-top"><div class="mehfil-icon">' + tIcon + '</div><div><div class="mehfil-title">' + esc(m.name || 'Mehfil') + '</div><div class="mehfil-sub">owner since ' + (m.createdAt ? timeSince(new Date(m.createdAt)) : 'Unknown') + '</div></div></div>';
        html += '<div class="tags-row">';
        if (m.topic) html += '<span class="tag">' + esc(m.topic) + '</span>';
        html += '<span class="tag">' + esc(m.privacy || 'Everyone') + '</span>';
        if (m.city) html += '<span class="tag">' + esc(m.city) + '</span>';
        html += '</div></div>';
      }
      html += '</div>';
    }

    /* about card */
    html += '<div class="info-card"><div class="card-header-text">About @' + esc(nickname) + ':</div><div class="about-list">';
    html += ddpAboutRow('Intro:', bio ? esc(bio) : '<span class="ddp-muted">No intro yet</span>');
    html += ddpAboutRow('City:', esc(city));
    html += ddpAboutRow('Star sign:', esc(starSign));
    html += ddpAboutRow('Gender:', esc(gender));
    html += ddpAboutRow('Married:', esc(married));
    html += ddpAboutRow('Age:', esc(String(age)));
    html += ddpAboutRow('Joined:', esc(joined));
    html += '</div></div>';

    /* popularity card */
    html += '<div class="info-card"><div class="card-header-text">Popularity:</div><div class="about-list">';
    html += '<div class="about-item"><div class="about-label">Total likes:</div><div class="about-val">' + totalLikes + ' <span class="ddp-muted">(+' + likes24h + ' in last 24 hours)</span></div></div>';
    html += '<div class="about-item"><div class="about-label">Active trending posts:</div><div class="about-val"><a href="#" class="ddp-link" onclick="ddpShowUserTrending(\'' + uid + '\');return false;">🔥 +' + trendingActive + '</a></div></div>';
    html += '<div class="about-item"><div class="about-label">Followers:</div><div class="about-val"><a href="#" class="ddp-link" onclick="openFollowListModal(\'followers\',\'' + uid + '\');return false;">' + verifiedFollowers + ' verified followers</a><br/>' + unverifiedFollowers + ' unverified followers</div></div>';
    html += '</div></div>';

    /* (v141) Complaint box — sirf damadam ki profile par */
    if (uid === 'o1v6E1Fx1BeOEn8QN8dT1GpPU2S2') {
      if (currentUserId === uid) {
        html += '<div class="info-card"><div class="card-header-text">📩 Complaints (sirf aap dekh sakte hain):</div><div id="ddpComplaintList" style="padding:8px 0;"><p class="ddp-muted">Loading...</p></div></div>';
      } else if (currentUserId) {
        html += '<div class="info-card"><div class="card-header-text">📩 Admin ko complaint likhein:</div><div style="padding:8px 0;"><textarea id="ddpComplaintText" maxlength="500" placeholder="Apni shikayat yahan likhein..." style="width:100%;min-height:70px;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:13px;outline:none;"></textarea><button onclick="ddpSubmitComplaint()" style="margin-top:8px;background:#6366f1;color:#fff;border:none;border-radius:12px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;">Send Complaint</button><span id="ddpComplaintMsg" style="margin-left:8px;font-size:12px;color:#64748b;"></span></div></div>';
      } else {
        html += '<div class="info-card"><div class="card-header-text">📩 Admin ko complaint likhein:</div><p class="ddp-muted" style="padding:8px 0;">Complaint bhejne ke liye pehle login karein.</p></div>';
      }
    }

    html += '</div>'; /* end viewProfilePage */

    /* ---------- EDIT PAGE (damadam.pk design, real data) ---------- */
    html += '<div id="editProfilePage" class="content-section" style="display:none;">';
    html += '<h1 class="section-title">Edit my profile:</h1>';
    html += '<form id="ddpEditForm" onsubmit="return ddpSaveProfile(event)">';
    html += '<div class="form-group"><label class="form-label">Apka city:</label><select class="form-control" id="ddpInputCity">' + ddpCityOptions(city) + '</select></div>';
    html += '<div class="form-group"><label class="form-label">Apka star sign:</label><select class="form-control" id="ddpInputStar">' + ddpStarOptions(starSign) + '</select></div>';
    html += '<div class="form-group"><label class="form-label">Apna introduction likhein:</label><textarea class="form-control" id="ddpInputIntro" maxlength="300">' + esc(bio) + '</textarea></div>';
    html += '<div class="form-group"><label class="form-label">Apki profile photo:</label>';
    html += '<div class="ddp-current-photo">Currently: <span id="ddpFileUrlText">' + esc(ddpShortUrl(profilePic)) + '</span><label class="ddp-clear-label"><input type="checkbox" id="ddpClearPhotoCheck" onchange="toggleClearPhoto()"/> Clear</label></div>';
    html += '<label class="form-label ddp-small-label">Change:</label><div class="file-upload-row"><label for="ddpInputPhoto" class="btn-choose-file">Choose File</label><span id="ddpFileNameDisplay" class="ddp-file-name">no file selected</span><input type="file" id="ddpInputPhoto" accept="image/*" onchange="handleFileSelect(event)"/></div></div>';
    html += '<div class="form-group"><label class="form-label">Age likhein:</label><input type="number" class="form-control ddp-age-input" id="ddpInputAge" min="1" max="120" value="' + escAttr(String(d.age || '')) + '"/></div>';
    html += '<div class="form-group"><label class="form-label">Male or Female:</label><div class="radio-group">';
    html += '<label class="radio-option"><input type="radio" name="ddpGender" value="Female"' + (gender === 'Female' ? ' checked' : '') + '/> Female</label>';
    html += '<label class="radio-option"><input type="radio" name="ddpGender" value="Male"' + (gender === 'Male' ? ' checked' : '') + '/> Male</label>';
    html += '</div></div>';
    html += '<div class="form-group"><label class="form-label">Married:</label><div class="radio-group">';
    html += '<label class="radio-option"><input type="radio" name="ddpMarried" value="Yes"' + (married === 'Yes' ? ' checked' : '') + '/> Yes</label>';
    html += '<label class="radio-option"><input type="radio" name="ddpMarried" value="No"' + (married === 'No' ? ' checked' : '') + '/> No</label>';
    html += '</div></div>';
    html += '<button type="submit" class="btn-save">SAVE</button>';
    html += '<button type="button" class="btn-cancel" onclick="showViewPage()">CANCEL</button>';
    html += '</form></div>';

    /* posts tab */
    html += '<div id="userPostsContent" class="content-section" style="display:none;"><p class="ddp-loading">Loading posts...</p></div>';

    html += '</div>'; /* end #ddpProfile */
    container.innerHTML = html;
    if (typeof initLazyImages === 'function') initLazyImages();
    if (uid === 'o1v6E1Fx1BeOEn8QN8dT1GpPU2S2' && currentUserId === uid && typeof ddpLoadComplaints === 'function') ddpLoadComplaints();
  } catch(e) { container.innerHTML = '<p style="color:red;">Error</p>'; }
}


function switchProfileTab(tab) {
  const pb = document.getElementById('ddpProfileTabBtn');
  const pp = document.getElementById('ddpPostsTabBtn');
  const pv = document.getElementById('viewProfilePage');
  const pe = document.getElementById('editProfilePage');
  const up = document.getElementById('userPostsContent');

  if (tab === 'profileInfo') {
    if (pb) pb.classList.add('active');
    if (pp) pp.classList.remove('active');
    if (pv) pv.style.display = '';
    if (pe) pe.style.display = 'none';
    if (up) up.style.display = 'none';
  } else {
    if (pp) pp.classList.add('active');
    if (pb) pb.classList.remove('active');
    if (pv) pv.style.display = 'none';
    if (pe) pe.style.display = 'none';
    if (up) up.style.display = '';
    if (!_profilePostsLoaded && _profileUid) loadUserPosts(_profileUid);
  }
}

async function loadUserPosts(uid) {
  _profilePostsLoaded = true;
  const up = document.getElementById('userPostsContent');
  if (!up) return;
  up.innerHTML = '<p style="text-align:center;">Loading...</p>';
  
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('posts').orderByChild('user_id').equalTo(uid).once('value');
  const posts = [];
  snap.forEach(function(doc) { const p = doc.val(); p.id = doc.key; if (!isExpired(p)) posts.push(p); });
  posts.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
  
  if (posts.length === 0) { up.innerHTML = '<p style="text-align:center;color:#666;">No posts yet.</p>'; return; }
  
  /* (v26) userObj pass karo taake privacy repliesOff profile par bhi kaam kare */
  let _pUserObj = {};
  try { _pUserObj = await UserCache.get(uid) || {}; } catch(e) {}
  let html = '';
  for (let i = 0; i < posts.length; i++) {
    html += await createPostCardHTML(posts[i].id, posts[i].image_url ? 'image' : 'text', posts[i], _pUserObj);
  }
  up.innerHTML = html;
  initLazyImages();
  ddpLoadInlineReplies(ddpCollectCardIds());
}

function openFollowListModal(type, uid) {
  const container = document.getElementById('main-content-area');
  NavigationHistory.push('followList', { type: type, uid: uid });
  
  const title = type === 'followers' ? 'Followers' : 'Following';
  container.innerHTML = '<div style="background:#fff;min-height:100vh;"><div style="display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-bottom:1px solid #e5e7eb;"><span style="font-weight:700;">' + title + '</span><button onclick="loadProfile(\'' + uid + '\')" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button></div><div id="followListBody"><p style="text-align:center;padding:20px;">Loading...</p></div></div>';
  
  if (type === 'followers') loadFollowersList(uid, 'followListBody');
  else loadFollowingList(uid, 'followListBody');
}

async function loadFollowersList(uid, cid) {
  const body = document.getElementById(cid);
  if (!body) return;
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('followers/' + uid).once('value');
  const followers = snap.val() || {};
  const ids = Object.keys(followers);
  if (ids.length === 0) { body.innerHTML = '<p style="text-align:center;color:#666;">No followers yet.</p>'; return; }
  let html = '';
  for (let i = 0; i < ids.length; i++) {
    const fid = ids[i];
    const u = await UserCache.get(fid);
    const name = u?.username || fid;
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 15px;border-bottom:1px solid #f3f4f6;"><div style="display:flex;align-items:center;gap:10px;"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;cursor:pointer;" onclick="goToUserProfile(\'' + fid + '\')">' + name.charAt(0) + '</div><span style="font-weight:600;cursor:pointer;" onclick="goToUserProfile(\'' + fid + '\')">' + esc(name) + '</span></div>' + (uid === currentUserId ? '<button onclick="removeFollower(\'' + fid + '\',\'' + uid + '\')" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 14px;border-radius:16px;font-size:11px;cursor:pointer;">Remove</button>' : '') + '</div>';
  }
  body.innerHTML = html;
}

async function loadFollowingList(uid, cid) {
  const body = document.getElementById(cid);
  if (!body) return;
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('following/' + uid).once('value');
  const following = snap.val() || {};
  const ids = Object.keys(following);
  if (ids.length === 0) { body.innerHTML = '<p style="text-align:center;color:#666;">Not following anyone.</p>'; return; }
  let html = '';
  for (let i = 0; i < ids.length; i++) {
    const fid = ids[i];
    const u = await UserCache.get(fid);
    const name = u?.username || fid;
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 15px;border-bottom:1px solid #f3f4f6;"><div style="display:flex;align-items:center;gap:10px;"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;cursor:pointer;" onclick="goToUserProfile(\'' + fid + '\')">' + name.charAt(0) + '</div><span style="font-weight:600;cursor:pointer;" onclick="goToUserProfile(\'' + fid + '\')">' + esc(name) + '</span></div>' + (uid === currentUserId ? '<button onclick="unfollowUser(\'' + fid + '\',\'' + uid + '\')" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 14px;border-radius:16px;font-size:11px;cursor:pointer;">Unfollow</button>' : '') + '</div>';
  }
  body.innerHTML = html;
}

async function removeFollower(fid, myUid) {
  if (!confirm('Remove?')) return;
  const { db } = getFirebase();
  if (!db) return;
  await db.ref('followers/' + myUid + '/' + fid).remove();
  await db.ref('following/' + fid + '/' + myUid).remove();
  loadFollowersList(myUid, 'followListBody');
}

async function unfollowUser(fid, myUid) {
  if (!confirm('Unfollow?')) return;
  const { db } = getFirebase();
  if (!db) return;
  await db.ref('following/' + myUid + '/' + fid).remove();
  await db.ref('followers/' + fid + '/' + myUid).remove();
  followedUsers = followedUsers.filter(function(u) { return u !== fid; });
  loadFollowingList(myUid, 'followListBody');
}

function openPrivacyPage() {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  /* (v54) Show UI skeleton IMMEDIATELY - don't wait for Firebase */
  var html = '<div style="background:#fff;min-height:100vh;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-bottom:1px solid #e5e7eb;position:sticky;top:0;background:#fff;z-index:5;">';
  html += '<span style="font-weight:700;font-size:15px;">🔒 Privacy Settings</span>';
  html += '<button onclick="loadProfile(\'' + (typeof currentUserId !== 'undefined' ? currentUserId : '') + '\')" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button></div>';
  html += '<div style="padding:12px 15px;max-width:600px;margin:0 auto;" id="ddpPrivacyBody">';
  html += '<p style="text-align:center;color:#888;padding:20px;">Loading your settings...</p>';
  html += '</div></div>';
  container.innerHTML = html;
  /* Load data in background */
  setTimeout(function() { try { ddpRenderPrivacyPage(); } catch(e) { console.error(e); } }, 100);
}
async function ddpRenderPrivacyPage() {
  const container = document.getElementById('main-content-area');
  if (!container) return;
  if (!currentUserId) {
    container.innerHTML = '<div style="padding:40px;text-align:center;"><p>⚠️ Please log in to view privacy settings.</p><button onclick="goHome()" style="padding:10px 20px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;">Go Home</button></div>';
    return;
  }
  var db = null;
  try { db = getFirebase().db; } catch(e) {}
  if (!db) {
    container.innerHTML = '<div style="padding:40px;text-align:center;"><p>⚠️ Cannot connect. Please check your internet and try again.</p><button onclick="openPrivacyPage()" style="padding:10px 20px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;">Retry</button></div>';
    return;
  }
  let followApproval = false;
  let followersOnly1on1 = false;
  let requests = [];
  let followers = [];
  let following = [];
  let blocked = [];
  try {
    /* (v51) Timeout after 8 seconds - don't hang forever on slow Firebase */
    const _timeout = new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, 8000); });
    const snaps = await Promise.race([
      Promise.all([
        db.ref('users/' + currentUserId + '/followApproval').once('value'),
        db.ref('followRequests/' + currentUserId).once('value'),
        db.ref('followers/' + currentUserId).once('value'),
        db.ref('users/' + currentUserId + '/followersOnly1on1').once('value'),
        db.ref('following/' + currentUserId).once('value'),
        db.ref('users/' + currentUserId + '/blockedUsers').once('value')
      ]),
      _timeout
    ]);
    followApproval = !!snaps[0].val();
    snaps[1].forEach(function(c) { const r = c.val() || {}; r.uid = c.key; requests.push(r); });
    snaps[2].forEach(function(c) { followers.push(c.key); });
    followersOnly1on1 = !!snaps[3].val();
    snaps[4].forEach(function(c) { following.push(c.key); }); /* (v88) Fixed: was snaps[6] */
    blocked = snaps[5].val() || []; /* (v88) Fixed: was snaps[7] */
  } catch(e) {}
  requests.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

  let html = '<div style="background:#fff;min-height:100vh;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-bottom:1px solid #e5e7eb;position:sticky;top:0;background:#fff;z-index:5;">';
  html += '<span style="font-weight:700;font-size:15px;">🔒 Privacy Settings</span>';
  html += '<button onclick="loadProfile(\'' + currentUserId + '\')" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button></div>';
  html += '<div style="padding:12px 15px;max-width:600px;margin:0 auto;">';

  // 1. Follow permission
  html += '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
  html += '<div><div style="font-weight:700;font-size:14px;">👥 Follow Permission</div>';
  html += '<div style="font-size:12px;color:#666;margin-top:4px;">ON hai to koi aapko follow nahi kar sakega jab tak aap request accept na karein.</div></div>';
  html += '<button onclick="ddpToggleFollowApproval()" style="background:' + (followApproval ? '#10b981' : '#e5e7eb') + ';color:' + (followApproval ? '#fff' : '#666') + ';border:none;padding:8px 18px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">' + (followApproval ? 'ON' : 'OFF') + '</button>';
  html += '</div></div>';

  // 1b. Followers-only 1on1 (v24)
  html += '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
  html += '<div><div style="font-weight:700;font-size:14px;">💬 Followers-Only 1on1</div>';
  html += '<div style="font-size:12px;color:#666;margin-top:4px;">ON hai to sirf aapke followers aapko 1on1 invite bhej sakenge.</div></div>';
  html += '<button onclick="ddpToggleFollowersOnly1on1()" style="background:' + (followersOnly1on1 ? '#10b981' : '#e5e7eb') + ';color:' + (followersOnly1on1 ? '#fff' : '#666') + ';border:none;padding:8px 18px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">' + (followersOnly1on1 ? 'ON' : 'OFF') + '</button>';
  html += '</div></div>';

  // 2. Follow requests
  html += '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px;">';
  html += '<div style="font-weight:700;font-size:14px;margin-bottom:10px;">📩 Follow Requests (' + requests.length + ')</div>';
  if (requests.length === 0) {
    html += '<p style="font-size:12px;color:#888;">Koi pending request nahi.</p>';
  } else {
    html += '<div id="ddpReqList"></div>';
  }
  html += '</div>';

  // 3. Followers
  html += '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px;">';
  html += '<div style="font-weight:700;font-size:14px;margin-bottom:10px;">👥 Followers (' + followers.length + ')</div>';
  html += '<div id="ddpFollowersList"><p style="font-size:12px;color:#888;">Loading...</p></div></div>';

  // 4. Following
  html += '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px;">';
  html += '<div style="font-weight:700;font-size:14px;margin-bottom:10px;">➡️ Following (' + following.length + ')</div>';
  html += '<div id="ddpFollowingList"><p style="font-size:12px;color:#888;">Loading...</p></div></div>';

  // 5. Blocked
  html += '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px;">';
  html += '<div style="font-weight:700;font-size:14px;margin-bottom:10px;">🚫 Blocked Users (' + blocked.length + ')</div>';
  html += '<div id="ddpBlockedList"><p style="font-size:12px;color:#888;">Loading...</p></div></div>';

  html += '</div></div>';
  var bodyEl = document.getElementById('ddpPrivacyBody');
  if (bodyEl) {
    /* Extract inner content (skip outer wrapper since openPrivacyPage already created it) */
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var inner = tmp.querySelector('div > div:last-child');
    bodyEl.innerHTML = inner ? inner.innerHTML : html;
  } else {
    container.innerHTML = html;
  }

  // fill lists async
  ddpFillPrivacyLists(requests, followers, following, blocked);
}
/* (v89) Privacy lists: fetch ALL usernames in PARALLEL via batchGetUsers
   (chunks of 10, Promise.all) instead of sequential per-user awaits.
   The sequential N+1 pattern made Privacy lists load slowly on first open. */
async function ddpFillPrivacyLists(requests, followers, following, blocked) {
  /* gather every uid once, fetch all in parallel, then render synchronously */
  var allUids = [];
  var qi;
  for (qi = 0; qi < requests.length; qi++) { if (requests[qi] && requests[qi].uid) allUids.push(requests[qi].uid); }
  for (qi = 0; qi < followers.length; qi++) allUids.push(followers[qi]);
  for (qi = 0; qi < following.length; qi++) allUids.push(following[qi]);
  for (qi = 0; qi < blocked.length; qi++) allUids.push(blocked[qi]);
  var users = {};
  try { users = await batchGetUsers(allUids); } catch(e) { users = {}; }
  function nmOf(uid, fb) { var u = users[uid]; return esc((u && u.username) || fb || uid); }
  // requests
  const reqBox = document.getElementById('ddpReqList');
  if (reqBox) {
    let h = '';
    for (let i = 0; i < requests.length; i++) {
      const r = requests[i];
      const nm = nmOf(r.uid, r.username);
      h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;">';
      h += '<span style="font-weight:600;font-size:13px;cursor:pointer;" onclick="goToUserProfile(\'' + r.uid + '\')">\ud83d\udce9 ' + nm + '</span>';
      h += '<span><button onclick="ddpAcceptFollowRequest(\'' + r.uid + '\')" style="background:#10b981;color:#fff;border:none;padding:6px 14px;border-radius:16px;font-size:11px;font-weight:700;cursor:pointer;margin-right:6px;">Accept</button>';
      h += '<button onclick="ddpDeclineFollowRequest(\'' + r.uid + '\')" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 14px;border-radius:16px;font-size:11px;cursor:pointer;">Decline</button></span></div>';
    }
    reqBox.innerHTML = h;
  }
  // followers with Remove
  const fBox = document.getElementById('ddpFollowersList');
  if (fBox) {
    if (followers.length === 0) { fBox.innerHTML = '<p style="font-size:12px;color:#888;">Koi follower nahi.</p>'; }
    else {
      let h = '';
      for (let i = 0; i < followers.length; i++) {
        const fid = followers[i];
        const nm = nmOf(fid);
        h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;">';
        h += '<span style="font-weight:600;font-size:13px;cursor:pointer;" onclick="goToUserProfile(\'' + fid + '\')">\ud83d\udc64 ' + nm + '</span>';
        h += '<button onclick="ddpRemoveFollower(\'' + fid + '\')" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 14px;border-radius:16px;font-size:11px;cursor:pointer;">Remove</button></div>';
      }
      fBox.innerHTML = h;
    }
  }
  // following with Unfollow
  const gBox = document.getElementById('ddpFollowingList');
  if (gBox) {
    if (following.length === 0) { gBox.innerHTML = '<p style="font-size:12px;color:#888;">Kisi ko follow nahi kar rahe.</p>'; }
    else {
      let h = '';
      for (let i = 0; i < following.length; i++) {
        const fid = following[i];
        const nm = nmOf(fid);
        h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;">';
        h += '<span style="font-weight:600;font-size:13px;cursor:pointer;" onclick="goToUserProfile(\'' + fid + '\')">\ud83d\udc64 ' + nm + '</span>';
        h += '<button onclick="toggleFollow(\'' + fid + '\');setTimeout(ddpRenderPrivacyPage,1200);" style="background:#e0f7fa;color:#00838f;border:none;padding:6px 14px;border-radius:16px;font-size:11px;font-weight:700;cursor:pointer;">Unfollow</button></div>';
      }
      gBox.innerHTML = h;
    }
  }
  // blocked with Unblock
  const bBox = document.getElementById('ddpBlockedList');
  if (bBox) {
    if (blocked.length === 0) { bBox.innerHTML = '<p style="font-size:12px;color:#888;">Koi blocked user nahi.</p>'; }
    else {
      let h = '';
      for (let i = 0; i < blocked.length; i++) {
        const buid = blocked[i];
        const nm = nmOf(buid);
        h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;">';
        h += '<span style="font-weight:600;font-size:13px;">\ud83d\udeab ' + nm + '</span>';
        h += '<button onclick="unblockUser(\'' + buid + '\');setTimeout(ddpRenderPrivacyPage,1200);" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 14px;border-radius:16px;font-size:11px;cursor:pointer;">Unblock</button></div>';
      }
      bBox.innerHTML = h;
    }
  }
}
/* (v24) Followers-only 1on1 toggle */
async function ddpToggleFollowersOnly1on1() {
  if (!currentUserId) return;
  try {
    const { db } = getFirebase();
    const ref = db.ref('users/' + currentUserId + '/followersOnly1on1');
    const snap = await ref.once('value');
    await ref.set(!snap.val());
    ddpRenderPrivacyPage();
  } catch(e) { alert('Error: ' + e.message); }
}
async function ddpToggleFollowApproval() {
  if (!currentUserId) return;
  try {
    const { db } = getFirebase();
    const ref = db.ref('users/' + currentUserId + '/followApproval');
    const snap = await ref.once('value');
    await ref.set(!snap.val());
    ddpRenderPrivacyPage();
  } catch(e) { alert('Error: ' + e.message); }
}


async function ddpAcceptFollowRequest(uid) {
  if (!currentUserId || !uid) return;
  try {
    const { db } = getFirebase();
    const now = Date.now();
    const updates = {};
    updates['followRequests/' + currentUserId + '/' + uid] = null;
    updates['users/' + uid + '/following/' + currentUserId] = { uid: currentUserId, addedAt: now };
    updates['followers/' + currentUserId + '/' + uid] = { uid: uid, timestamp: now };
    updates['following/' + uid + '/' + currentUserId] = { uid: currentUserId, timestamp: now };
    await db.ref().update(updates);
    await db.ref('users/' + currentUserId + '/followers').transaction(function(c) { return (c || 0) + 1; });
    await db.ref('users/' + currentUserId + '/verifiedFollowers').transaction(function(c) { return (c || 0) + 1; });
    try {
      await db.ref('notifications').push({
        toUid: uid, fromUid: currentUserId,
        sender_name: safeUser().username, type: 'follow',
        message: safeUser().username + ' accepted your follow request 👥',
        timestamp: now, read: false
      });
    } catch(e) {}
    ddpRenderPrivacyPage();
  } catch(e) { alert('Error: ' + e.message); }
}
async function ddpDeclineFollowRequest(uid) {
  if (!currentUserId || !uid) return;
  try {
    const { db } = getFirebase();
    await db.ref('followRequests/' + currentUserId + '/' + uid).remove();
    ddpRenderPrivacyPage();
  } catch(e) { alert('Error: ' + e.message); }
}
async function ddpRemoveFollower(uid) {
  if (!currentUserId || !uid) return;
  if (!confirm('Is follower ko remove karein?')) return;
  try {
    const { db } = getFirebase();
    await db.ref('followers/' + currentUserId + '/' + uid).remove();
    await db.ref('following/' + uid + '/' + currentUserId).remove();
    await db.ref('users/' + uid + '/following/' + currentUserId).remove();
    await db.ref('users/' + currentUserId + '/followers').transaction(function(c) { return Math.max(0, (c || 1) - 1); });
    await db.ref('users/' + currentUserId + '/verifiedFollowers').transaction(function(c) { return Math.max(0, (c || 1) - 1); });
    ddpRenderPrivacyPage();
  } catch(e) { alert('Error: ' + e.message); }
}
/* pending outgoing follow requests (for card button state) */
var _pendingFollowReqs = [];
async function ddpLoadPendingReqs() {
  _pendingFollowReqs = [];
  if (!currentUserId) return;
  try {
    const { db } = getFirebase();
    if (!db) return;
    // outgoing requests: scan followRequests/*/<me> — instead store my outgoing under my own node
    const snap = await db.ref('users/' + currentUserId + '/outgoingReqs').once('value');
    snap.forEach(function(c) { _pendingFollowReqs.push(c.key); });
  } catch(e) {}
}

async function unblockUser(uid) {
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('users/' + currentUserId + '/blockedUsers').once('value');
  let list = snap.val() || [];
  list = list.filter(function(u) { return u !== uid; });
  await db.ref('users/' + currentUserId + '/blockedUsers').set(list);
  invalidateBlockedCache();
  clearPostCache();
  alert('Unblocked!');
  if (typeof openPrivacyPage === 'function') openPrivacyPage();
}


/* ===== damadam.pk profile replica helpers ===== */
var ddpSelectedPhotoFile = null;
var ddpSelectedPhotoDataUrl = null;
var DDP_CITIES = ['Abbas','Abbottabad','Abdal','Abdullah','Adam','Addu','Ahmadpur','Ahmedpur','Akora','Alamgir','Allah','Allahyar','Alpuri','Aqil','Arifwala','Astore','Athmuqam','Attock','Awaran','Badin','Baffa','Bagh','Bahauddin','Bahawalnagar','Bahawalpur','Bahrain','Bala','Balakot','Bannu','Barikot','Barkhan','Batkhela','Battagram','Bela','Besham','Besima','Bhakkar','Bhalwal','Bhimber','Bugti','Buleda','Buner','Burewala','Cantt','Chakdara','Chakwal','Chaman','Channu','Charbagh','Charsadda','Chichawatni','Chilas','Chiniot','Chishtian','Chitral','Chunian','Dadan','Dadu','Daggar','Daharki','Dalbandin','Darband','Dargai','Daska','Dassu','Depalpur','Dera','Dhadar','Digri','Dina','Dir','Dokri','Drosh','Duki','Dunyapur','East','Faisalabad','Fateh','Feroze','Fort','Forward','Gahkuch','Gandakha','Gharo','Ghazi','Ghotki','Gichk','Gilgit','Gojra','Golarchi','Gujar','Gujranwala','Gujrat','Gwadar','Hafizabad','Hala','Hangu','Haripur','Harnai','Haroonabad','Hasan','Hasilpur','Hattian','Havelian','Hazro','Hoshab','Hub','Hunza','Hussain','Hyderabad','Islamabad','Ismail','Jacobabad','Jahanian','Jamali','Jampur','Jamshoro','Jang','Jaranwala','Jatoi','Jehangira','Jhal','Jhang','Jhelum','Jhuddo','Jiwani','Kabal','Kabirwala','Kaghan','Kahuta','Kalabat','Kalam','Kalat','Kamalia','Kamoke','Kandhkot','Kandiaro','Karachi','Karak','Karimabad','Kashmore','Kasur','Khairpur','Khan','Khanewal','Khanpur','Khaplu','Kharan','Kharian','Khas','Khattak','Khipro','Khurd','Khushab','Khuzdar','Khwazakhela','Killa','Kohat','Kohlu','Kot','Kotal','Kotli','Kotri','Lahore','Lakki','Lalamusa','Landi','Larkana','Lasbela','Layyah','Lehri','Liaquatpur','Lodhran','Lora','Loralai','Mach','Magsi','Malakand','Malakwal','Mand','Mandi','Mangocher','Mansehra','Mardan','Marwat','Mastung','Mathelo','Matiari','Matli','Matta','Mehar','Mian','Mianwali','Mingora','Miranshah','Mirpur','Mithi','Moro','Muhammad','Multan','Murad','Muridke','Murree','Musakhel','Muzaffarabad','Muzaffargarh','Nagar','Nal','Nankana','Naran','Narowal','Naseerabad','Naudero','Naushahro','Nawabshah','Nowshera','Nushki','Oghi','Okara','Ormara','Pabbi','Pakpattan','Pallandri','Panjgur','Pano','Parachinar','Pasni','Pasrur','Pattoki','Peshawar','Phalia','Pind','Piplan','Pishin','Quetta','Rahim','Rajanpur','Ratodero','Rawalakot','Rawalpindi','Renala','Rohri','Rondu','Sadiqabad','Sahib','Sahiwal','Saidu','Saifullah','Sajawal','Sakro','Sambrial','Samundri','Sangan','Sanghar','Sarai','Sargodha','Sehwan','Shahdadpur','Shakargarh','Shangla','Sharif','Sheikhupura','Sherani','Shewa','Shigar','Shikarpur','Shujabad','Sial','Sialkot','Sibi','Singh','Sinjhoro','Skardu','Sohawa','Sohbatpur','Sui','Sujawal','Surab','Swabi','Takht-i-Bahi','Talagang','Tando','Tank','Taxila','Tek','Thana','Thatta','Timergara','Toba','Topi','Tump','Turbat','Ubauro','Umerkot','Usta','Uthal','Vehari','Wadh','Wah','Wana','Warah','Washuk','Wazirabad','Winder','Yar','Yazman','Zafarwal','Zaida','Zehri','Zhob','Ziarat']; /* (v150) Pakistan ki tamam cities: har zila HQ + mashhoor qasbe, A-Z */
var DDP_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

/* (2026-10-12) AUDIT 1.2: weak escAttr duplicate removed — the strong version (line ~1459,
   escapes & < > " ') is the only one now. Verified: all call sites are plain HTML attributes. */
function ddpAboutRow(label, valHtml) {
  return '<div class="about-item"><div class="about-label">' + label + '</div><div class="about-val">' + valHtml + '</div></div>';
}
function ddpCityOptions(sel) {
  let h = '<option value=""' + ((!sel || sel === 'Not set') ? ' selected' : '') + '>No city</option>';
  for (let i = 0; i < DDP_CITIES.length; i++) {
    h += '<option value="' + DDP_CITIES[i] + '"' + (sel === DDP_CITIES[i] ? ' selected' : '') + '>' + DDP_CITIES[i] + '</option>';
  }
  return h;
}
function ddpStarOptions(sel) {
  let h = '<option value=""' + ((!sel || sel === 'Not set') ? ' selected' : '') + '>Not set</option>';
  for (let i = 0; i < DDP_SIGNS.length; i++) {
    h += '<option value="' + DDP_SIGNS[i] + '"' + (sel === DDP_SIGNS[i] ? ' selected' : '') + '>' + DDP_SIGNS[i] + '</option>';
  }
  return h;
}
function ddpShortUrl(u) {
  if (!u) return 'No photo';
  return u.length > 42 ? u.slice(0, 42) + '…' : u;
}
function ddpVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function ddpCheckedRadio(name) { const el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }

function showEditPage() {
  ddpSelectedPhotoFile = null;
  ddpSelectedPhotoDataUrl = null;
  document.getElementById('viewProfilePage').style.display = 'none';
  document.getElementById('userPostsContent').style.display = 'none';
  document.getElementById('editProfilePage').style.display = '';
  window.scrollTo(0, 0);
}
function showViewPage() {
  document.getElementById('editProfilePage').style.display = 'none';
  document.getElementById('userPostsContent').style.display = 'none';
  document.getElementById('viewProfilePage').style.display = '';
  const pb = document.getElementById('ddpProfileTabBtn');
  const pp = document.getElementById('ddpPostsTabBtn');
  if (pb) pb.classList.add('active');
  if (pp) pp.classList.remove('active');
  window.scrollTo(0, 0);
}
function handleFileSelect(event) {
  const file = event.target.files[0];
  const nameEl = document.getElementById('ddpFileNameDisplay');
  const clearEl = document.getElementById('ddpClearPhotoCheck');
  if (file) {
    if (nameEl) nameEl.textContent = file.name;
    if (clearEl) clearEl.checked = false;
    ddpSelectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = function(e) { ddpSelectedPhotoDataUrl = e.target.result; };
    reader.readAsDataURL(file);
  }
}
function toggleClearPhoto() {
  const clearEl = document.getElementById('ddpClearPhotoCheck');
  if (clearEl && clearEl.checked) {
    const nameEl = document.getElementById('ddpFileNameDisplay');
    const fileEl = document.getElementById('ddpInputPhoto');
    if (nameEl) nameEl.textContent = 'no file selected';
    if (fileEl) fileEl.value = '';
    ddpSelectedPhotoFile = null;
    ddpSelectedPhotoDataUrl = null;
  }
}
async function ddpSaveProfile(event) {
  if (event) event.preventDefault();
  const clearEl = document.getElementById('ddpClearPhotoCheck');
  const isCleared = clearEl && clearEl.checked;
  let pp = (typeof currentUser !== 'undefined' && currentUser && currentUser.profilePic) ? currentUser.profilePic : '';
  if (isCleared) {
    pp = '';
  } else if (ddpSelectedPhotoFile) {
    try { pp = await uploadImageToCloudinary(ddpSelectedPhotoFile); }
    catch(e) { alert(e && e.message ? e.message : 'Upload failed'); return false; }
  }
  const update = {
    bio: ddpVal('ddpInputIntro'),
    city: ddpVal('ddpInputCity'),
    starSign: ddpVal('ddpInputStar'),
    gender: ddpCheckedRadio('ddpGender'),
    married: ddpCheckedRadio('ddpMarried'),
    age: parseInt(ddpVal('ddpInputAge'), 10) || null,
    profilePic: pp
  };
  const fb = getFirebase();
  const db = fb && fb.db;
  if (!db) return false;
  await db.ref('users/' + currentUserId).update(update);
  if (typeof currentUser !== 'undefined') currentUser = Object.assign({}, currentUser, update);
  if (typeof UserCache !== 'undefined' && UserCache.set) UserCache.set(currentUserId, currentUser);
  loadProfile(currentUserId);
  return false;
}

async function checkAndJoinMehfil(mid) {
  const { db } = getFirebase();
  if (!db) return;
  const snap = await db.ref('mehfils/' + mid).once('value');
  const m = snap.val();
  if (!m) return;
  if (m.members && m.members[currentUserId]) {
    openMehfil(mid);
  } else {
    if (confirm('Join "' + m.name + '"?')) {
      await joinMehfil(mid);
      openMehfil(mid);
    }
  }
}


/* ===== v147 block (orig theme lines 10391-10590) ===== */

/* ============================================================
   ===== PATCH 6 & 7: DOMContentLoaded — Login Bypass + Init =====
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  // PATCH 6: Bypass login for Blogger static page URLs
  var pathMatch = window.location.pathname.match(/^\/p\/([^\/]+)\.html$/);
  if (pathMatch) {
    var slug = pathMatch[1].toLowerCase();
    var ac = document.getElementById('auth-container');
    var hu = document.getElementById('home-page-ui');
    if (ac) ac.classList.remove('show-auth');
    if (hu) hu.classList.add('show-home');
    setTimeout(function() { openStaticPage(slug); }, 100);
    return;
  }

  currentLang = localStorage.getItem('dm_lang') || 'en';
  
  // PATCH 7: Retry cap to prevent infinite polling
  let __fbTries = 0;
  const checkFirebase = setInterval(() => {
    if (++__fbTries > 100) { clearInterval(checkFirebase); console.warn('Firebase load timed out'); return; }
    const { auth } = getFirebase();
    if (auth) {
      clearInterval(checkFirebase);
      auth.onAuthStateChanged(async function(user) {
        const { db } = getFirebase();
        if (!db) return;
        if (user) {
          currentUserId = user.uid;
          /* Ban enforcement: banned accounts are signed out immediately */
          try {
            const banSnap = await db.ref('users/' + user.uid + '/banned').once('value');
            if (banSnap && banSnap.val()) {
              try { await auth.signOut(); } catch (e) {}
              alert('🚫 This account has been banned. Contact the site admin if you think this is a mistake.');
              return;
            }
          } catch (e) { /* if the check itself fails, let login continue */ }
          /* (v46) Real-time ban enforcement: if banned while logged in, sign out immediately */
          try {
            db.ref('users/' + user.uid + '/banned').on('value', async function(_bs) {
              if (_bs && _bs.val()) {
                try { db.ref('users/' + user.uid + '/banned').off(); } catch(e) {}
                try { await auth.signOut(); } catch(e) {}
                alert('🚫 You have been banned by the admin.');
                try { location.reload(); } catch(e) {}
              }
            });
          } catch(e) {}
          /* (v124) IP trace: session start par lastIP + ipHistory update + banned-IP enforcement.
             Throttle: IP badle ya 24h guzre tab hi likho (warna har page refresh par write hota).
             Returns false sirf tab jab IP banned ho (caller handler se return kare); kisi bhi failure par true (login continue). */
          async function ddpRecordLoginIP(db, auth, uid) {
            try {
              var _r = await fetch('https://api.ipify.org?format=json').then(function(x){return x.json();}).catch(function(){return null;});
              if (!_r || !_r.ip) return true;
              var _ip = _r.ip, _key = _ip.replace(/\./g, '_');
              try {
                var _lp = await db.ref('users/' + uid + '/lastIP').once('value');
                var _lastIP = _lp.val();
                var _hs = await db.ref('users/' + uid + '/ipHistory/' + _key).once('value');
                var _h = _hs.val() || null;
                var _now = Date.now();
                var _stale = !_h || !_h.lastSeen || (_now - Number(_h.lastSeen) > 24*60*60*1000);
                if (_ip !== _lastIP || _stale) {
                  var _up = {};
                  _up['users/' + uid + '/lastIP'] = _ip;
                  _up['users/' + uid + '/ipHistory/' + _key + '/lastSeen'] = _now;
                  _up['users/' + uid + '/ipHistory/' + _key + '/count'] = (_h && _h.count ? _h.count : 0) + 1;
                  if (!_h) _up['users/' + uid + '/ipHistory/' + _key + '/firstSeen'] = _now;
                  await db.ref().update(_up);
                }
              } catch(e) {}
              var _ban = await db.ref('bannedIPs/' + _key).once('value');
              if (_ban && _ban.val()) {
                try { await auth.signOut(); } catch(e) {}
                alert('🚫 This IP address has been banned. Contact the site admin if you think this is a mistake.');
                return false;
              }
              return true;
            } catch(e) { return true; }
          }
          /* (v149) Speed: IP record background me chalao - login ka rasta kabhi na roke. Pehle slow net par 1.2s tak login rukta tha. Banned IP ho to ddpRecordLoginIP khud sign-out + alert karta hai, wo barkarar hai. */
          try { ddpRecordLoginIP(db, auth, user.uid).catch(function(){}); } catch(e){}
          const userData = await UserCache.get(user.uid);
          currentUser = userData || {};
          if (!currentUser?.username) {
            const rawPrefix = (user.email || '').split('@')[0] || ('user_' + user.uid.slice(0,6));
            /* H1: claim the nickname atomically — never overwrite another user's mapping.
               On failure, leave username empty so the next login retries the claim. */
            try {
              let base = sanitizeNickname(rawPrefix);
              if (base.length < 3) base = 'user_' + user.uid.slice(0, 6).toLowerCase();
              const claimedNick = await claimUsername(db, base, user.uid);
              currentUser = { username: claimedNick, email: user.email, bio: '', profilePic: '', joined: Date.now() };
              await db.ref('users/' + user.uid).set(currentUser);
              UserCache.set(user.uid, currentUser);
              /* (v124) claim .set() ne IP record wipe kar diya ho to dobara record karo */
              try { await ddpRecordLoginIP(db, auth, user.uid); } catch(e) {}
            } catch (e) {
              console.error('Username claim failed, will retry on next login:', e);
              currentUser = { username: '', email: user.email, bio: '', profilePic: '', joined: Date.now() };
            }
          }
          startHeartbeat();

          // PATCH 7: Show UI first, defer heavy tasks
          document.getElementById('auth-container').classList.remove('show-auth');
          document.getElementById('home-page-ui').classList.add('show-home');
          populateCategorySelects();
          /* (v149) Speed: followedUsers UI ke baad load karo - feed ko chahiye, login ko nahi; shell pehle paint ho. */
          await loadFollowedUsers();

          setTimeout(function() {
            /* Stage 2: isolate init tasks — one failure must not silently block the others */
            try { updateInboxBadge(); } catch (e) { console.error('updateInboxBadge failed:', e); }
            try { updateForMeBadge(); } catch (e) { console.error('updateForMeBadge failed:', e); }
            /* (v149) For Me badge inbox jaisa live: nayi post aate hi dobara gin lo. */
            try {
              if (!window._forMePostListener) {
                window._forMePostListener = true;
                db.ref('posts').limitToLast(1).on('child_added', function() { try { updateForMeBadge(); } catch(e){} });
              }
            } catch (e) { console.error('forMe post listener failed:', e); }
            try { startNotifListener(); } catch (e) { console.error('startNotifListener failed:', e); }
            try { checkSiteAdmin(); } catch (e) { console.error('checkSiteAdmin failed:', e); }
            setTimeout(cleanOldPosts, 3000);
          }, 500);

          NavigationHistory.clear();
          NavigationHistory.push('home');
          var savedState = null;
          try { savedState = JSON.parse(localStorage.getItem('appViewState')); } catch(e) {}
          if (savedState && savedState.view) {
            if (savedState.tab) currentTab = savedState.tab;
            navigateToInternal(savedState.view, savedState, false);
          } else {
            if (currentTab === 'text') loadTextFeed();
            else loadImageFeed();
          }
        } else {
          stopHeartbeat();
          try { stopNotifListener(); } catch(e) {}
          window._isSiteAdmin = false;
          try { refreshAdminTile(); } catch (e) {}
          if (currentUserId) {
            try { await db.ref('status/' + currentUserId).update({ state: 'offline', lastSeen: firebase.database.ServerValue.TIMESTAMP }); } catch(e) {}
          }
          document.getElementById('home-page-ui').classList.remove('show-home');
          document.getElementById('auth-container').classList.add('show-auth');
          document.getElementById('box-login').classList.add('hidden');
          document.getElementById('box-signup-nick').classList.remove('hidden');
          document.getElementById('footer-ui').classList.remove('hidden');
          const toggleBtn = document.getElementById('toggle-btn');
          if (toggleBtn) toggleBtn.innerText = t('existingAccount');
          NavigationHistory.clear();
          setTimeout(translateAuthPage, 300);
        }
      });
    }
  }, 100);
});

async function cleanOldPosts() {
  const { db } = getFirebase();
  if (!db) return;
  if (window._cleanupDone) return;
  window._cleanupDone = true;
  /* H3: run at most once per 24h per device (was: on every login, a 150-post read each time) */
  try {
    const __lastCleanup = parseInt(localStorage.getItem('dm_cleanup_last') || '0', 10);
    if (Date.now() - __lastCleanup < 86400000) return;
  } catch (e) {}
  try {
    const now = Date.now();
    const snap = await db.ref('posts').orderByChild('expiryTime').limitToLast(150).once('value');
    const toDelete = {};
    let expiredCount = 0;
    
    snap.forEach(function(c) {
      const p = c.val();
      const postId = c.key;
      
      if (p.expiryTime && p.expiryTime > 0 && now > p.expiryTime) {
        toDelete['posts/' + postId] = null;
        expiredCount++;
      }
    });
    
    /* H3: posts with no expiryTime ("Never expire") are NEVER deleted here. */
    if (Object.keys(toDelete).length > 0) {
      await db.ref().update(toDelete);
      console.log('Cleaned up ' + expiredCount + ' expired posts');
    }
    try { localStorage.setItem('dm_cleanup_last', String(Date.now())); } catch (e) {}
    
  } catch(e) {
    console.error('Cleanup error:', e);
  }
}


/* ===== v147 block (orig theme lines 10592-10600) ===== */
/* ===== PATCH 11: Cache Cleanup Force Start (moved inside body) ===== */
if (typeof startBloggerCacheCleanup === 'function') {
  startBloggerCacheCleanup();
  console.log('Cache cleanup started');
} else {
  console.log('Cache cleanup function not found');
}