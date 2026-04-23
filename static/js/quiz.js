// ══ Quiz State ══════════════════════════════════════════════════════════════
let tqMode = 'read'; // 'read' | 'listen'
let vqMode = 'viet';
const VQ = { exclude: [], right: 0, wrong: 0, done: 0, total: 0, streak: 0, maxStreak: 0, finished: false, answered: false };
const TQ = { exclude: [], right: 0, wrong: 0, done: 0, total: 0, streak: 0, maxStreak: 0, finished: false, answered: false };
const SQ = { exclude: [], right: 0, wrong: 0, done: 0, total: 0, streak: 0, maxStreak: 0, finished: false, answer: [], correct: '', answered: false };

// ══ Quiz History — in-memory, navigate back to done questions in session ═══
const QuizHistory = {
  activeType: null,         // "vq" | "tq" | "sq" | null
  items: [],                // list các câu đã trả lời trong session
  cursor: null,             // null = đang ở live; idx = đang xem câu quá khứ
  currentIsLatest: false,   // true = live state = reveal của items[N-1]; false = câu mới chưa trả lời
  snapshot: null,           // lưu HTML + current-q globals khi vào history view

  resetType(newType) {
    if (this.activeType === newType) return;
    this.activeType = newType;
    this.clear();
  },

  clear() {
    this.items = [];
    this.cursor = null;
    this.currentIsLatest = false;
    this.snapshot = null;
  },

  push(item) {
    item.timestamp = Date.now();
    this.items.push(item);
    this.currentIsLatest = true;
    this.cursor = null;
  },

  // Max cursor value (highest past index user can navigate to)
  _maxBackIdx() {
    return this.currentIsLatest ? this.items.length - 2 : this.items.length - 1;
  },

  canGoBack() {
    if (this.cursor === null) return this._maxBackIdx() >= 0;
    return this.cursor > 0;
  },

  goBack() {
    if (!this.canGoBack()) return;
    if (this.cursor === null) {
      _saveLiveSnapshot();
      this.cursor = this._maxBackIdx();
    } else {
      this.cursor = this.cursor - 1;
    }
    renderHistoryView(this.cursor);
  },

  goForward() {
    // Only meaningful when in history view
    if (this.cursor === null) return;
    const maxIdx = this._maxBackIdx();
    if (this.cursor + 1 <= maxIdx) {
      this.cursor = this.cursor + 1;
      renderHistoryView(this.cursor);
    } else {
      // Exit history view → restore snapshot
      this.cursor = null;
      _restoreLiveSnapshot();
    }
  },
};

// ── Keyboard nav: ← → sau khi trả lời hoặc trong history view ────────────
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const el = document.activeElement;
  if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && !el.disabled) return;

  // Trong history view
  if (QuizHistory.cursor !== null) {
    e.preventDefault();
    if (e.key === 'ArrowLeft') QuizHistory.goBack();
    else QuizHistory.goForward();
    return;
  }

  // Live state, chỉ hoạt động khi đã trả lời
  const type = QuizHistory.activeType;
  const answered = (type === 'vq' && VQ.answered) || (type === 'tq' && TQ.answered) || (type === 'sq' && SQ.answered);
  if (!answered) return;

  e.preventDefault();
  if (e.key === 'ArrowLeft') {
    if (QuizHistory.canGoBack()) QuizHistory.goBack();
  } else {
    // → bấm nút Câu tiếp hiện có (nếu có)
    const nextBtnId = { vq: 'vqNextBtn', tq: 'tqNextBtn', sq: 'sqNextBtn' }[type];
    const btn = nextBtnId ? document.getElementById(nextBtnId) : null;
    if (btn && !btn.disabled) btn.click();
  }
});

// ── Save/restore live card state when navigating back to history ─────────
function _saveLiveSnapshot() {
  const type = QuizHistory.activeType;
  const cardIdMap = { vq: 'vqCard', tq: 'tqCard', sq: 'sqCard' };
  const card = document.getElementById(cardIdMap[type]);
  if (!card) return;
  QuizHistory.snapshot = {
    quizType: type,
    cardHtml: card.innerHTML,
    vqCurrentQ: type === 'vq' ? vqCurrentQ : null,
    tqCurrentQ: type === 'tq' ? tqCurrentQ : null,
    sqCurrentQ: type === 'sq' ? sqCurrentQ : null,
    sqCorrect: type === 'sq' ? SQ.correct : null,
    sqAnswer: type === 'sq' ? [...(SQ.answer || [])] : null,
    sqAnswered: type === 'sq' ? SQ.answered : null,
    vqAnswered: VQ.answered,
    tqAnswered: TQ.answered,
  };
}

