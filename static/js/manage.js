// ══ Manage State ════════════════════════════════════════════════════════════
let vPage = 1, tPage = 1;
let deleteCb = null;
let allTopics = [];
let sPage = 1; // thêm dòng này

async function loadAllTopics() {
  allTopics = await api('/api/topics/all');
  const selIds = ['vqTopic', 'tqTopic', 'sqTopic', 'mvTopic', 'msTopic', 'lbTopic', 'mvTSel', 'msTSel', 'wrTopic'];
  selIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isFilter = ['vqTopic', 'tqTopic', 'sqTopic', 'mvTopic', 'msTopic', 'lbTopic'].includes(id);
    const cur = el.value;
    el.innerHTML = isFilter ? '<option value="">Tất cả chủ đề</option>' : '<option value="">-- Chọn chủ đề --</option>';
    allTopics.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id;
      const suffix = t.scope === 'private' ? ' (của tôi)' : '';
      o.textContent = t.name + suffix;
      el.appendChild(o);
    });
    if (cur) el.value = cur;
  });
}

// ── Vocab list ──────────────────────────────────────────────────────────────
async function loadVList(page = 1) {
  vPage = page;
  const tid = document.getElementById('mvTopic').value;
  const scope = document.getElementById('mvScope').value;
  const search = document.getElementById('mvSearch').value.trim();
  const params = new URLSearchParams({ page, ...(tid && { topic_id: tid }), ...(search && { search }) });
  const data = await api('/api/vocabulary?' + params);
  const items = scope ? data.items.filter(v => v.scope === scope) : data.items;
  const cont = document.getElementById('vList');
  if (!items.length) { cont.innerHTML = emptyHtml('Chưa có từ vựng nào.'); document.getElementById('vPager').innerHTML = ''; return; }
  cont.innerHTML = items.map(v => `
    <div class="vitem">
      <div class="vhz">${v.hanzi}</div>
      <div class="vdetail">
        <span class="vtag ${v.scope}">${v.scope === 'public' ? '🌐 Công khai' : '🔒 Của tôi'}</span>
        ${topicTagHtml(v.topic_name)}
        <div class="vpinyin">${v.pinyin}</div>
        <div class="vviet">${v.vietnamese}</div>
        ${v.example_sentence ? `<div class="vex">
          <div class="vex-hz">${v.example_sentence}</div>
          <div class="vex-py">${v.example_pinyin || ''}</div>
          <div class="vex-vn">${v.example_vietnamese || ''}</div>
        </div>` : ''}
      </div>
      ${canEdit(v) ? `<div class="vactions">
        <button class="btn-icon" onclick='openVModal(${JSON.stringify(v)})'>✏️</button>
        <button class="btn-icon del" onclick="confirmDel('vocab',${v.id})">🗑️</button>
      </div>` : ''}
    </div>
  `).join('');
  document.getElementById('vPager').innerHTML = pagerHtml(page, data.total, 20, 'loadVList');
}

// ── Sentence list ───────────────────────────────────────────────────────────
async function loadSList(page = 1) {
  sPage = page;
  const tid = document.getElementById('msTopic').value;
  const params = new URLSearchParams({ page, per_page: 20 });
  if (tid) params.set('topic_id', tid);
  const data = await api('/api/sentences?' + params);

  // BE trả về array thì wrap lại cho đồng nhất
  const sents = Array.isArray(data) ? data : (data.items || []);
  const total = Array.isArray(data) ? data.length : (data.total || 0);

  const cont = document.getElementById('sList');
  if (!sents.length) { cont.innerHTML = emptyHtml('Chưa có câu luyện tập nào.'); document.getElementById('sPager').innerHTML = ''; return; }
  cont.innerHTML = sents.map(s => `
    <div class="sitem">
      <div class="sitem-d">
        <span class="vtag ${s.scope}">${s.scope === 'public' ? '🌐' : '🔒'}</span>
        ${topicTagHtml(s.topic_name)}
        <div class="sitem-hz">${s.hanzi}</div>
        ${s.pinyin ? `<div style="font-style:italic;font-size:12px;color:var(--c-blue)">${s.pinyin}</div>` : ''}
        <div style="font-size:13px;color:var(--c-ink3);margin-top:4px">${s.vietnamese}</div>
      </div>
      ${canEdit(s) ? `<div class="vactions">
        <button class="btn-icon del" onclick="confirmDel('sent',${s.id})">🗑️</button>
      </div>` : ''}
    </div>
  `).join('');
  document.getElementById('sPager').innerHTML = pagerHtml(sPage, total, 20, 'loadSList');
}

