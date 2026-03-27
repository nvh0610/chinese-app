// ═══ State ══════════════════════════════════════════════════════════════════
let CU = null; // current user
let topics = [];
let deleteCb = null;

// Quiz states
const VQ = { exclude:[], right:0, wrong:0, done:0, total:0, pinyin:'', pinyinVisible:false };
const TQ = { exclude:[], right:0, wrong:0, done:0, total:0 };
const SQ = { exclude:[], right:0, wrong:0, done:0, total:0, answer:[], correct:'', answered:false };

// ═══ Init ════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const res = await api('/api/me');
  if (res.user) {
    CU = res.user;
    showApp();
  } else {
    document.getElementById('loginGate').classList.remove('hidden');
  }

  document.getElementById('gatePw').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('gateUser').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('gatePw').focus();
  });
});

async function showApp() {
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  // Show admin nav
  if (CU.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }

  // User chip
  const chip = document.getElementById('userChip');
  chip.textContent = (CU.role === 'admin' ? '👑 ' : '👤 ') + CU.username;

  await loadTopics();
  loadVQ();
  loadTQ();
  loadSQ();
  loadVList();
  loadSList();
  loadTList();
  if (CU.role === 'admin') loadUserList();
}

// ═══ Auth ════════════════════════════════════════════════════════════════════
async function doLogin() {
  const username = document.getElementById('gateUser').value.trim();
  const password = document.getElementById('gatePw').value;
  const errEl = document.getElementById('gateError');
  errEl.classList.add('hidden');

  const res = await api('/api/login', 'POST', { username, password });
  if (res.success) {
    CU = res.user;
    showApp();
  } else {
    errEl.textContent = res.error;
    errEl.classList.remove('hidden');
  }
}

async function doLogout() {
  await api('/api/logout', 'POST');
  CU = null;
  location.reload();
}

// ═══ Navigation ══════════════════════════════════════════════════════════════
function switchPage(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  btn.classList.add('active');
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}

// ═══ Topics ══════════════════════════════════════════════════════════════════
async function loadTopics() {
  topics = await api('/api/topics');
  const selIds = ['vqTopic','tqTopic','sqTopic','mvTopic','msTopic','mvTSel','msTSel'];
  selIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isFilter = ['vqTopic','tqTopic','sqTopic','mvTopic','msTopic'].includes(id);
    const cur = el.value;
    el.innerHTML = isFilter ? '<option value="">Tất cả chủ đề</option>' : '<option value="">-- Chọn chủ đề --</option>';
    topics.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id;
      const scope = t.scope === 'private' ? ' (của tôi)' : '';
      o.textContent = t.name + scope;
      el.appendChild(o);
    });
    if (cur) el.value = cur;
  });
}

// ═══ QUIZ: Trắc nghiệm MCQ ═══════════════════════════════════════════════════
async function loadVQ() {
  const card = document.getElementById('vqCard');
  card.innerHTML = '<div class="qload">Đang tải câu hỏi...</div>';
  const tid = document.getElementById('vqTopic').value;
  const params = buildParams({ topic_id: tid, exclude: VQ.exclude.join(',') });
  const q = await api('/api/quiz/vocab?' + params);
  if (q.error) { card.innerHTML = emptyHtml('Không có từ vựng nào. Hãy thêm từ trong Kho từ.'); return; }

  VQ.total = q.total;
  document.getElementById('vqTotal').textContent = q.total;
  updateProgress('vq');

  card.innerHTML = `
    <div class="q-center">
      <div class="q-label">Nghĩa tiếng Việt</div>
      <div class="q-viet">${q.vietnamese}</div>
      <span class="q-topic-tag">${q.topic_name}</span>
    </div>
    <div class="opts" id="vqOpts">
      ${q.options.map((o,i) => `
        <button class="opt" onclick="checkVQ(this,${o.correct},'${esc(q.hanzi)}','${esc(q.pinyin)}','${esc(q.example_sentence)}','${esc(q.example_pinyin)}','${esc(q.example_vietnamese)}')" >
          <span class="opt-hz">${o.hanzi}</span>
          <span class="opt-py">${o.pinyin}</span>
        </button>`).join('')}
    </div>
    <div id="vqReveal"></div>
    <div class="q-actions" id="vqNav" style="display:none">
      <button class="btn-primary" onclick="nextVQ(${q.id})">Câu tiếp →</button>
    </div>
  `;
}