function _restoreLiveSnapshot() {
  const snap = QuizHistory.snapshot;
  if (!snap) return;
  const cardIdMap = { vq: 'vqCard', tq: 'tqCard', sq: 'sqCard' };
  const card = document.getElementById(cardIdMap[snap.quizType]);
  if (!card) return;
  card.innerHTML = snap.cardHtml;

  if (snap.quizType === 'vq') {
    vqCurrentQ = snap.vqCurrentQ;
    VQ.answered = snap.vqAnswered;
    const nextBtn = document.getElementById('vqNextBtn');
    if (nextBtn && vqCurrentQ) nextBtn.onclick = () => nextVQ(vqCurrentQ.id);
    const prevBtn = document.getElementById('vqPrevBtn');
    if (prevBtn) prevBtn.onclick = () => QuizHistory.goBack();
  } else if (snap.quizType === 'tq') {
    tqCurrentQ = snap.tqCurrentQ;
    TQ.answered = snap.tqAnswered;
    const nextBtn = document.getElementById('tqNextBtn');
    if (nextBtn && tqCurrentQ) nextBtn.onclick = () => nextTQ(tqCurrentQ.id);
    const prevBtn = document.getElementById('tqPrevBtn');
    if (prevBtn) prevBtn.onclick = () => QuizHistory.goBack();
  } else if (snap.quizType === 'sq') {
    sqCurrentQ = snap.sqCurrentQ;
    SQ.correct = snap.sqCorrect;
    SQ.answer = snap.sqAnswer || [];
    SQ.answered = snap.sqAnswered;
    const nextBtn = document.getElementById('sqNextBtn');
    if (nextBtn) nextBtn.onclick = () => loadSQ();
    const prevBtn = document.getElementById('sqPrevBtn');
    if (prevBtn) prevBtn.onclick = () => QuizHistory.goBack();
  }
  QuizHistory.snapshot = null;
}

// ── History View Mode — render câu đã làm từ payload (read-only) ──────────
function renderHistoryView(idx) {
  const it = QuizHistory.items[idx];
  if (!it) return;
  const cardIdMap = { vq: 'vqCard', tq: 'tqCard', sq: 'sqCard' };
  const card = document.getElementById(cardIdMap[it.quizType]);
  if (!card) return;

  const body =
    it.quizType === 'vq' ? _renderVQHistory(it) :
    it.quizType === 'tq' ? _renderTQHistory(it) :
    it.quizType === 'sq' ? _renderSQHistory(it) : '';

  const total = QuizHistory.items.length;
  const canPrev = QuizHistory.canGoBack();
  const nextLabel = idx < QuizHistory._maxBackIdx() ? 'Câu tiếp →' : 'Quay lại câu hiện tại →';

  card.innerHTML = `
    <div class="qh-banner">
      <span>
        📖 Xem lại câu <strong>${idx + 1}/${total}</strong>
        · ${it.topicName || ''}
        · ${it.result === 'correct' ? '✅ Đúng' : '❌ Sai'}
      </span>
    </div>
    <div class="qh-review">${body}</div>
    <div class="qh-actions">
      <button class="qh-prev-btn" ${canPrev ? '' : 'disabled'} onclick="QuizHistory.goBack()">← Câu trước</button>
      <button class="btn-primary" onclick="QuizHistory.goForward()">${nextLabel}</button>
    </div>
  `;
}

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _renderVQHistory(it) {
  const p = it.payload || {};
  const opts = (p.options || []).map((o, i) => {
    const isChosen = i === p.chosenIdx;
    const isCorrectOpt = i === p.correctIdx;
    let cls = 'qh-opt';
    if (isCorrectOpt) cls += ' qh-opt-correct';
    if (isChosen && !isCorrectOpt) cls += ' qh-opt-wrong';
    const label = p.mode === 'han'
      ? `<strong>${_esc(o.vietnamese)}</strong>`
      : `<strong style="font-size:20px">${_esc(o.hanzi)}</strong> · <span style="color:var(--c-ink3)">${_esc(o.pinyin)}</span>`;
    return `<div class="${cls}">${label}${isChosen ? '<em>Bạn chọn</em>' : ''}</div>`;
  }).join('');

  const head = p.mode === 'han'
    ? `<div class="qh-review-q">${_esc(p.hanzi)}</div><div class="qh-review-sub">${_esc(p.pinyin)}</div>`
    : `<div class="qh-review-q" style="font-size:22px">${_esc(p.vietnamese)}</div>`;

  return head + opts;
}