// ── Topic list ──────────────────────────────────────────────────────────────
async function loadTList(page = 1) {
  tPage = page;
  const search = document.getElementById('ttSearch').value.trim();
  const params = new URLSearchParams({ page, ...(search && { search }) });
  const data = await api('/api/topics?' + params);
  const cont = document.getElementById('tList');
  const topics = data.topics || [];
  if (!topics.length) { cont.innerHTML = emptyHtml('Chưa có chủ đề nào.'); document.getElementById('tPager').innerHTML = ''; return; }
  cont.innerHTML = `<div class="tgrid">${topics.map(t => `
    <div class="titem">
      <span class="vtag ${t.scope}" style="margin-bottom:8px">${t.scope === 'public' ? '🌐 Công khai' : '🔒 Của tôi'}</span>
      <div class="tname">${t.name}</div>
      <div class="tdesc">${t.description || 'Không có mô tả'}</div>
      <div class="tstats">
        <span class="tstat">📖 ${t.vocab_count} từ</span>
        <span class="tstat">✍️ ${t.sentence_count} câu</span>
      </div>
      ${canEdit(t) ? `<div class="tacts">
        <button class="btn-icon" onclick='openTModal(${JSON.stringify(t)})'>✏️ Sửa</button>
        <button class="btn-icon del" onclick="confirmDel('topic',${t.id},'${esc(t.name)}')">🗑️ Xóa</button>
      </div>` : ''}
    </div>
  `).join('')}</div>`;
  document.getElementById('tPager').innerHTML = pagerHtml(page, data.total, 20, 'loadTList');
  await loadAllTopics();
}

// ── User list ───────────────────────────────────────────────────────────────
async function loadUList() {
  const users = await api('/api/users');
  const cont = document.getElementById('uList');
  if (!cont) return;
  const today = new Date().toISOString().slice(0, 10);
  cont.innerHTML = users.map(u => {
    let status = 'ok', statusTxt = '✓ Đang hoạt động';
    if (!u.is_active) { status = 'off'; statusTxt = '✗ Bị khóa'; }
    else if (u.active_until && today > u.active_until) { status = 'exp'; statusTxt = '⚠ Hết hạn'; }
    else if (u.active_from && today < u.active_from) { status = 'off'; statusTxt = '⏳ Chưa kích hoạt'; }
    const period = u.active_from || u.active_until
      ? `${u.active_from || 'N/A'} → ${u.active_until || '∞'}`
      : 'Không giới hạn';
    return `<div class="uitem">
      <div class="uavatar ${u.role === 'admin' ? 'admin' : ''}">${u.username[0].toUpperCase()}</div>
      <div class="uinfo">
        <div class="uname">${u.username}</div>
        <div class="umeta">
          <span>📅 ${period}</span>
          <span>🕐 Tạo: ${(u.created_at || '').slice(0, 10)}</span>
        </div>
      </div>
      <span class="ubadge ${u.role}">${u.role === 'admin' ? '👑 Admin' : '👤 User'}</span>
      <span class="ustatus ${status}">${statusTxt}</span>
      <div class="vactions">
        <button class="btn-icon" onclick='openUModal(${JSON.stringify(u)})'>✏️</button>
        ${u.id !== window.CU?.id ? `<button class="btn-icon del" onclick="confirmDel('user',${u.id},'${esc(u.username)}')">🗑️</button>` : '<span style="width:34px"></span>'}
      </div>
    </div>`;
  }).join('');
}

// ══ Modal: Vocab ═════════════════════════════════════════════════════════════
function openVModal(v = null) {
  document.getElementById('mVTit').textContent = v ? 'Sửa từ vựng' : 'Thêm từ vựng';
  document.getElementById('mvId').value = v?.id || '';
  document.getElementById('mvTSel').value = v?.topic_id || '';
  document.getElementById('mvHz').value = v?.hanzi || '';
  document.getElementById('mvPy').value = v?.pinyin || '';
  document.getElementById('mvVn').value = v?.vietnamese || '';
  document.getElementById('mvEhz').value = v?.example_sentence || '';
  document.getElementById('mvEpy').value = v?.example_pinyin || '';
  document.getElementById('mvEvn').value = v?.example_vietnamese || '';
  hideErr('mVErr');
  document.getElementById('mVocab').classList.remove('hidden');
}
async function saveVocab() {
  const id = document.getElementById('mvId').value;
  const payload = {
    topic_id: document.getElementById('mvTSel').value,
    hanzi: document.getElementById('mvHz').value,
    pinyin: document.getElementById('mvPy').value,
    vietnamese: document.getElementById('mvVn').value,
    example_sentence: document.getElementById('mvEhz').value,
    example_pinyin: document.getElementById('mvEpy').value,
    example_vietnamese: document.getElementById('mvEvn').value,
  };
  const res = await api(id ? `/api/vocabulary/${id}` : '/api/vocabulary', id ? 'PUT' : 'POST', payload);
  if (res.success || res.vocabulary) { closeM('mVocab'); loadVList(); resetVQ(); resetTQ(); }
  else showErr('mVErr', res.error || 'Lỗi lưu');
}

