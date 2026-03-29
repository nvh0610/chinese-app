// ══ Quiz State ══════════════════════════════════════════════════════════════
const VQ = { exclude: [], right: 0, wrong: 0, done: 0, total: 0, streak: 0, maxStreak: 0, finished: false };
const TQ = { exclude: [], right: 0, wrong: 0, done: 0, total: 0, streak: 0, maxStreak: 0, finished: false };
const SQ = { exclude: [], right: 0, wrong: 0, done: 0, total: 0, streak: 0, maxStreak: 0, finished: false, answer: [], correct: '', answered: false };
// ── Helpers ──────────────────────────────────────────────────────────────────
function updateScoreUI(mode) {
  const s = { vq: VQ, tq: TQ, sq: SQ }[mode];
  document.getElementById(mode + 'R').textContent = s.right;
  document.getElementById(mode + 'W').textContent = s.wrong;
  document.getElementById(mode + 'Streak').textContent = s.streak;
  document.getElementById(mode + 'Done').textContent = s.done;
  const pct = s.total > 0 ? Math.min(100, Math.round(s.done / s.total * 100)) : 0;
  const bar = document.getElementById(mode + 'Prog');
  if (bar) bar.style.width = pct + '%';
}

function checkFinished(mode) {
  const s = { vq: VQ, tq: TQ, sq: SQ }[mode];
  if (s.total > 0 && s.done >= s.total && !s.finished) {
    s.finished = true;
    // Save score
    const topicId = document.getElementById({ vq: 'vqTopic', tq: 'tqTopic', sq: 'sqTopic' }[mode]).value || null;
    const typeMap = { vq: 'vocab', tq: 'type', sq: 'sent' };
    // api('/api/scores', 'POST', { streak: s.maxStreak, topic_id: topicId, quiz_type: typeMap[mode] });
    setTimeout(() => showResult(mode), 700);
  }
}

function showResult(mode) {
  const s = { vq: VQ, tq: TQ, sq: SQ }[mode];
  const pct = s.done > 0 ? Math.round(s.right / s.done * 100) : 0;
  let icon = '🎉', title = '', msg = '';
  if (pct >= 90) { icon = '🏆'; title = 'Xuất sắc!'; msg = 'Bạn thật tuyệt vời!'; }
  else if (pct >= 70) { icon = '😊'; title = 'Tốt lắm!'; msg = 'Tiếp tục cố gắng nhé!'; }
  else if (pct >= 50) { icon = '💪'; title = 'Khá ổn!'; msg = 'Cần luyện thêm một chút!'; }
  else { icon = '📖'; title = 'Cần ôn thêm!'; msg = 'Hãy xem lại từ vựng!'; }
  document.getElementById('mRIcon').textContent = icon;
  document.getElementById('mRTitle').textContent = title;
  document.getElementById('mRMsg').textContent = msg;
  document.getElementById('mRStats').innerHTML = `
    <span class="chip g">✓ ${s.right} đúng</span>
    <span class="chip r">✗ ${s.wrong} sai</span>
    <span class="chip gray">🔥 Streak ${s.maxStreak}</span>
    <span class="chip gray">${pct}% chính xác</span>
  `;
  const retryFns = { vq: resetVQ, tq: resetTQ, sq: resetSQ };
  document.getElementById('mRRetry').onclick = () => { closeM('mResult'); retryFns[mode](); };
  document.getElementById('mResult').classList.remove('hidden');
}

function resetState(mode) {
  const s = { vq: VQ, tq: TQ, sq: SQ }[mode];
  Object.assign(s, { exclude: [], right: 0, wrong: 0, done: 0, streak: 0, maxStreak: 0, finished: false });
  if (mode === 'sq') { s.answer = []; s.correct = ''; s.answered = false; }
  document.getElementById(mode + 'Total').textContent = '?';
  updateScoreUI(mode);
}