function _renderTQHistory(it) {
  const p = it.payload || {};
  const correct = p.userInput === p.hanzi;
  const valCls = correct ? 'qh-value-correct' : 'qh-value-wrong';
  return `
    <div class="qh-review-sub">${_esc(p.pinyin)}</div>
    <div class="qh-review-q" style="font-size:20px">${_esc(p.vietnamese)}</div>
    <div class="qh-label">Bạn đã gõ:</div>
    <div class="${valCls}">${_esc(p.userInput) || '(trống)'}</div>
    ${correct ? '' : `<div class="qh-label">Đáp án đúng:</div><div class="qh-value-answer">${_esc(p.hanzi)}</div>`}
  `;
}

function _renderSQHistory(it) {
  const p = it.payload || {};
  const userStr = (p.userOrder || []).join('');
  const correctStr = (p.correctOrder || []).join('');
  const correct = userStr === correctStr;
  const valCls = correct ? 'qh-value-correct' : 'qh-value-wrong';
  return `
    <div class="qh-review-sub">${_esc(p.pinyin)}</div>
    <div class="qh-review-q" style="font-size:20px">${_esc(p.vietnamese)}</div>
    <div class="qh-label">Bạn đã sắp:</div>
    <div class="${valCls}">${_esc(userStr) || '(trống)'}</div>
    ${correct ? '' : `<div class="qh-label">Câu đúng:</div><div class="qh-value-answer">${_esc(correctStr)}</div>`}
  `;
}


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

function setTQMode(mode, btn) {
  tqMode = mode;
  document.querySelectorAll('#tqModeRead, #tqModeListen').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  resetTQ();
}

function setSQModeBar(mode, btn) {
  sqMode = mode;
  document.querySelectorAll('#sqModeArrangeBar,#sqModeTypeBar').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  resetSQ();
}

function setVQMode(mode, btn) {
  vqMode = mode;
  document.querySelectorAll('#vqModeViet,#vqModeHan').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  resetVQ();
}

function toggleVQPinyin() {
  const page = document.getElementById('page-quiz-vocab');
  const btn = document.getElementById('vqPinyinBtn');
  page.classList.toggle('vq-pinyin-off');
  const off = page.classList.contains('vq-pinyin-off');
  btn.textContent = off ? '🙈 Pinyin' : '👁 Pinyin';
  btn.classList.toggle('active', !off);
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
  Object.assign(s, { exclude: [], right: 0, wrong: 0, done: 0, streak: 0, maxStreak: 0, finished: false, answered: false });
  if (mode === 'sq') { s.answer = []; s.correct = ''; }
  document.getElementById(mode + 'Total').textContent = '?';
  updateScoreUI(mode);
  // Clear session history cùng với reset
  if (QuizHistory.activeType === mode) QuizHistory.clear();
}

// ══ MCQ Trắc nghiệm ═════════════════════════════════════════════════════════
async function loadVQ() {
  const card = document.getElementById('vqCard');
  card.innerHTML = '<div class="qload">Đang tải...</div>';
  QuizHistory.resetType('vq');
  if (VQ.finished) return;
  VQ.answered = false;
  QuizHistory.currentIsLatest = false;
  QuizHistory.cursor = null;
  const tid = document.getElementById('vqTopic').value;
  const params = new URLSearchParams({ exclude: VQ.exclude.join(',') });
  if (tid) params.set('topic_id', tid);
  const q = await api('/api/quiz/vocab?' + params);
  if (q.error) { card.innerHTML = emptyHtml('Không có từ vựng nào.'); return; }
  vqCurrentQ = q;
  VQ.total = q.total;
  document.getElementById('vqTotal').textContent = q.total;
  _renderVQCard(q);
}