// ══ Modal: Sentence ══════════════════════════════════════════════════════════
function openSModal() {
  ['msHz', 'msPy', 'msVn'].forEach(id => document.getElementById(id).value = '');
  hideErr('mSErr');
  document.getElementById('mSent').classList.remove('hidden');
}
async function saveSent() {
  const payload = {
    topic_id: document.getElementById('msTSel').value,
    hanzi: document.getElementById('msHz').value,
    pinyin: document.getElementById('msPy').value,
    vietnamese: document.getElementById('msVn').value,
  };
  const res = await api('/api/sentences', 'POST', payload);
  if (res.success) { closeM('mSent'); loadSList(); resetSQ(); }
  else showErr('mSErr', res.error || 'Lỗi lưu');
}

// ══ Modal: Topic ═════════════════════════════════════════════════════════════
function openTModal(t = null) {
  document.getElementById('mTTit').textContent = t ? 'Sửa chủ đề' : 'Thêm chủ đề';
  document.getElementById('mtId').value = t?.id || '';
  document.getElementById('mtName').value = t?.name || '';
  document.getElementById('mtDesc').value = t?.description || '';
  hideErr('mTErr');
  document.getElementById('mTopic').classList.remove('hidden');
}
async function saveTopic() {
  const id = document.getElementById('mtId').value;
  const name = document.getElementById('mtName').value.trim();
  if (!name) { showErr('mTErr', 'Tên chủ đề không được trống'); return; }
  const res = await api(id ? `/api/topics/${id}` : '/api/topics', id ? 'PUT' : 'POST',
    { name, description: document.getElementById('mtDesc').value.trim() });
  if (res.success || res.topic) { closeM('mTopic'); loadTList(); }
  else showErr('mTErr', res.error || 'Lỗi');
}

// ══ Modal: User ══════════════════════════════════════════════════════════════
function openUModal(u = null) {
  document.getElementById('mUTit').textContent = u ? 'Sửa tài khoản' : 'Tạo tài khoản';
  document.getElementById('muId').value = u?.id || '';
  document.getElementById('muName').value = u?.username || '';
  document.getElementById('muName').disabled = !!u;
  document.getElementById('muPw').value = '';
  document.getElementById('muRole').value = u?.role || 'user';
  document.getElementById('muFrom').value = u?.active_from || '';
  document.getElementById('muUntil').value = u?.active_until || '';
  document.getElementById('muActive').checked = u?.is_active ?? true;
  document.getElementById('muPwHint').style.display = u ? '' : 'none';
  hideErr('mUErr');
  document.getElementById('mUser').classList.remove('hidden');
}
async function saveUser() {
  const id = document.getElementById('muId').value;
  const payload = {
    username: document.getElementById('muName').value.trim(),
    password: document.getElementById('muPw').value,
    role: document.getElementById('muRole').value,
    is_active: document.getElementById('muActive').checked,
    active_from: document.getElementById('muFrom').value || null,
    active_until: document.getElementById('muUntil').value || null,
  };
  const res = await api(id ? `/api/users/${id}` : '/api/users', id ? 'PUT' : 'POST', payload);
  if (res.success || res.user) { closeM('mUser'); loadUList(); }
  else showErr('mUErr', res.error || 'Lỗi');
}

// ══ Delete ════════════════════════════════════════════════════════════════════
function confirmDel(type, id, name = '') {
  const msgs = {
    vocab: 'Bạn có chắc muốn xóa từ vựng này?',
    sent: 'Bạn có chắc muốn xóa câu luyện tập này?',
    topic: `Xóa chủ đề "${name}" sẽ xóa tất cả từ và câu liên quan. Tiếp tục?`,
    user: `Xóa tài khoản "${name}"? Dữ liệu riêng tư sẽ bị xóa vĩnh viễn.`,
  };
  document.getElementById('mConfMsg').textContent = msgs[type] || 'Xác nhận xóa?';
  const urlMap = { vocab: `/api/vocabulary/${id}`, sent: `/api/sentences/${id}`, topic: `/api/topics/${id}`, user: `/api/users/${id}` };
  deleteCb = async () => {
    await api(urlMap[type], 'DELETE');
    closeM('mConfirm');
    if (type === 'vocab') { loadVList(); resetVQ(); resetTQ(); }
    if (type === 'sent') { loadSList(); resetSQ(); }
    if (type === 'topic') { loadTList(); loadVList(); loadSList(); resetVQ(); resetTQ(); resetSQ(); }
    if (type === 'user') { loadUList(); }
  };
  document.getElementById('mConfirm').classList.remove('hidden');
}
function runDel() { if (deleteCb) deleteCb(); deleteCb = null; }

