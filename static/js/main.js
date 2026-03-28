// ══ App entry point ══════════════════════════════════════════════════════════
window.CU = null;
let sidebarCollapsed = false;

document.addEventListener('DOMContentLoaded', async () => {
  const res = await api('/api/me');
  if (res.user) {
    window.CU = res.user;
    await showApp();
  } else {
    document.getElementById('loginGate').classList.remove('hidden');
  }

  document.getElementById('gP').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('gU').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('gP').focus(); });
});

async function showApp() {
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  // Admin nav
  if (window.CU.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }

  // User chip in sidebar
  const sbUser = document.getElementById('sbUser');
  sbUser.innerHTML = `<span style="font-size:15px">${window.CU.role==='admin'?'👑':'👤'}</span><span class="sb-label" style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis">${window.CU.username}</span>`;

  await loadAllTopics();
  loadVQ(); loadTQ(); loadSQ();
  loadVList(); loadSList(); loadTList();
  loadLB();
  if (window.CU.role === 'admin') loadUList();
}

async function doLogin() {
  const username = document.getElementById('gU').value.trim();
  const password = document.getElementById('gP').value;
  hideErr('gErr');
  const res = await api('/api/login', 'POST', { username, password });
  if (res.success) {
    window.CU = res.user;
    await showApp();
  } else {
    showErr('gErr', res.error);
  }
}

async function doLogout() {
  await api('/api/logout', 'POST');
  window.CU = null;
  location.reload();
}

// ══ Page navigation ══════════════════════════════════════════════════════════
function switchPage(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  btn.classList.add('active');
  if (page === 'leaderboard') loadLB();
  if (page === 'admin') loadUList();
}

// ══ Sidebar toggle ════════════════════════════════════════════════════════════
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  document.getElementById('content').classList.toggle('wide', sidebarCollapsed);
  document.getElementById('sbArrow').style.transform = sidebarCollapsed ? 'rotate(180deg)' : '';
}