// ══ MCQ Trắc nghiệm ═════════════════════════════════════════════════════════
async function loadVQ() {
  const card = document.getElementById('vqCard');
  card.innerHTML = '<div class="qload">Đang tải...</div>';
  if (VQ.finished) return;
  const tid = document.getElementById('vqTopic').value;
  const params = new URLSearchParams({ exclude: VQ.exclude.join(',') });
  if (tid) params.set('topic_id', tid);
  const q = await api('/api/quiz/vocab?' + params);
  if (q.error) { card.innerHTML = emptyHtml('Không có từ vựng nào.'); return; }
  vqCurrentQ = q;
  VQ.total = q.total;
  document.getElementById('vqTotal').textContent = q.total;
  const [fg, bg] = tagColor(q.topic_name);
  card.innerHTML = `
    <div class="qctr" style="margin-bottom:24px">
      <div class="ql">Nghĩa tiếng Việt</div>
      <div class="qviet">${q.vietnamese} <button class="speak-btn" onclick="speakZH('${esc(q.hanzi)}')" title="Nghe phát âm">🔊</button></div>
      <span class="qtag" style="color:${fg};background:${bg}">${q.topic_name}</span>
      <div id="vqErrBadge" style="min-height:20px"></div>
    </div>
    <div class="opts" id="vqOpts">
      ${q.options.map(o => `
        <button class="opt" onclick="checkVQ(this,${o.correct},'${esc(q.hanzi)}','${esc(q.pinyin)}','${esc(q.example_sentence)}','${esc(q.example_pinyin)}','${esc(q.example_vietnamese)}')">
          <span class="opt-hz">${o.hanzi}</span>
          <span class="opt-py">${o.pinyin}</span>
        </button>`).join('')}
    </div>
    <div id="vqReveal"></div>
    <div class="qacts" id="vqNav" style="display:none">
      <button class="btn-primary" id="vqNextBtn">Câu tiếp →</button>
    </div>
  `;
  loadErrorBadge(q.hanzi, 'vqErrBadge');
  // Bind next button AFTER render
  document.getElementById('vqNextBtn').onclick = () => nextVQ(q.id);
}

function checkVQ(btn, correct, hanzi, pinyin, ex, expy, exvn) {
  document.querySelectorAll('#vqOpts .opt').forEach(b => {
    b.disabled = true;
    if (b.querySelector('.opt-hz').textContent === hanzi) b.classList.add('correct');
  });

  if (correct) {
    VQ.right++; VQ.streak++; VQ.maxStreak = Math.max(VQ.maxStreak, VQ.streak);
    btn.classList.add('correct');
    _saveStreakIfBetter('vq');
  } else {
    VQ.wrong++; VQ.streak = 0;
    btn.classList.add('wrong');
    if (vqCurrentQ) recordError(vqCurrentQ.hanzi, 'vocab');
  }

  VQ.done++;
  updateScoreUI('vq');
  document.getElementById('vqReveal').innerHTML = `<div class="reveal ${correct ? 'ok-rv' : 'bad-rv'}">${revealHtml(correct, hanzi, pinyin, ex, expy, exvn)}</div>`;
  document.getElementById('vqNav').style.display = VQ.done >= VQ.total ? 'none' : 'flex';
  checkFinished('vq');
}

function nextVQ(id) { if (!VQ.exclude.includes(id)) VQ.exclude.push(id); loadVQ(); }
function resetVQ() { resetState('vq'); loadVQ(); }