function checkVQ(btn, correct, hanzi, pinyin, ex, expy, exvn) {
  document.querySelectorAll('#vqOpts .opt').forEach(b => {
    b.disabled = true;
    if (b.querySelector('.opt-hz').textContent === hanzi) b.classList.add('correct');
  });
  if (correct) { btn.classList.add('correct'); VQ.right++; document.getElementById('vqRight').textContent = VQ.right; }
  else         { btn.classList.add('wrong');   VQ.wrong++; document.getElementById('vqWrong').textContent = VQ.wrong; }
  VQ.done++;
  document.getElementById('vqDone').textContent = VQ.done;
  updateProgress('vq');

  document.getElementById('vqReveal').innerHTML = revealHtml(correct, hanzi, pinyin, ex, expy, exvn);
  document.getElementById('vqNav').style.display = 'flex';

  if (VQ.done >= VQ.total && VQ.total > 0) {
    setTimeout(() => showResult('vq'), 600);
  }
}

function nextVQ(id) { if (!VQ.exclude.includes(id)) VQ.exclude.push(id); loadVQ(); }
function resetVQ() { Object.assign(VQ,{exclude:[],right:0,wrong:0,done:0}); syncScores('vq'); loadVQ(); }

// ═══ QUIZ: Tự điền chữ Hán ═══════════════════════════════════════════════════
async function loadTQ() {
  const card = document.getElementById('tqCard');
  card.innerHTML = '<div class="qload">Đang tải...</div>';
  const tid = document.getElementById('tqTopic').value;
  const params = buildParams({ topic_id: tid, exclude: TQ.exclude.join(',') });
  const q = await api('/api/quiz/vocab?' + params);
  if (q.error) { card.innerHTML = emptyHtml('Không có từ vựng nào.'); return; }

  TQ.total = q.total;
  document.getElementById('tqTotal').textContent = q.total;
  updateProgress('tq');

  card.innerHTML = `
    <div class="q-center" style="margin-bottom:20px">
      <div class="q-label">Nhập chữ Hán cho nghĩa sau</div>
      <div class="q-viet">${q.vietnamese}</div>
      <span class="q-topic-tag">${q.topic_name}</span>
    </div>
    <div class="type-wrap">
      <div class="pinyin-toggle">
        <span>Pinyin:</span>
        <span class="pinyin-val" id="tqPy" style="filter:blur(5px);transition:.2s">${q.pinyin}</span>
        <button class="eye-btn" id="tqEyePy" onclick="togglePinyinVis()" title="Hiện/ẩn pinyin">👁</button>
      </div>
      <input type="text" class="hz-input" id="tqInput"
        placeholder="Gõ chữ Hán vào đây..."
        data-answer="${esc(q.hanzi)}" data-id="${q.id}"
      />
      <div class="type-btns">
        <button class="btn-primary" onclick="checkTQ('${esc(q.hanzi)}','${esc(q.pinyin)}','${esc(q.example_sentence)}','${esc(q.example_pinyin)}','${esc(q.example_vietnamese)}',${q.id})">Kiểm tra</button>
        <button class="btn-ghost" onclick="hintTQ('${esc(q.hanzi)}')">💡 Gợi ý chữ Hán</button>
      </div>
      <div id="tqReveal"></div>
    </div>
  `;
  document.getElementById('tqInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkTQ(q.hanzi, q.pinyin, q.example_sentence, q.example_pinyin, q.example_vietnamese, q.id);
  });
}

function togglePinyinVis() {
  const el = document.getElementById('tqPy');
  const btn = document.getElementById('tqEyePy');
  const hidden = el.style.filter !== 'none' && el.style.filter !== '';
  el.style.filter = hidden ? 'none' : 'blur(5px)';
  btn.textContent = hidden ? '🙈' : '👁';
}

function hintTQ(answer) {
  const inp = document.getElementById('tqInput');
  if (inp) inp.placeholder = answer[0] + '...（gợi ý: ' + answer.length + ' chữ）';
}

