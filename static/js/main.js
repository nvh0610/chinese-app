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

  document.getElementById('gP').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('gU').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('gP').focus(); });
});

async function showApp() {
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  await loadAllTopics();

  // 1. Xử lý quyền Admin (ẩn/hiện các nút admin-only)
  if (window.CU.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }

  // 2. Cập nhật Sidebar (Cho máy tính)
  const sbUser = document.getElementById('sbUser');
  if (sbUser) {
    sbUser.innerHTML = `<span style="font-size:15px">${window.CU.role === 'admin' ? '👑' : '👤'}</span>
                        <span class="sb-label" style="font-size:12px;font-weight:600;">${window.CU.username}</span>`;
  }

  // 3. CẬP NHẬT FLOATING MENU (Cho điện thoại)
  const mNameMobile = document.getElementById('mUserNameMobile');
  const mIconMobile = document.getElementById('mUserIconMobile');

  if (mNameMobile) {
    mNameMobile.textContent = window.CU.username; // Lấy tên thật từ nick (ví dụ: admin)
  }
  if (mIconMobile) {
    mIconMobile.textContent = window.CU.role === 'admin' ? '👑' : '👤'; // Đổi icon theo role
  }

  loadVQ(); // Load trang đầu tiên
}

// 2. Hàm đóng mở menu
function toggleMUserMenu() {
  const menu = document.getElementById('mUserDropdown');
  menu.classList.toggle('hidden');
}

// 3. Tự động đóng menu khi bấm ra ngoài
document.addEventListener('click', (e) => {
  const nav = document.querySelector('.mobile-user-nav');
  const menu = document.getElementById('mUserDropdown');
  if (nav && !nav.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

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
  // 1. Đổi active class cho menu và page (Giữ nguyên code cũ của bạn)
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  btn.classList.add('active');

  // 2. LOGIC LOAD THEO YÊU CẦU (Lazy Load)
  console.log("Đang mở trang:", page);

  switch (page) {
    case 'quiz-vocab':
      loadVQ(); // Load trắc nghiệm
      break;
    case 'quiz-type':
      loadTQ(); // Load Gõ chữ Hán
      break;
    case 'quiz-sent':
      loadSQ(); // Load sắp xếp câu
      break;
    case 'manage':
      loadVList(); // Load kho từ
      loadSList(); // Load câu
      loadTList(); // Load bài
      break;
    case 'writing':
      loadWR(); // Load Luyện viết chữ Hán
      break;
    case 'leaderboard':
      loadLB(); // Load bảng xếp hạng (Bạn đã làm phần này rồi)
      break;
    case 'admin':
      loadUList(); // Load quản lý user
      break;
  }
}
// ══ Sidebar toggle ════════════════════════════════════════════════════════════
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  document.getElementById('content').classList.toggle('wide', sidebarCollapsed);
  document.getElementById('sbArrow').style.transform = sidebarCollapsed ? 'rotate(180deg)' : '';
}

function openRegister() {
  ['regUser', 'regPw', 'regPw2'].forEach(id => document.getElementById(id).value = '');
  hideErr('regErr');
  document.getElementById('mRegister').classList.remove('hidden');
}

async function doRegister() {
  const username = document.getElementById('regUser').value.trim();
  const pw = document.getElementById('regPw').value;
  const pw2 = document.getElementById('regPw2').value;

  if (!username || !pw) { showErr('regErr', 'Vui lòng điền đầy đủ'); return; }
  if (pw !== pw2) { showErr('regErr', 'Mật khẩu không khớp'); return; }
  if (pw.length < 6) { showErr('regErr', 'Mật khẩu tối thiểu 6 ký tự'); return; }

  const res = await api('/api/register', 'POST', { username, password: pw });
  if (res.success) {
    closeM('mRegister');
    // Tự động login sau khi đăng ký
    const loginRes = await api('/api/login', 'POST', { username, password: pw });
    if (loginRes.success) {
      window.CU = loginRes.user;
      await showApp();
    }
  } else {
    showErr('regErr', res.error || 'Lỗi đăng ký');
  }
}