// ══ Type quiz ═══════════════════════════════════════════════════════════════
async function loadTQ() {
  const card = document.getElementById('tqCard');
  card.innerHTML = '<div class="qload">Đang tải...</div>';
  if (TQ.finished) return;
  const tid = document.getElementById('tqTopic').value;
  const params = new URLSearchParams({ exclude: TQ.exclude.join(',') });
  if (tid) params.set('topic_id', tid);
  const q = await api('/api/quiz/vocab?' + params);
  if (q.error) { card.innerHTML = emptyHtml('Không có từ vựng nào.'); return; }
  tqCurrentQ = q;
  TQ.total = q.total;
  document.getElementById('tqTotal').textContent = q.total;
  const [fg, bg] = tagColor(q.topic_name);
  card.innerHTML = `
    <div class="qctr" style="margin-bottom:20px">
      <div class="ql">Nhập chữ Hán cho nghĩa sau</div>
      <div class="qviet">${q.vietnamese}</div>
      <span class="qtag" style="color:${fg};background:${bg}">${q.topic_name}</span>
    </div>
    <div class="type-wrap">
      <div class="py-toggle">
        <span style="font-size:13px;color:var(--c-blue);font-weight:600">Pinyin:</span>
        <span class="py-val hidden-py" id="tqPyVal">${q.pinyin}</span>
        <button class="eye-btn" id="tqEye" onclick="togglePinyinVis()" title="Hiện/ẩn pinyin">👁</button>
      </div>
      <input type="text" class="hz-input" id="tqInp" placeholder="Gõ chữ Hán vào đây..." />
      <div class="tbtns">
        <button class="btn-primary" id="tqCheckBtn">Kiểm tra ✓</button>
        <button class="btn-ghost" id="tqHintBtn">💡 Gợi ý chữ Hán</button>
      </div>
      <div id="tqReveal"></div>
    </div>
  `;
  const inp = document.getElementById('tqInp');
  document.getElementById('tqCheckBtn').onclick = () => checkTQ(q.hanzi, q.pinyin, q.example_sentence, q.example_pinyin, q.example_vietnamese, q.id);
  document.getElementById('tqHintBtn').onclick = () => { inp.placeholder = q.hanzi[0] + '... (' + q.hanzi.length + ' chữ)'; };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') checkTQ(q.hanzi, q.pinyin, q.example_sentence, q.example_pinyin, q.example_vietnamese, q.id);
  });
}

function togglePinyinVis() {
  const el = document.getElementById('tqPyVal');
  const btn = document.getElementById('tqEye');
  const hidden = el.classList.contains('hidden-py');
  el.classList.toggle('hidden-py', !hidden);
  btn.textContent = hidden ? '🙈' : '👁';
}

function checkTQ(answer, pinyin, ex, expy, exvn, qId) {
  const inp = document.getElementById('tqInp');
  if (!inp || inp.disabled) return;
  const val = inp.value.trim();
  const ok = val === answer;
  inp.classList.add(ok ? 'ok' : 'bad'); inp.disabled = true;
  document.getElementById('tqCheckBtn').disabled = true;
  document.getElementById('tqHintBtn').disabled = true;
  if (ok) {
    TQ.right++; TQ.streak++; TQ.maxStreak = Math.max(TQ.maxStreak, TQ.streak);
    _saveStreakIfBetter('tq');
  } else {
    TQ.wrong++; TQ.streak = 0;
    if (tqCurrentQ) recordError(tqCurrentQ.hanzi, 'type');
  }
  TQ.done++;
  updateScoreUI('tq');
  const showNext = TQ.done < TQ.total;
  document.getElementById('tqReveal').innerHTML = `
    <div class="reveal ${ok ? 'ok-rv' : 'bad-rv'}" style="margin-top:14px">
      ${revealHtml(ok, answer, pinyin, ex, expy, exvn, !ok)}
      ${showNext ? `<div class="qacts"><button class="btn-primary" id="tqNextBtn">Câu tiếp →</button></div>` : ''}
    </div>
  `;
  if (showNext) document.getElementById('tqNextBtn').onclick = () => nextTQ(qId);
  checkFinished('tq');
}

function nextTQ(id) { if (!TQ.exclude.includes(id)) TQ.exclude.push(id); loadTQ(); }
function resetTQ() { resetState('tq'); loadTQ(); }

// ══ Sentence quiz ════════════════════════════════════════════════════════════
let sqMode = 'arrange';
let sqCurrentQ = null; // lưu data câu hiện tại, tránh truyền qua onclick
let vqCurrentQ = null;
let tqCurrentQ = null;