function checkTQ(answer, pinyin, ex, expy, exvn, qId) {
  const inp = document.getElementById('tqInput');
  const val = inp.value.trim();
  const ok = val === answer;
  inp.classList.remove('ok','bad'); inp.classList.add(ok ? 'ok' : 'bad');
  inp.disabled = true;

  if (ok) { TQ.right++; document.getElementById('tqRight').textContent = TQ.right; }
  else    { TQ.wrong++; document.getElementById('tqWrong').textContent = TQ.wrong; }
  TQ.done++;
  document.getElementById('tqDone').textContent = TQ.done;
  updateProgress('tq');

  document.getElementById('tqReveal').innerHTML = `
    <div class="reveal ${ok ? 'correct-reveal' : 'wrong-reveal'}" style="margin-top:14px">
      ${revealHtml(ok, answer, pinyin, ex, expy, exvn, !ok)}
      <div class="q-actions">
        <button class="btn-primary" onclick="nextTQ(${qId})">Câu tiếp →</button>
      </div>
    </div>
  `;

  if (TQ.done >= TQ.total && TQ.total > 0) {
    setTimeout(() => showResult('tq'), 600);
  }
}

function nextTQ(id) { if (!TQ.exclude.includes(id)) TQ.exclude.push(id); loadTQ(); }
function resetTQ() { Object.assign(TQ,{exclude:[],right:0,wrong:0,done:0}); syncScores('tq'); loadTQ(); }

// ═══ QUIZ: Sắp xếp câu ═══════════════════════════════════════════════════════
async function loadSQ() {
  const card = document.getElementById('sqCard');
  card.innerHTML = '<div class="qload">Đang tải...</div>';
  SQ.answer = []; SQ.answered = false;
  const tid = document.getElementById('sqTopic').value;
  const params = buildParams({ topic_id: tid, exclude: SQ.exclude.join(',') });
  const q = await api('/api/quiz/sentence?' + params);
  if (q.error) { card.innerHTML = emptyHtml('Không có câu nào. Hãy thêm câu trong Kho từ.'); return; }

  SQ.correct = q.hanzi;
  SQ.total = q.total;
  document.getElementById('sqTotal').textContent = q.total;
  updateProgress('sq');

  card.innerHTML = `
    <div class="q-center" style="margin-bottom:20px">
      <div class="q-label">Sắp xếp thành câu đúng</div>
      <div class="sq-viet">${q.vietnamese}</div>
      ${q.pinyin ? `<div style="font-size:13px;color:var(--c-ink3);font-style:italic">${q.pinyin}</div>` : ''}
    </div>
    <div class="sq-zone-label">Câu của bạn</div>
    <div class="drop-zone" id="sqDZ"><span class="dz-ph">Nhấn vào chữ bên dưới để sắp xếp...</span></div>
    <div class="sq-zone-label">Chữ rời</div>
    <div class="char-pool" id="sqPool">
      ${q.shuffled.map((ch,i) => `<button class="cchip" id="sqC${i}" onclick="sqPick('${esc(ch)}',${i})">${ch}</button>`).join('')}
    </div>
    <div id="sqReveal"></div>
    <div style="display:flex;gap:8px;margin-top:12px" id="sqActs">
      <button class="btn-primary" onclick="checkSQ()">Kiểm tra</button>
      <button class="btn-ghost" onclick="sqClear()">Xóa hết</button>
    </div>
  `;
}

function sqPick(ch, idx) {
  if (SQ.answered) return;
  const chip = document.getElementById('sqC'+idx);
  if (!chip) return;
  if (chip.classList.contains('placed')) {
    SQ.answer = SQ.answer.filter(x => x.idx !== idx);
    chip.classList.remove('placed');
  } else {
    SQ.answer.push({ ch, idx });
    chip.classList.add('placed');
  }
  sqRenderDZ();
}

function sqRenderDZ() {
  const dz = document.getElementById('sqDZ');
  if (!dz) return;
  if (!SQ.answer.length) { dz.innerHTML = '<span class="dz-ph">Nhấn vào chữ bên dưới để sắp xếp...</span>'; return; }
  dz.innerHTML = SQ.answer.map((x,i) =>
    `<button class="cchip placed" onclick="sqRemove(${i})">${x.ch}</button>`
  ).join('');
}