function _renderVQCard(q) {
  const card = document.getElementById('vqCard');
  const [fg, bg] = tagColor(q.topic_name);
  if (vqMode === 'viet') {
    card.innerHTML = `
      <div class="qctr" style="margin-bottom:24px">
        <div class="ql">Nghĩa tiếng Việt — chọn chữ Hán đúng</div>
        <div class="qviet">${q.vietnamese}</div>
        <div style="margin-top:6px">
          <span class="qtag" style="color:${fg};background:${bg};margin:0">${q.topic_name}</span>
        </div>
        <div id="vqErrBadge" style="min-height:20px;margin-top:4px"></div>
      </div>
      <div class="opts" id="vqOpts">
        ${q.options.map(o => `
          <button class="opt" data-correct="${o.correct}"
            onclick="checkVQ(this,${o.correct},'${esc(q.hanzi)}','${esc(q.pinyin)}','${esc(q.example_sentence)}','${esc(q.example_pinyin)}','${esc(q.example_vietnamese)}')">
            <span class="opt-hz">${o.hanzi}</span>
            <span class="opt-py">${o.pinyin}</span>
          </button>`).join('')}
      </div>
      <div id="vqReveal"></div>
      <div class="qacts" id="vqNav" style="display:none">
        <button class="btn-primary" id="vqNextBtn">Câu tiếp →</button>
      </div>
    `;
  } else {
    card.innerHTML = `
      <div class="qctr" style="margin-bottom:24px">
        <div class="ql">Chữ Hán — chọn nghĩa tiếng Việt đúng</div>
        <div style="font-family:var(--fz);font-size:64px;font-weight:900;color:var(--c-ink);line-height:1;margin-bottom:4px">${q.hanzi}</div>
        <div class="vq-pinyin" style="font-style:italic;color:var(--c-blue);font-size:16px;margin-bottom:6px">${q.pinyin}</div>
        <div style="display:flex;justify-content:center;gap:6px;margin-bottom:4px">
          <span class="qtag" style="color:${fg};background:${bg};margin:0">${q.topic_name}</span>
          ${speakBtn(q.hanzi, 18)}
        </div>
        <div id="vqErrBadge" style="min-height:20px;margin-top:4px"></div>
      </div>
      <div class="opts" id="vqOpts">
        ${q.options.map(o => `
          <button class="opt" data-correct="${o.correct}"
            onclick="checkVQ(this,${o.correct},'${esc(q.hanzi)}','${esc(q.pinyin)}','${esc(q.example_sentence)}','${esc(q.example_pinyin)}','${esc(q.example_vietnamese)}')">
            <span style="font-size:15px;font-weight:600;display:block;padding:4px 0;color:var(--c-ink)">${o.vietnamese}</span>
          </button>`).join('')}
      </div>
      <div id="vqReveal"></div>
      <div class="qacts" id="vqNav" style="display:none">
        <button class="btn-primary" id="vqNextBtn">Câu tiếp →</button>
      </div>
    `;
  }

  loadErrorBadge(q.hanzi, 'vqErrBadge');
  document.getElementById('vqNextBtn').onclick = () => nextVQ(q.id);
}
function checkVQ(btn, correct, hanzi, pinyin, ex, expy, exvn) {
  const opts = Array.from(document.querySelectorAll('#vqOpts .opt'));
  const chosenIdx = opts.indexOf(btn);
  opts.forEach(b => {
    b.disabled = true;
    if (vqMode === 'viet') {
      const hz = b.querySelector('.opt-hz');
      if (hz && hz.textContent === hanzi) b.classList.add('correct');
    } else {
      if (b.dataset.correct === 'true') b.classList.add('correct');
    }
  });

  if (correct) btn.classList.add('correct'); else btn.classList.add('wrong');

  if (correct) {
    VQ.right++; VQ.streak++; VQ.maxStreak = Math.max(VQ.maxStreak, VQ.streak);
    _saveStreakIfBetter('vq');
  } else {
    VQ.wrong++; VQ.streak = 0;
    if (vqCurrentQ) recordError(vqCurrentQ.hanzi, 'vocab');
  }
  VQ.done++;
  updateScoreUI('vq');

  document.getElementById('vqReveal').innerHTML = `<div class="reveal ${correct ? 'ok-rv' : 'bad-rv'}">${revealHtml(correct, hanzi, pinyin, ex, expy, exvn)}</div>`;
  document.getElementById('vqNav').style.display = VQ.done >= VQ.total ? 'none' : 'flex';
  VQ.answered = true;

  if (vqCurrentQ) {
    const correctIdx = vqCurrentQ.options.findIndex(o => o.correct);
    QuizHistory.push({
      quizType: 'vq',
      topicId: vqCurrentQ.topic_id,
      topicName: vqCurrentQ.topic_name,
      questionId: vqCurrentQ.id,
      result: correct ? 'correct' : 'wrong',
      payload: _vqBuildPayload(vqCurrentQ, chosenIdx, correctIdx),
    });
    _injectPrevBtnIntoNav('vqNav');
  }

  checkFinished('vq');
}