async function loadSQ() {
  const card = document.getElementById('sqCard');
  card.innerHTML = '<div class="qload">Đang tải...</div>';
  SQ.answer = []; SQ.answered = false;
  if (SQ.finished) return;

  const tid = document.getElementById('sqTopic').value;
  const params = new URLSearchParams({ exclude: SQ.exclude.join(',') });
  if (tid) params.set('topic_id', tid);

  const q = await api('/api/quiz/sentence?' + params);
  if (q.error) { card.innerHTML = emptyHtml('Không có câu luyện tập nào.'); return; }

  sqCurrentQ = q; // lưu vào biến global
  SQ.correct = q.hanzi;
  SQ.total = q.total;
  document.getElementById('sqTotal').textContent = q.total;

  card.innerHTML = `
    <div class="qctr" style="margin-bottom:18px">
      <div class="ql">Chế độ luyện tập</div>
      <div class="sq-mode-btns">
        <button class="sq-mode-btn ${sqMode === 'arrange' ? 'active' : ''}" id="sqModeArrange" onclick="setSQMode('arrange')">🔀 Sắp xếp</button>
        <button class="sq-mode-btn ${sqMode === 'type' ? 'active' : ''}"    id="sqModeType"    onclick="setSQMode('type')">⌨️ Tự đánh</button>
      </div>
    </div>

    <div class="qctr" style="margin-bottom:18px">
      <div class="sq-viet">${q.vietnamese}</div>
      <div class="py-toggle" style="display:inline-flex;margin-top:8px">
        <span style="font-size:13px;color:var(--c-blue);font-weight:600">Pinyin:</span>
        <span class="py-val hidden-py" id="sqPyVal">${q.pinyin || 'Không có pinyin'}</span>
        <button class="eye-btn" id="sqEye" onclick="toggleSQPinyin()">👁</button>
      </div>
    </div>

    <div id="sqModeArea"></div>
    <div id="sqReveal"></div>
  `;

  renderSQMode();
}