function sqRemove(pos) {
  if (SQ.answered) return;
  const rem = SQ.answer.splice(pos, 1)[0];
  const chip = document.getElementById('sqC'+rem.idx);
  if (chip) chip.classList.remove('placed');
  sqRenderDZ();
}

function sqClear() {
  if (SQ.answered) return;
  SQ.answer = [];
  document.querySelectorAll('#sqPool .cchip').forEach(c => c.classList.remove('placed'));
  sqRenderDZ();
}

function checkSQ() {
  if (SQ.answered || !SQ.answer.length) return;
  SQ.answered = true;
  const userAns = SQ.answer.map(x => x.ch).join('');
  const ok = userAns === SQ.correct;
  const dz = document.getElementById('sqDZ');
  dz.classList.add(ok ? 'ok' : 'bad');
  if (ok) { SQ.right++; document.getElementById('sqRight').textContent = SQ.right; }
  else    { SQ.wrong++; document.getElementById('sqWrong').textContent = SQ.wrong; }
  SQ.done++;
  document.getElementById('sqDone').textContent = SQ.done;
  updateProgress('sq');

  document.getElementById('sqReveal').innerHTML = `
    <div class="reveal ${ok ? 'correct-reveal' : 'wrong-reveal'}" style="margin-top:14px">
      <div class="reveal-label ${ok ? 'ok' : 'bad'}">${ok ? '✓ Đúng rồi!' : '✗ Chưa đúng!'}</div>
      ${!ok ? `<div>Câu đúng: <span class="reveal-hz">${SQ.correct}</span></div>` : ''}
    </div>
  `;
  document.getElementById('sqActs').innerHTML = `<button class="btn-primary" onclick="nextSQ()">Câu tiếp →</button>`;

  if (SQ.done >= SQ.total && SQ.total > 0) {
    setTimeout(() => showResult('sq'), 600);
  }
}

function nextSQ() { loadSQ(); }
function resetSQ() { Object.assign(SQ,{exclude:[],right:0,wrong:0,done:0,answer:[],answered:false}); syncScores('sq'); loadSQ(); }

// ═══ Result modal ════════════════════════════════════════════════════════════
function showResult(mode) {
  const map = { vq: VQ, tq: TQ, sq: SQ };
  const s = map[mode];
  const pct = s.done > 0 ? Math.round(s.right / s.done * 100) : 0;
  let icon = '🎉', title = '', msg = '';
  if (pct >= 90)      { icon = '🏆'; title = 'Xuất sắc!'; msg = 'Bạn làm rất tốt!'; }
  else if (pct >= 70) { icon = '😊'; title = 'Tốt lắm!'; msg = 'Hãy tiếp tục luyện tập!'; }
  else if (pct >= 50) { icon = '💪'; title = 'Cố lên!'; msg = 'Cần luyện thêm một chút!'; }
  else                { icon = '📖'; title = 'Cần ôn thêm!'; msg = 'Hãy xem lại từ vựng và thử lại!'; }

  document.getElementById('mResultIcon').textContent = icon;
  document.getElementById('mResultTitle').textContent = title;
  document.getElementById('mResultMsg').textContent = msg;
  document.getElementById('mResultStats').innerHTML = `
    <span class="chip green">✓ ${s.right} đúng</span>
    <span class="chip red">✗ ${s.wrong} sai</span>
    <span class="chip gray">${pct}% chính xác</span>
  `;
  const retryBtn = document.getElementById('mResultRetry');
  retryBtn.onclick = () => { closeM('mResult'); const fns={vq:resetVQ,tq:resetTQ,sq:resetSQ}; fns[mode](); };
  document.getElementById('mResult').classList.remove('hidden');
}