function _injectPrevBtnIntoNav(navId) {
  const nav = document.getElementById(navId);
  if (!nav) return;
  if (!QuizHistory.canGoBack()) return;
  if (nav.querySelector('.qh-prev-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'qh-prev-btn';
  btn.textContent = '← Câu trước';
  btn.onclick = () => QuizHistory.goBack();
  nav.insertBefore(btn, nav.firstChild);
}

function _vqBuildPayload(q, chosenIdx, correctIdx) {
  return {
    hanzi: q.hanzi,
    pinyin: q.pinyin,
    vietnamese: q.vietnamese,
    exampleSentence: q.example_sentence,
    examplePinyin: q.example_pinyin,
    exampleVietnamese: q.example_vietnamese,
    options: q.options,
    chosenIdx,
    correctIdx,
    mode: vqMode,
  };
}

function nextVQ(id) { if (!VQ.exclude.includes(id)) VQ.exclude.push(id); loadVQ(); }
function resetVQ() { resetState('vq'); loadVQ(); }

// ══ Type quiz ═══════════════════════════════════════════════════════════════
async function loadTQ() {
  const card = document.getElementById('tqCard');
  card.innerHTML = '<div class="qload">Đang tải...</div>';
  QuizHistory.resetType('tq');
  if (TQ.finished) return;
  TQ.answered = false;
  QuizHistory.currentIsLatest = false;
  QuizHistory.cursor = null;
  const tid = document.getElementById('tqTopic').value;
  const params = new URLSearchParams({ exclude: TQ.exclude.join(',') });
  if (tid) params.set('topic_id', tid);
  const q = await api('/api/quiz/vocab?' + params);
  if (q.error) { card.innerHTML = emptyHtml('Không có từ vựng nào.'); return; }
  tqCurrentQ = q;
  TQ.total = q.total;
  document.getElementById('tqTotal').textContent = q.total;
  _renderTQCard(q);
}

function _renderTQCard(q) {
  const card = document.getElementById('tqCard');
  const [fg, bg] = tagColor(q.topic_name);
  card.innerHTML = `
    <div class="qctr" style="margin-bottom:20px">
      ${tqMode === 'read' ? `
        <div class="ql">Nhập chữ Hán cho nghĩa sau</div>
        <div class="qviet">${q.vietnamese}</div>
        <span class="qtag" style="color:${fg};background:${bg}">${q.topic_name}</span>
      ` : `
        <div class="ql">Nghe rồi gõ chữ Hán</div>
        <div style="display:flex;justify-content:center;gap:10px;margin:14px 0">
          <button class="speak-btn-f" onclick="speakZH('${esc(q.hanzi)}','female')" title="Giọng nữ"
            style="font-size:32px;width:64px;height:64px;border:2px solid var(--c-pink-s);border-radius:var(--r);background:var(--c-pink-s)">🔊</button>
          <button class="speak-btn-m" onclick="speakZH('${esc(q.hanzi)}','male')" title="Giọng nam"
            style="font-size:32px;width:64px;height:64px;border:2px solid var(--c-blue-s);border-radius:var(--r);background:var(--c-blue-s)">🔉</button>
        </div>
        <span class="qtag" style="color:${fg};background:${bg}">${q.topic_name}</span>
        <div style="font-size:12px;color:var(--c-ink3);margin-top:6px">Nhấn loa để nghe, sau đó gõ chữ Hán</div>
      `}
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
    <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
      <button class="speak-btn-f" onclick="speakZH('${esc(q.hanzi)}','female')" title="Giọng nữ">🔊</button>
      <button class="speak-btn-m" onclick="speakZH('${esc(q.hanzi)}','male')"   title="Giọng nam">🔉</button>
    </div>
  `;
  const inp = document.getElementById('tqInp');
  document.getElementById('tqCheckBtn').onclick = () => checkTQ(q.hanzi, q.pinyin, q.example_sentence, q.example_pinyin, q.example_vietnamese, q.id);
  document.getElementById('tqHintBtn').onclick = () => { inp.placeholder = q.hanzi[0] + '... (' + q.hanzi.length + ' chữ)'; };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') checkTQ(q.hanzi, q.pinyin, q.example_sentence, q.example_pinyin, q.example_vietnamese, q.id);
  });
  if (tqMode === 'listen') setTimeout(() => speakZH(q.hanzi, 'female'), 500);
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
      ${showNext ? `<div class="qacts" id="tqNav"><button class="btn-primary" id="tqNextBtn">Câu tiếp →</button></div>` : ''}
    </div>
  `;
  if (showNext) document.getElementById('tqNextBtn').onclick = () => nextTQ(qId);

  TQ.answered = true;

  if (tqCurrentQ) {
    QuizHistory.push({
      quizType: 'tq',
      topicId: tqCurrentQ.topic_id,
      topicName: tqCurrentQ.topic_name,
      questionId: tqCurrentQ.id,
      result: ok ? 'correct' : 'wrong',
      payload: {
        hanzi: tqCurrentQ.hanzi,
        pinyin: tqCurrentQ.pinyin,
        vietnamese: tqCurrentQ.vietnamese,
        exampleSentence: tqCurrentQ.example_sentence,
        examplePinyin: tqCurrentQ.example_pinyin,
        exampleVietnamese: tqCurrentQ.example_vietnamese,
        userInput: val,
        mode: tqMode,
      },
    });
    if (showNext) _injectPrevBtnIntoNav('tqNav');
  }

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
  QuizHistory.resetType('sq');
  SQ.answer = []; SQ.answered = false;
  QuizHistory.currentIsLatest = false;
  QuizHistory.cursor = null;
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
  SQ.answer = []; SQ.answered = false;
  if (document.getElementById('sqReveal')) document.getElementById('sqReveal').innerHTML = '';
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
  _finishSQ(ok, userAns);
}

// ── Mode 2: Tự điền câu ──────────────────────────────────────────────────────────
function checkSQType() {
  const inp = document.getElementById('sqTypeInp');
  if (!inp || inp.disabled) return;
  const val = inp.value.trim();
  const ok = val === SQ.correct;
  inp.classList.add(ok ? 'ok' : 'bad');
  inp.disabled = true;
  document.getElementById('sqTypeCheckBtn').disabled = true;
  SQ.answered = true;
  _finishSQ(ok, val);
}

// ── Shared finish ─────────────────────────────────────────────────────────────
function _finishSQ(ok, userAns) {
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
      ${!ok ? `<div style="margin-top:6px;display:flex;align-items:center;gap:8px">Câu đúng: <span class="rv-hz">${SQ.correct}</span>${speakBtn(SQ.correct, 16)}</div>` : `<div style="display:flex;align-items:center;gap:8px"><span class="rv-hz">${SQ.correct}</span>${speakBtn(SQ.correct, 16)}</div>`}
      ${showNext ? `<div class="qacts" id="sqNav"><button class="btn-primary" id="sqNextBtn">Câu tiếp →</button></div>` : ''}
    </div>
  `;
  if (showNext) document.getElementById('sqNextBtn').onclick = () => loadSQ();

  if (sqCurrentQ) {
    QuizHistory.push({
      quizType: 'sq',
      topicId: sqCurrentQ.topic_id,
      topicName: sqCurrentQ.topic_name,
      questionId: sqCurrentQ.id,
      result: ok ? 'correct' : 'wrong',
      payload: {
        hanziOriginal: sqCurrentQ.hanzi,
        pinyin: sqCurrentQ.pinyin,
        vietnamese: sqCurrentQ.vietnamese,
        userOrder: (userAns || '').split(''),
        correctOrder: (sqCurrentQ.hanzi || '').split(''),
        mode: sqMode,
      },
    });
    if (showNext) _injectPrevBtnIntoNav('sqNav');
  }

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