function setSQMode(mode) {
  sqMode = mode;
  document.querySelectorAll('.sq-mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(mode === 'arrange' ? 'sqModeArrange' : 'sqModeType').classList.add('active');
  SQ.answer = []; SQ.answered = false;
  document.getElementById('sqReveal').innerHTML = '';
  renderSQMode();
}

function renderSQMode() {
  const area = document.getElementById('sqModeArea');
  if (!sqCurrentQ) return;

  if (sqMode === 'arrange') {
    area.innerHTML = `
      <div class="zone-lbl">Câu của bạn</div>
      <div class="drop-zone" id="sqDZ"><span class="dz-ph">Nhấn vào chữ bên dưới...</span></div>
      <div class="zone-lbl">Chữ rời</div>
      <div class="char-pool" id="sqPool">
        ${sqCurrentQ.shuffled.map((ch, i) => `<button class="cchip" id="sqC${i}" onclick="sqPick('${esc(ch)}',${i})">${ch}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn-primary" onclick="checkSQ()">Kiểm tra</button>
        <button class="btn-ghost" onclick="sqClear()">🗑 Xóa</button>
      </div>
    `;
  } else {
    area.innerHTML = `
      <div class="zone-lbl">Nhập câu chữ Hán</div>
      <input type="text" class="hz-input" id="sqTypeInp" placeholder="Gõ câu chữ Hán vào đây..." style="margin-bottom:12px"/>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" id="sqTypeCheckBtn">Kiểm tra</button>
      </div>
    `;
    // Bind sau khi DOM đã render xong
    const inp = document.getElementById('sqTypeInp');
    document.getElementById('sqTypeCheckBtn').onclick = () => checkSQType();
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') checkSQType(); });
    inp.focus();
  }
}

function toggleSQPinyin() {
  const el = document.getElementById('sqPyVal');
  const btn = document.getElementById('sqEye');
  const hidden = el.classList.contains('hidden-py');
  el.classList.toggle('hidden-py', !hidden);
  btn.textContent = hidden ? '🙈' : '👁';
}

// ── Mode 1: Sắp xếp ──────────────────────────────────────────────────────────
function sqPick(ch, idx) {
  if (SQ.answered) return;
  const chip = document.getElementById('sqC' + idx);
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
  if (!SQ.answer.length) { dz.innerHTML = '<span class="dz-ph">Nhấn vào chữ bên dưới...</span>'; return; }
  dz.innerHTML = SQ.answer.map((x, i) => `<button class="cchip placed" onclick="sqRemove(${i})">${x.ch}</button>`).join('');
}

function sqRemove(pos) {
  if (SQ.answered) return;
  const rem = SQ.answer.splice(pos, 1)[0];
  const chip = document.getElementById('sqC' + rem.idx);
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
  document.getElementById('sqDZ').classList.add(ok ? 'ok' : 'bad');
  _finishSQ(ok);
}

// ── Mode 2: Tự đánh ──────────────────────────────────────────────────────────
function checkSQType() {
  const inp = document.getElementById('sqTypeInp');
  if (!inp || inp.disabled) return;
  const val = inp.value.trim();
  const ok = val === SQ.correct;
  inp.classList.add(ok ? 'ok' : 'bad');
  inp.disabled = true;
  document.getElementById('sqTypeCheckBtn').disabled = true;
  _finishSQ(ok);
}

// ── Shared finish ─────────────────────────────────────────────────────────────
function _finishSQ(ok) {
  if (ok) {
    SQ.right++; SQ.streak++; SQ.maxStreak = Math.max(SQ.maxStreak, SQ.streak);
    _saveStreakIfBetter('sq');
  } else {
    SQ.wrong++; SQ.streak = 0;
    if (sqCurrentQ) recordError(sqCurrentQ.hanzi, 'sent');
  }
  SQ.done++;
  updateScoreUI('sq');

  const showNext = SQ.done < SQ.total;
  document.getElementById('sqReveal').innerHTML = `
    <div class="reveal ${ok ? 'ok-rv' : 'bad-rv'}" style="margin-top:14px">
      <div class="rv-label ${ok ? 'ok' : 'bad'}">${ok ? '✓ Đúng rồi!' : '✗ Chưa đúng!'}</div>
      ${!ok ? `<div style="margin-top:6px">Câu đúng: <span class="rv-hz">${SQ.correct}</span></div>` : ''}
      ${showNext ? `<div class="qacts"><button class="btn-primary" id="sqNextBtn">Câu tiếp →</button></div>` : ''}
    </div>
  `;
  if (showNext) document.getElementById('sqNextBtn').onclick = () => loadSQ();
  checkFinished('sq');
}

function resetSQ() { resetState('sq'); sqCurrentQ = null; loadSQ(); }

// Lưu streak ngay khi có streak mới tốt hơn, không cần chờ hết lượt
function _saveStreakIfBetter(mode) {
  const s = { vq: VQ, tq: TQ, sq: SQ }[mode];
  if (s.streak > 0 && s.streak >= s.maxStreak) {
    const topicSelId = { vq: 'vqTopic', tq: 'tqTopic', sq: 'sqTopic' }[mode];
    const typeMap = { vq: 'vocab', tq: 'type', sq: 'sent' };
    const topicId = document.getElementById(topicSelId).value || null;
    api('/api/scores', 'POST', {
      streak: s.streak,
      topic_id: topicId,
      quiz_type: typeMap[mode]
    });
  }
}

// Ghi lỗi khi trả lời sai
function recordError(wordRef, quizType) {
  api('/api/errors', 'POST', { word_ref: wordRef, quiz_type: quizType });
}

// Lấy và hiển thị số lần sai vào element có id errorBadge
async function loadErrorBadge(wordRef, badgeId) {
  const data = await api(`/api/errors/${encodeURIComponent(wordRef)}`);
  const el = document.getElementById(badgeId);
  if (!el) return;
  if (data.total > 0) {
    el.innerHTML = `<span class="error-badge">⚠ Đã sai ${data.total} lần</span>`;
  }
}