// ═══ Manage: Vocab List ═══════════════════════════════════════════════════════
async function loadVList() {
  const tid = document.getElementById('mvTopic').value;
  const scope = document.getElementById('mvScope').value;
  let url = '/api/vocabulary';
  if (tid) url += '?topic_id=' + tid;
  const vocab = await api(url);
  const filtered = scope ? vocab.filter(v => v.scope === scope) : vocab;
  const container = document.getElementById('vList');
  if (!filtered.length) { container.innerHTML = emptyHtml('Chưa có từ vựng nào.'); return; }
  container.innerHTML = filtered.map(v => `
    <div class="vitem">
      <div class="vhz">${v.hanzi}</div>
      <div class="vdetail">
        <span class="vtag ${v.scope}">${v.scope === 'public' ? '🌐 Công khai' : '🔒 Của tôi'}</span>
        <span class="vtag" style="background:var(--c-bg);color:var(--c-ink3)">🏷️ ${v.topic_name}</span>
        <div class="vpinyin">${v.pinyin}</div>
        <div class="vviet">${v.vietnamese}</div>
        ${v.example_sentence ? `<div class="vex">
          <div class="vex-hz">${v.example_sentence}</div>
          <div class="vex-py">${v.example_pinyin||''}</div>
          <div class="vex-vn">${v.example_vietnamese||''}</div>
        </div>` : ''}
      </div>
      ${canEdit(v) ? `<div class="vactions">
        <button class="btn-icon" onclick='openVModal(${JSON.stringify(v)})'>✏️</button>
        <button class="btn-icon del" onclick="confirmDel('vocab',${v.id})">🗑️</button>
      </div>` : ''}
    </div>
  `).join('');
}

// ═══ Manage: Sentence List ════════════════════════════════════════════════════
async function loadSList() {
  const tid = document.getElementById('msTopic').value;
  let url = '/api/sentences'; if (tid) url += '?topic_id=' + tid;
  const sents = await api(url);
  const container = document.getElementById('sList');
  if (!sents.length) { container.innerHTML = emptyHtml('Chưa có câu luyện tập nào.'); return; }
  container.innerHTML = sents.map(s => `
    <div class="sitem">
      <div class="sitem-detail">
        <span class="vtag ${s.scope}">${s.scope === 'public' ? '🌐 Công khai' : '🔒 Của tôi'}</span>
        <span class="vtag" style="background:var(--c-bg);color:var(--c-ink3)">🏷️ ${s.topic_name}</span>
        <div class="sitem-hz">${s.hanzi}</div>
        ${s.pinyin ? `<div style="font-size:12px;color:var(--c-ink3)">${s.pinyin}</div>` : ''}
        <div style="font-size:13px;color:var(--c-ink3);margin-top:4px">${s.vietnamese}</div>
      </div>
      ${canEdit(s) ? `<div class="vactions">
        <button class="btn-icon del" onclick="confirmDel('sent',${s.id})">🗑️</button>
      </div>` : ''}
    </div>
  `).join('');
}

// ═══ Manage: Topic List ════════════════════════════════════════════════════════
async function loadTList() {
  await loadTopics();
  const container = document.getElementById('tList');
  if (!topics.length) { container.innerHTML = emptyHtml('Chưa có chủ đề nào.'); return; }
  container.innerHTML = `<div class="tgrid">${topics.map(t => `
    <div class="titem">
      <span class="vtag ${t.scope}">${t.scope === 'public' ? '🌐 Công khai' : '🔒 Của tôi'}</span>
      <div class="tname">${t.name}</div>
      <div class="tdesc">${t.description || 'Không có mô tả'}</div>
      <div class="tstats">
        <span class="tstat">📖 ${t.vocab_count} từ</span>
        <span class="tstat">✍️ ${t.sentence_count} câu</span>
      </div>
      ${canEdit(t) ? `<div class="tactions">
        <button class="btn-icon" onclick='openTModal(${JSON.stringify(t)})'>✏️ Sửa</button>
        <button class="btn-icon del" onclick="confirmDel('topic',${t.id},'${esc(t.name)}')">🗑️ Xóa</button>
      </div>` : ''}
    </div>
  `).join('')}</div>`;
}