function canEdit(item) {
  if (!window.CU) return false;
  if (window.CU.role === 'admin') return true;
  return item.owner_id === window.CU.id;
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}

// ══ Modal: Import Vocab ═══════════════════════════════════════════════════════
function openImport() {
  // Sync topic select từ allTopics (đã load sẵn)
  const sel = document.getElementById('impTSel');
  sel.innerHTML = '<option value="">-- Chọn chủ đề --</option>';
  allTopics.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name + (t.scope === 'private' ? ' (của tôi)' : '');
    sel.appendChild(o);
  });

  // Reset UI
  document.getElementById('impFile').value = '';
  document.getElementById('impResult').classList.add('hidden');
  document.getElementById('impProgress').classList.add('hidden');
  hideErr('impErr');
  document.getElementById('mImport').classList.remove('hidden');
}

async function doImport() {
  const topicId = document.getElementById('impTSel').value;
  const fileInput = document.getElementById('impFile');
  const file = fileInput.files[0];

  // Validate
  if (!topicId) { showErr('impErr', 'Vui lòng chọn chủ đề'); return; }
  if (!file) { showErr('impErr', 'Vui lòng chọn file Excel'); return; }

  hideErr('impErr');
  document.getElementById('impResult').classList.add('hidden');
  document.getElementById('impProgress').classList.remove('hidden');

  // Gửi form-data (BE dùng request.form + request.files)
  const formData = new FormData();
  formData.append('topic_id', topicId);
  formData.append('file', file);

  try {
    const res = await fetch('/api/vocabulary/import', {
      method: 'POST',
      body: formData   // KHÔNG set Content-Type, browser tự set multipart
    });
    const data = await res.json();
    document.getElementById('impProgress').classList.add('hidden');

    if (data.success) {
      const resultEl = document.getElementById('impResult');
      resultEl.textContent = '✓ ' + data.message;
      resultEl.classList.remove('hidden');
      // Reload danh sách từ vựng
      loadVList();
      resetVQ(); resetTQ();
    } else {
      showErr('impErr', data.error || 'Import thất bại');
    }
  } catch (e) {
    document.getElementById('impProgress').classList.add('hidden');
    showErr('impErr', 'Lỗi kết nối server');
  }
}

// ══ Modal: Import Sentences ═══════════════════════════════════════════════════
function openImportSent() {
  const sel = document.getElementById('impSTSel');
  sel.innerHTML = '<option value="">-- Chọn chủ đề --</option>';
  allTopics.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name + (t.scope === 'private' ? ' (của tôi)' : '');
    sel.appendChild(o);
  });

  document.getElementById('impSFile').value = '';
  document.getElementById('impSResult').classList.add('hidden');
  document.getElementById('impSProgress').classList.add('hidden');
  hideErr('impSErr');
  document.getElementById('mImportSent').classList.remove('hidden');
}

async function doImportSent() {
  const topicId = document.getElementById('impSTSel').value;
  const fileInput = document.getElementById('impSFile');
  const file = fileInput.files[0];

  if (!topicId) { showErr('impSErr', 'Vui lòng chọn chủ đề'); return; }
  if (!file) { showErr('impSErr', 'Vui lòng chọn file Excel'); return; }

  hideErr('impSErr');
  document.getElementById('impSResult').classList.add('hidden');
  document.getElementById('impSProgress').classList.remove('hidden');

  const formData = new FormData();
  formData.append('topic_id', topicId);
  formData.append('file', file);

  try {
    const res = await fetch('/api/sentences/import', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    document.getElementById('impSProgress').classList.add('hidden');

    if (data.success) {
      const resultEl = document.getElementById('impSResult');
      resultEl.textContent = '✓ ' + data.message;
      resultEl.classList.remove('hidden');
      loadSList();
      resetSQ();
    } else {
      showErr('impSErr', data.error || 'Import thất bại');
    }
  } catch (e) {
    document.getElementById('impSProgress').classList.add('hidden');
    showErr('impSErr', 'Lỗi kết nối server');
  }
}