// ═══ Manage: User List (admin) ════════════════════════════════════════════════
async function loadUserList() {
  const users = await api('/api/users');
  const container = document.getElementById('userList');
  if (!container) return;
  container.innerHTML = users.map(u => `
    <div class="uitem">
      <div class="uavatar ${u.role === 'admin' ? 'admin' : ''}">${u.username[0].toUpperCase()}</div>
      <div class="uinfo">
        <div class="uname">${u.username}</div>
        <div class="urole">Ngày tạo: ${u.created_at ? u.created_at.slice(0,10) : '-'}</div>
      </div>
      <span class="ubadge ${u.role}">${u.role === 'admin' ? '👑 Admin' : '👤 User'}</span>
      <div class="vactions">
        <button class="btn-icon" onclick='openUserModal(${JSON.stringify(u)})'>✏️</button>
        ${u.id !== CU.id ? `<button class="btn-icon del" onclick="confirmDel('user',${u.id},'${esc(u.username)}')">🗑️</button>` : '<span style="width:34px"></span>'}
      </div>
    </div>
  `).join('');
}

// ═══ Modals: Vocab ════════════════════════════════════════════════════════════
function openVModal(v = null) {
  document.getElementById('mVocabTitle').textContent = v ? 'Sửa từ vựng' : 'Thêm từ vựng';
  document.getElementById('mvId').value = v ? v.id : '';
  document.getElementById('mvTSel').value = v ? v.topic_id : '';
  document.getElementById('mvHz').value = v ? v.hanzi : '';
  document.getElementById('mvPy').value = v ? v.pinyin : '';
  document.getElementById('mvVn').value = v ? v.vietnamese : '';
  document.getElementById('mvEhz').value = v ? (v.example_sentence||'') : '';
  document.getElementById('mvEpy').value = v ? (v.example_pinyin||'') : '';
  document.getElementById('mvEvn').value = v ? (v.example_vietnamese||'') : '';
  document.getElementById('mVocabErr').classList.add('hidden');
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
  const url = id ? `/api/vocabulary/${id}` : '/api/vocabulary';
  const method = id ? 'PUT' : 'POST';
  const res = await api(url, method, payload);
  if (res.success || res.vocabulary) {
    closeM('mVocab'); loadVList(); resetVQ(); resetTQ();
  } else {
    showModalErr('mVocabErr', res.error || 'Lỗi lưu từ vựng');
  }
}

// ═══ Modals: Sentence ════════════════════════════════════════════════════════
function openSModal() {
  document.getElementById('msHz').value = '';
  document.getElementById('msPy').value = '';
  document.getElementById('msVn').value = '';
  document.getElementById('mSentErr').classList.add('hidden');
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
  else showModalErr('mSentErr', res.error || 'Lỗi lưu câu');
}

// ═══ Modals: Topic ════════════════════════════════════════════════════════════
function openTModal(t = null) {
  document.getElementById('mTopicTitle').textContent = t ? 'Sửa chủ đề' : 'Thêm chủ đề';
  document.getElementById('mtId').value = t ? t.id : '';
  document.getElementById('mtName').value = t ? t.name : '';
  document.getElementById('mtDesc').value = t ? (t.description||'') : '';
  document.getElementById('mTopicErr').classList.add('hidden');
  document.getElementById('mTopic').classList.remove('hidden');
}

async function saveTopic() {
  const id = document.getElementById('mtId').value;
  const name = document.getElementById('mtName').value.trim();
  if (!name) { showModalErr('mTopicErr','Tên chủ đề không được trống'); return; }
  const url = id ? `/api/topics/${id}` : '/api/topics';
  const method = id ? 'PUT' : 'POST';
  const res = await api(url, method, { name, description: document.getElementById('mtDesc').value.trim() });
  if (res.success || res.topic) { closeM('mTopic'); loadTList(); loadTopics(); }
  else showModalErr('mTopicErr', res.error || 'Lỗi');
}

// ═══ Modals: User ════════════════════════════════════════════════════════════
function openUserModal(u = null) {
  document.getElementById('mUserTitle').textContent = u ? 'Sửa tài khoản' : 'Tạo tài khoản';
  document.getElementById('muId').value = u ? u.id : '';
  document.getElementById('muName').value = u ? u.username : '';
  document.getElementById('muPw').value = '';
  document.getElementById('muRole').value = u ? u.role : 'user';
  document.getElementById('muName').disabled = !!u;
  document.getElementById('muPwHint').style.display = u ? '' : 'none';
  document.getElementById('mUserErr').classList.add('hidden');
  document.getElementById('mUser').classList.remove('hidden');
}

async function saveUser() {
  const id = document.getElementById('muId').value;
  const payload = {
    username: document.getElementById('muName').value.trim(),
    password: document.getElementById('muPw').value,
    role: document.getElementById('muRole').value,
  };
  const url = id ? `/api/users/${id}` : '/api/users';
  const method = id ? 'PUT' : 'POST';
  const res = await api(url, method, payload);
  if (res.success || res.user) { closeM('mUser'); loadUserList(); }
  else showModalErr('mUserErr', res.error || 'Lỗi');
}

// ═══ Delete ═══════════════════════════════════════════════════════════════════
function confirmDel(type, id, name = '') {
  const msgs = {
    vocab: 'Bạn có chắc muốn xóa từ vựng này?',
    sent:  'Bạn có chắc muốn xóa câu luyện tập này?',
    topic: `Xóa chủ đề "${name}" sẽ xóa tất cả từ và câu liên quan. Tiếp tục?`,
    user:  `Xóa tài khoản "${name}"? Toàn bộ dữ liệu riêng tư sẽ bị xóa.`,
  };
  document.getElementById('mConfirmMsg').textContent = msgs[type] || 'Xác nhận xóa?';
  const urls = { vocab:`/api/vocabulary/${id}`, sent:`/api/sentences/${id}`, topic:`/api/topics/${id}`, user:`/api/users/${id}` };
  deleteCb = async () => {
    await api(urls[type], 'DELETE');
    closeM('mConfirm');
    if (type==='vocab') { loadVList(); resetVQ(); resetTQ(); }
    if (type==='sent')  { loadSList(); resetSQ(); }
    if (type==='topic') { loadTList(); loadVList(); loadSList(); resetVQ(); resetTQ(); resetSQ(); }
    if (type==='user')  { loadUserList(); }
  };
  document.getElementById('mConfirm').classList.remove('hidden');
}

function runDelete() { if (deleteCb) deleteCb(); deleteCb = null; }

// ═══ Helpers ══════════════════════════════════════════════════════════════════
function closeM(id) { document.getElementById(id).classList.add('hidden'); }

function canEdit(item) {
  if (!CU) return false;
  if (CU.role === 'admin') return true;
  return item.owner_id === CU.id;
}

function revealHtml(ok, hanzi, pinyin, ex, expy, exvn, showAnswer = true) {
  return `
    <div class="reveal-label ${ok ? 'ok' : 'bad'}">${ok ? '✓ Đúng rồi!' : '✗ Chưa đúng!'}</div>
    ${(!ok && showAnswer) ? `<div style="margin-bottom:4px">Đáp án: <span class="reveal-hz">${hanzi}</span></div>` : ''}
    <div class="reveal-py">${pinyin}</div>
    ${ex ? `<div class="reveal-ex">
      <div class="reveal-ex-hz">${ex}</div>
      <div class="reveal-ex-py">${expy||''}</div>
      <div class="reveal-ex-vn">${exvn||''}</div>
    </div>` : ''}
  `;
}

function emptyHtml(msg) {
  return `<div class="empty"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}

function updateProgress(mode) {
  const map = { vq: VQ, tq: TQ, sq: SQ };
  const s = map[mode];
  const pct = s.total > 0 ? Math.min(100, Math.round(s.done / s.total * 100)) : 0;
  const bar = document.getElementById(mode + 'Progress');
  if (bar) bar.style.width = pct + '%';
}

function syncScores(mode) {
  const s = { vq: VQ, tq: TQ, sq: SQ }[mode];
  const pfx = mode;
  const r = document.getElementById(pfx+'Right'); if(r) r.textContent = s.right;
  const w = document.getElementById(pfx+'Wrong'); if(w) w.textContent = s.wrong;
  const d = document.getElementById(pfx+'Done');  if(d) d.textContent = s.done;
  updateProgress(mode);
}

function buildParams(obj) {
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) if (v !== '' && v !== null && v !== undefined) p.set(k,v);
  return p.toString();
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');
}

function showModalErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  try {
    const res = await fetch(url, opts);
    return await res.json();
  } catch (e) {
    console.error('API error', url, e);
    return { error: 'Lỗi kết nối' };
  }
}

// Close modals on backdrop click
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m && m.id !== 'mConfirm' && m.id !== 'loginGate') closeM(m.id);
  });
});
