# Quiz Session History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm thanh timeline lịch sử in-memory ở đáy màn hình cho phép user xem lại và retry các câu đã làm trong 1 session quiz.

**Architecture:** Frontend-only feature, vanilla JS. Thêm module `QuizHistory` vào `static/js/quiz.js` quản lý state + render. Sửa các hàm `setXXMode/loadXX/checkXX/nextXX` sẵn có để tích hợp. Không đụng backend hay DB.

**Tech Stack:** Vanilla JS (ES2017+), HTML5, CSS3. Không có test framework — verification bằng manual browser testing sau mỗi task.

**Spec:** [docs/superpowers/specs/2026-04-14-quiz-session-history-design.md](../specs/2026-04-14-quiz-session-history-design.md)

---

## File Structure

**Files sửa:**
- `static/js/quiz.js` — thêm module `QuizHistory` (đầu file), sửa 9 hàm sẵn có (`setVQMode`, `setTQMode`, `setSQMode`, `loadVQ`, `loadTQ`, `loadSQ`, `checkVQ`, `checkTQ`, `checkSQ`, `nextVQ`, `nextTQ`, `nextSQ`).
- `templates/index.html` — thêm DOM cho history bar, CSS block.

**Files KHÔNG đụng:** backend, DB, `main.js`, `writing.js`, `manage.js`, `leaderboard.js`, `utils.js`.

**Testing strategy:** Project không có unit test framework. Mỗi task có 1 bước manual verification chạy trên browser với hành động cụ thể và kết quả kỳ vọng. Commit sau mỗi task xanh.

---

## Task 1: Foundation — HTML bar, CSS, QuizHistory module skeleton

**Files:**
- Modify: `templates/index.html` — thêm bar DOM + CSS
- Modify: `static/js/quiz.js:1-7` — thêm module `QuizHistory` ở đầu file

- [ ] **Step 1: Thêm CSS vào `<style>` của `templates/index.html`**

Tìm block `<style>` hiện có trong `index.html`. Nếu có, append CSS sau vào cuối block. Nếu không có, thêm mới trong `<head>`:

```css
/* ==== Quiz History Bar ==== */
.qh-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 54px;
  background: rgba(30,30,40,0.95);
  backdrop-filter: blur(6px);
  border-top: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  z-index: 1000;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
}
.qh-bar.hidden { display: none; }
.qh-bar.qh-collapsed {
  width: auto;
  left: auto;
  right: 12px;
  bottom: 12px;
  height: 36px;
  border-radius: 18px;
  padding: 0 14px;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.15);
}
.qh-bar.qh-collapsed .qh-track,
.qh-bar.qh-collapsed .qh-nav,
.qh-bar.qh-collapsed #qh-counter,
.qh-bar.qh-collapsed #qh-collapse { display: none; }
.qh-bar.qh-collapsed #qh-collapsed-label { display: inline; }
#qh-collapsed-label { display: none; color: #fff; font-size: 13px; }
.qh-nav {
  background: rgba(255,255,255,0.1);
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}
.qh-nav:disabled { opacity: 0.3; cursor: default; }
.qh-nav:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
.qh-track {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  scrollbar-width: thin;
}
.qh-track::-webkit-scrollbar { height: 4px; }
.qh-track::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.qh-dot {
  position: relative;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: transform 0.1s;
}
.qh-dot:hover { transform: scale(1.3); }
.qh-dot.qh-correct { background: #22c55e; }
.qh-dot.qh-wrong { background: #ef4444; }
.qh-dot.qh-retried { border-color: #eab308; }
.qh-dot.qh-active {
  border-color: #fff;
  border-width: 3px;
  box-shadow: 0 0 8px rgba(255,255,255,0.5);
  transform: scale(1.2);
}
.qh-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #1f2937;
  color: #fff;
  font-size: 8px;
  font-weight: bold;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
#qh-counter {
  color: rgba(255,255,255,0.7);
  font-size: 12px;
  min-width: 50px;
  text-align: right;
  flex-shrink: 0;
}
.qh-collapse {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.6);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  flex-shrink: 0;
}
.qh-collapse:hover { color: #fff; }
/* History view banner */
.qh-banner {
  background: rgba(59,130,246,0.15);
  border: 1px solid rgba(59,130,246,0.4);
  color: #93c5fd;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
.qh-banner button {
  background: transparent;
  border: 1px solid rgba(147,197,253,0.5);
  color: #93c5fd;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.qh-retry-btn {
  background: #eab308;
  color: #1f2937;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  margin-right: 8px;
}
body.qh-bar-visible { padding-bottom: 62px; }
@media (max-width: 640px) {
  .qh-bar { height: 44px; padding: 0 8px; }
  .qh-dot { width: 12px; height: 12px; }
  .qh-nav { width: 28px; height: 28px; font-size: 12px; }
  #qh-counter { font-size: 11px; min-width: 40px; }
  body.qh-bar-visible { padding-bottom: 52px; }
}
```

- [ ] **Step 2: Thêm DOM cho history bar vào cuối `<body>` của `templates/index.html`**

Ngay trước thẻ `</body>`:

```html
<div id="quiz-history-bar" class="qh-bar hidden">
  <button id="qh-prev" class="qh-nav" aria-label="Câu trước">◀</button>
  <div id="qh-track"></div>
  <button id="qh-next" class="qh-nav" aria-label="Câu tiếp">▶</button>
  <span id="qh-counter"></span>
  <button id="qh-collapse" class="qh-collapse" aria-label="Thu gọn">×</button>
  <span id="qh-collapsed-label"></span>
</div>
```

- [ ] **Step 3: Thêm module `QuizHistory` vào đầu `static/js/quiz.js`**

Thêm block sau ngay sau dòng `updateScoreUI` (khoảng line 8), **phía trên** `function updateScoreUI`:

```js
// ============================================================
// QuizHistory — session history, in-memory only
// Xem docs/superpowers/specs/2026-04-14-quiz-session-history-design.md
// ============================================================
const QuizHistory = {
  activeType: null,      // "vq" | "tq" | "sq" | null
  items: [],             // HistoryItem[]
  cursor: null,          // index đang xem; null = đang làm câu mới
  MAX_ITEMS: 50,

  _uuid() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  resetType(newType) {
    if (this.activeType === newType) return;
    this.activeType = newType;
    this.items = [];
    this.cursor = null;
    this.render();
  },

  push(item) {
    item.id = this._uuid();
    item.timestamp = Date.now();
    item.retried = false;
    this.items.push(item);
    if (this.items.length > this.MAX_ITEMS) {
      this.items.shift();
    }
    this.render();
  },

  goto(idx) {
    if (idx < 0 || idx >= this.items.length) return;
    this.cursor = idx;
    this.render();
    if (typeof renderHistoryView === 'function') renderHistoryView(idx);
  },

  prev() {
    const cur = this.cursor === null ? this.items.length : this.cursor;
    if (cur - 1 < 0) return;
    this.goto(cur - 1);
  },

  next() {
    if (this.cursor === null) return;
    if (this.cursor + 1 >= this.items.length) {
      this.exitHistoryView();
      return;
    }
    this.goto(this.cursor + 1);
  },

  exitHistoryView() {
    this.cursor = null;
    this.render();
    if (typeof exitHistoryViewUI === 'function') exitHistoryViewUI();
  },

  markRetry(idx, newPayload, newResult) {
    const it = this.items[idx];
    if (!it) return;
    it.payload = newPayload;
    it.result = newResult;
    it.retried = true;
    this.render();
  },

  render() {
    const bar = document.getElementById('quiz-history-bar');
    if (!bar) return;
    const track = document.getElementById('qh-track');
    const counter = document.getElementById('qh-counter');
    const prevBtn = document.getElementById('qh-prev');
    const nextBtn = document.getElementById('qh-next');
    const collapsedLabel = document.getElementById('qh-collapsed-label');

    if (this.items.length === 0) {
      bar.classList.add('hidden');
      document.body.classList.remove('qh-bar-visible');
      return;
    }
    bar.classList.remove('hidden');
    document.body.classList.add('qh-bar-visible');

    // Build dots
    track.innerHTML = '';
    const typeBadge = { vq: 'V', tq: 'T', sq: 'S' };
    this.items.forEach((it, i) => {
      const dot = document.createElement('button');
      dot.className = 'qh-dot qh-' + it.result;
      if (it.retried) dot.classList.add('qh-retried');
      if (this.cursor === i) dot.classList.add('qh-active');
      dot.dataset.idx = i;
      dot.title = `[${(it.quizType || '').toUpperCase()}] ${it.topicName || ''} · ${this._preview(it)}`;
      const badge = document.createElement('span');
      badge.className = 'qh-badge';
      badge.textContent = typeBadge[it.quizType] || '?';
      dot.appendChild(badge);
      dot.addEventListener('click', () => this.goto(i));
      track.appendChild(dot);
    });

    // Counter
    counter.textContent = this.cursor === null
      ? `${this.items.length}`
      : `${this.cursor + 1} / ${this.items.length}`;
    collapsedLabel.textContent = `📋 ${this.items.length}`;

    // Nav buttons
    prevBtn.disabled = this.items.length === 0 || this.cursor === 0;
    nextBtn.disabled = this.cursor === null || this.cursor >= this.items.length - 1;

    // Auto-scroll to active
    if (this.cursor !== null) {
      const active = track.querySelector('.qh-active');
      if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  },

  _preview(it) {
    const p = it.payload || {};
    if (it.quizType === 'vq') return `${p.hanzi || '?'} (${it.result === 'correct' ? '✅' : '❌'})`;
    if (it.quizType === 'tq') return `${p.pinyin || '?'} → ${p.userInput || '?'}`;
    if (it.quizType === 'sq') return `${(p.userOrder || []).join('')}`;
    return '';
  },
};

// Wire bar buttons once DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const prevBtn = document.getElementById('qh-prev');
  const nextBtn = document.getElementById('qh-next');
  const collapseBtn = document.getElementById('qh-collapse');
  const bar = document.getElementById('quiz-history-bar');
  if (prevBtn) prevBtn.addEventListener('click', () => QuizHistory.prev());
  if (nextBtn) nextBtn.addEventListener('click', () => QuizHistory.next());
  if (collapseBtn) collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    bar.classList.toggle('qh-collapsed');
  });
  if (bar) bar.addEventListener('click', (e) => {
    if (bar.classList.contains('qh-collapsed')) bar.classList.remove('qh-collapsed');
  });
});
```

- [ ] **Step 4: Manual verify — bar không hiện khi items rỗng**

1. Chạy server: `python app.py` (hoặc cách chạy hiện tại của project).
2. Mở browser tại quiz page.
3. Mở DevTools Console, gõ: `QuizHistory.items.length` → Expected: `0`.
4. Verify: thanh `#quiz-history-bar` có class `hidden`, không hiển thị.
5. Trong console: `QuizHistory.push({quizType:'vq', topicName:'Test', result:'correct', payload:{hanzi:'你好'}})` → bar xuất hiện với 1 chấm xanh.
6. `QuizHistory.push({quizType:'vq', topicName:'Test', result:'wrong', payload:{hanzi:'谢谢'}})` → thêm chấm đỏ.
7. `QuizHistory.items = []; QuizHistory.render()` → bar ẩn lại.

- [ ] **Step 5: Commit**

```bash
git add templates/index.html static/js/quiz.js
git commit -m "feat(quiz): add history bar UI and QuizHistory module skeleton"
```

---

## Task 2: Session boundary — reset on type change

**Files:**
- Modify: `static/js/quiz.js` — sửa `setVQMode`, `setTQMode`, `setSQMode`

- [ ] **Step 1: Tìm và sửa `setTQMode` (line ~31)**

Thay dòng đầu của function để gọi `resetType`:

```js
function setTQMode(mode, btn) {
  QuizHistory.resetType('tq');
  // ... giữ nguyên phần còn lại
```

- [ ] **Step 2: Sửa `setSQModeBar` (line ~38)** — đây là hàm chọn mode cho SQ

```js
function setSQModeBar(mode, btn) {
  QuizHistory.resetType('sq');
  // ... giữ nguyên
```

- [ ] **Step 3: Sửa `setVQMode` (line ~45)**

```js
function setVQMode(mode, btn) {
  QuizHistory.resetType('vq');
  // ... giữ nguyên
```

- [ ] **Step 4: Manual verify — đổi type thì clear history**

1. Reload page, bấm vào mode trắc nghiệm (VQ).
2. Console: `QuizHistory.push({quizType:'vq', topicName:'T', result:'correct', payload:{hanzi:'A'}})` → bar hiện 1 chấm.
3. Bấm sang mode gõ hán (TQ) trên UI.
4. Verify: `QuizHistory.activeType === 'tq'`, `QuizHistory.items.length === 0`, bar ẩn.
5. Push lại 1 item → bar hiện.
6. Bấm lại VQ → clear.

- [ ] **Step 5: Commit**

```bash
git add static/js/quiz.js
git commit -m "feat(quiz): reset history on quiz type change"
```

---

## Task 3: Push to history on check — VQ, TQ, SQ

**Files:**
- Modify: `static/js/quiz.js` — sửa `checkVQ` (line ~149), `checkTQ` (line ~249), `checkSQ`/`_finishSQ` (line ~428)

- [ ] **Step 1: Đọc `checkVQ` hiện tại để lấy đủ biến trong scope**

Xem `static/js/quiz.js:149-179`. Xác định các biến có sẵn: `btn`, `correct`, `hanzi`, `pinyin`, `ex`, `expy`, `exvn`. Cần truy cập `VQ.currentQ` hoặc tương đương để lấy options + chosenIdx + correctIdx.

- [ ] **Step 2: Trong `loadVQ`, lưu snapshot câu hiện tại vào `VQ.currentQ`**

Tìm chỗ `loadVQ` nhận response từ `/api/quiz/vocab` (line ~90). Sau khi render options, thêm:

```js
VQ.currentQ = {
  hanzi: q.hanzi,
  pinyin: q.pinyin,
  vietnamese: q.vietnamese,
  exampleSentence: q.example_sentence,
  examplePinyin: q.example_pinyin,
  exampleVietnamese: q.example_vietnamese,
  topicId: q.topic_id,
  topicName: q.topic_name,
  questionId: q.id,
  options: q.options,
  correctIdx: q.options.findIndex(o => o.correct),
};
VQ.answered = false;
```

- [ ] **Step 3: Ở cuối `checkVQ`, push vào history**

Tìm cuối `checkVQ`, thêm (trước `return` nếu có):

```js
VQ.answered = true;
const chosenIdx = VQ.currentQ.options.findIndex(o => o.hanzi === hanzi && o.pinyin === pinyin);
const result = correct ? 'correct' : 'wrong';

if (VQ.isRetry) {
  // Retry: update item cũ, không push mới, không save score
  QuizHistory.markRetry(VQ.retryOfIdx, {
    ...VQ.currentQ,
    chosenIdx,
    correctIdx: VQ.currentQ.correctIdx,
  }, result);
  VQ.isRetry = false;
  const idx = VQ.retryOfIdx;
  VQ.retryOfIdx = null;
  setTimeout(() => QuizHistory.goto(idx), 300);
} else {
  QuizHistory.push({
    quizType: 'vq',
    topicId: VQ.currentQ.topicId,
    topicName: VQ.currentQ.topicName,
    questionId: VQ.currentQ.questionId,
    result,
    payload: {
      hanzi: VQ.currentQ.hanzi,
      pinyin: VQ.currentQ.pinyin,
      vietnamese: VQ.currentQ.vietnamese,
      exampleSentence: VQ.currentQ.exampleSentence,
      examplePinyin: VQ.currentQ.examplePinyin,
      exampleVietnamese: VQ.currentQ.exampleVietnamese,
      options: VQ.currentQ.options,
      chosenIdx,
      correctIdx: VQ.currentQ.correctIdx,
    },
  });
}
```

- [ ] **Step 4: Lặp lại cho `loadTQ` — lưu `TQ.currentQ`**

Trong `loadTQ` sau khi fetch, thêm:

```js
TQ.currentQ = {
  hanzi: q.hanzi,
  pinyin: q.pinyin,
  vietnamese: q.vietnamese,
  exampleSentence: q.example_sentence,
  examplePinyin: q.example_pinyin,
  exampleVietnamese: q.example_vietnamese,
  topicId: q.topic_id,
  topicName: q.topic_name,
  questionId: q.id,
};
TQ.answered = false;
```

- [ ] **Step 5: Ở cuối `checkTQ`, push vào history**

Cần xác định `userInput` user đã gõ (thường là `document.getElementById('tq-input').value`). Thêm cuối `checkTQ` trước return:

```js
TQ.answered = true;
const userInput = document.getElementById('tq-input')?.value || '';
const isCorrect = (answer === TQ.currentQ.hanzi);
const result = isCorrect ? 'correct' : 'wrong';

if (TQ.isRetry) {
  QuizHistory.markRetry(TQ.retryOfIdx, {
    ...TQ.currentQ,
    userInput,
  }, result);
  TQ.isRetry = false;
  const idx = TQ.retryOfIdx;
  TQ.retryOfIdx = null;
  setTimeout(() => QuizHistory.goto(idx), 300);
} else {
  QuizHistory.push({
    quizType: 'tq',
    topicId: TQ.currentQ.topicId,
    topicName: TQ.currentQ.topicName,
    questionId: TQ.currentQ.questionId,
    result,
    payload: {
      hanzi: TQ.currentQ.hanzi,
      pinyin: TQ.currentQ.pinyin,
      vietnamese: TQ.currentQ.vietnamese,
      exampleSentence: TQ.currentQ.exampleSentence,
      examplePinyin: TQ.currentQ.examplePinyin,
      exampleVietnamese: TQ.currentQ.exampleVietnamese,
      userInput,
    },
  });
}
```

- [ ] **Step 6: Trong `loadSQ`, lưu `SQ.currentQ` và `SQ.answered=false`**

```js
SQ.currentQ = {
  hanzi: q.hanzi,
  pinyin: q.pinyin,
  vietnamese: q.vietnamese,
  topicId: q.topic_id,
  topicName: q.topic_name,
  questionId: q.id,
  correctOrder: [...q.hanzi],  // câu đúng là chuỗi ký tự
};
SQ.answered = false;
```

- [ ] **Step 7: Cuối `_finishSQ(ok)` (line ~428), push vào history**

```js
SQ.answered = true;
const userOrder = SQ.picked ? SQ.picked.map(p => p.ch) : [];
const result = ok ? 'correct' : 'wrong';

if (SQ.isRetry) {
  QuizHistory.markRetry(SQ.retryOfIdx, {
    ...SQ.currentQ,
    userOrder,
  }, result);
  SQ.isRetry = false;
  const idx = SQ.retryOfIdx;
  SQ.retryOfIdx = null;
  setTimeout(() => QuizHistory.goto(idx), 300);
} else {
  QuizHistory.push({
    quizType: 'sq',
    topicId: SQ.currentQ.topicId,
    topicName: SQ.currentQ.topicName,
    questionId: SQ.currentQ.questionId,
    result,
    payload: {
      hanziOriginal: SQ.currentQ.hanzi,
      pinyin: SQ.currentQ.pinyin,
      vietnamese: SQ.currentQ.vietnamese,
      userOrder,
      correctOrder: SQ.currentQ.correctOrder,
    },
  });
}
```

**Note:** `SQ.picked` là cấu trúc thật của SQ đang dùng để track ký tự user drop. Nếu tên khác (ví dụ `SQ.dropZone`), thay đổi cho phù hợp sau khi đọc code thật.

- [ ] **Step 8: Manual verify**

1. Reload page. Vào mode VQ, topic bất kỳ.
2. Làm 3 câu (ít nhất 1 đúng, 1 sai).
3. Verify: bar hiện 3 chấm màu đúng (xanh/đỏ), counter hiển thị `3`.
4. Console: `QuizHistory.items[0].payload.options.length === 4`, `QuizHistory.items[0].payload.chosenIdx` là số hợp lệ.
5. Chuyển sang mode TQ (bar clear), làm 2 câu, verify push đúng.
6. Chuyển SQ, làm 1 câu, verify push.

- [ ] **Step 9: Commit**

```bash
git add static/js/quiz.js
git commit -m "feat(quiz): push quiz results to history on check (VQ/TQ/SQ)"
```

---

## Task 4: History view mode rendering

**Files:**
- Modify: `static/js/quiz.js` — thêm hàm `renderHistoryView(idx)`, `exitHistoryViewUI()`

- [ ] **Step 1: Xác định container chính của từng mode**

Đọc `index.html` để tìm id container của 3 mode (ví dụ `#vq-area`, `#tq-area`, `#sq-area`). Ghi lại ID chính xác cho bước sau.

- [ ] **Step 2: Thêm hàm `renderHistoryView(idx)` ở cuối `quiz.js`**

```js
// ============================================================
// History View Mode — render câu đã làm từ payload (read-only)
// ============================================================
function renderHistoryView(idx) {
  const it = QuizHistory.items[idx];
  if (!it) return;
  const p = it.payload;

  // Tìm container của mode active, render banner + read-only content
  const modeContainers = { vq: 'vq-area', tq: 'tq-area', sq: 'sq-area' };
  const containerId = modeContainers[it.quizType];
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Không tìm thấy container', containerId);
    return;
  }

  // Save trạng thái hiện tại lần đầu vào history view
  if (!container.dataset.qhSavedHtml) {
    container.dataset.qhSavedHtml = container.innerHTML;
  }

  const banner = `
    <div class="qh-banner">
      <span>📖 Đang xem lại câu ${idx + 1}/${QuizHistory.items.length}
        · <strong>${it.topicName || ''}</strong>
        · ${it.result === 'correct' ? '✅ Đúng' : '❌ Sai'}
        ${it.retried ? ' · 🔄 Đã retry' : ''}
      </span>
      <button onclick="QuizHistory.exitHistoryView()">× Thoát</button>
    </div>
  `;

  let body = '';
  if (it.quizType === 'vq') body = _renderVQHistory(p);
  else if (it.quizType === 'tq') body = _renderTQHistory(p);
  else if (it.quizType === 'sq') body = _renderSQHistory(p);

  const actions = `
    <div style="margin-top:16px; display:flex; gap:8px;">
      <button class="qh-retry-btn" onclick="retryHistoryItem(${idx})">🔄 Thử lại</button>
      <button class="qh-nav" style="width:auto; padding:0 16px;" onclick="QuizHistory.prev()">◀ Trước</button>
      <button class="qh-nav" style="width:auto; padding:0 16px;" onclick="QuizHistory.next()">Sau ▶</button>
    </div>
  `;

  container.innerHTML = banner + body + actions;
}

function exitHistoryViewUI() {
  // Khôi phục các container về trạng thái trước history view (nếu có saved)
  ['vq-area', 'tq-area', 'sq-area'].forEach(id => {
    const c = document.getElementById(id);
    if (c && c.dataset.qhSavedHtml) {
      c.innerHTML = c.dataset.qhSavedHtml;
      delete c.dataset.qhSavedHtml;
    }
  });
}

function _renderVQHistory(p) {
  const opts = (p.options || []).map((o, i) => {
    const isChosen = i === p.chosenIdx;
    const isCorrect = i === p.correctIdx;
    let cls = 'qh-opt';
    if (isCorrect) cls += ' qh-opt-correct';
    if (isChosen && !isCorrect) cls += ' qh-opt-wrong';
    return `<div class="${cls}" style="padding:10px; border:2px solid ${isCorrect?'#22c55e':(isChosen?'#ef4444':'rgba(255,255,255,0.1)')}; border-radius:8px; margin:6px 0;">
      <strong>${o.hanzi}</strong> · ${o.pinyin} · ${o.vietnamese}
      ${isChosen ? ' ← <em>Bạn chọn</em>' : ''}
    </div>`;
  }).join('');
  return `
    <div style="margin:12px 0;">
      <h3 style="font-size:28px; margin:0;">${p.hanzi || ''}</h3>
      <div style="color:rgba(255,255,255,0.7);">${p.pinyin || ''}</div>
    </div>
    ${opts}
  `;
}

function _renderTQHistory(p) {
  const correct = p.userInput === p.hanzi;
  return `
    <div style="margin:12px 0;">
      <div style="font-size:18px; color:rgba(255,255,255,0.7);">${p.pinyin || ''}</div>
      <div style="margin-top:6px;">${p.vietnamese || ''}</div>
      <div style="margin-top:16px;">
        <div style="color:rgba(255,255,255,0.5); font-size:12px;">Bạn đã gõ:</div>
        <div style="font-size:32px; color:${correct?'#22c55e':'#ef4444'};">${p.userInput || '(trống)'}</div>
      </div>
      <div style="margin-top:12px;">
        <div style="color:rgba(255,255,255,0.5); font-size:12px;">Đáp án đúng:</div>
        <div style="font-size:32px; color:#22c55e;">${p.hanzi || ''}</div>
      </div>
    </div>
  `;
}

function _renderSQHistory(p) {
  const userStr = (p.userOrder || []).join('');
  const correctStr = (p.correctOrder || []).join('');
  const correct = userStr === correctStr;
  return `
    <div style="margin:12px 0;">
      <div style="color:rgba(255,255,255,0.7);">${p.pinyin || ''}</div>
      <div>${p.vietnamese || ''}</div>
      <div style="margin-top:16px;">
        <div style="color:rgba(255,255,255,0.5); font-size:12px;">Bạn đã sắp:</div>
        <div style="font-size:28px; color:${correct?'#22c55e':'#ef4444'};">${userStr || '(trống)'}</div>
      </div>
      <div style="margin-top:12px;">
        <div style="color:rgba(255,255,255,0.5); font-size:12px;">Câu đúng:</div>
        <div style="font-size:28px; color:#22c55e;">${correctStr}</div>
      </div>
    </div>
  `;
}
```

**Quan trọng:** Sau khi viết, check lại 3 ID container (`vq-area`, `tq-area`, `sq-area`) có đúng với HTML thực không. Nếu khác, sửa cho khớp.

- [ ] **Step 3: Manual verify**

1. Reload, làm 2 câu VQ.
2. Click chấm đầu tiên trên bar → verify banner xuất hiện + options hiện đúng highlight.
3. Click "× Thoát" → verify về câu đang làm dở.
4. Tương tự TQ, SQ.

- [ ] **Step 4: Commit**

```bash
git add static/js/quiz.js
git commit -m "feat(quiz): render history view mode for VQ/TQ/SQ"
```

---

## Task 5: Navigation — prev/next button logic và exit

**Files:**
- Modify: `static/js/quiz.js` — sửa `nextVQ`, `nextTQ`, `nextSQ`

- [ ] **Step 1: Sửa `nextVQ` (line ~179)**

```js
function nextVQ(id) {
  // Nếu đang ở history view (không phải câu cuối) → next trong history
  if (QuizHistory.cursor !== null) {
    QuizHistory.next();
    return;
  }
  if (!VQ.exclude.includes(id)) VQ.exclude.push(id);
  loadVQ();
}
```

- [ ] **Step 2: Sửa `nextTQ` (line ~277)**

```js
function nextTQ(id) {
  if (QuizHistory.cursor !== null) {
    QuizHistory.next();
    return;
  }
  if (!TQ.exclude.includes(id)) TQ.exclude.push(id);
  loadTQ();
}
```

- [ ] **Step 3: Tìm `nextSQ` hoặc tương đương trong SQ mode**

Nếu có hàm tương tự cho SQ, sửa tương tự. Nếu SQ dùng cơ chế khác (auto-load), thêm check `QuizHistory.cursor !== null` ở chỗ gọi load câu mới.

- [ ] **Step 4: Manual verify**

1. Làm 3 câu VQ.
2. Click chấm đầu (vào history view).
3. Click nút "Sau ▶" trong banner → verify chuyển sang chấm thứ 2.
4. Click "Sau ▶" tiếp → chấm 3.
5. Click "Sau ▶" lần nữa → thoát history view, quay lại câu đang dở (câu mới chưa làm).
6. Click chấm 2, bấm "◀ Trước" → về chấm 1.

- [ ] **Step 5: Commit**

```bash
git add static/js/quiz.js
git commit -m "feat(quiz): wire next/prev buttons to history navigation"
```

---

## Task 6: Keyboard arrow keys

**Files:**
- Modify: `static/js/quiz.js` — thêm keyboard listener trong DOMContentLoaded

- [ ] **Step 1: Thêm `isNavAllowed` và `isCurrentQuestionSubmitted` helper**

Thêm vào cuối `quiz.js`:

```js
function isCurrentQuestionSubmitted() {
  const type = QuizHistory.activeType;
  if (type === 'vq') return !!VQ.answered;
  if (type === 'tq') return !!TQ.answered;
  if (type === 'sq') return !!SQ.answered;
  return false;
}

function isNavAllowed() {
  const el = document.activeElement;
  if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return false;
  if (QuizHistory.cursor === null && !isCurrentQuestionSubmitted()) return false;
  return QuizHistory.items.length > 0;
}
```

- [ ] **Step 2: Thêm keyboard listener trong DOMContentLoaded** (block đã tạo ở Task 1)

Mở rộng handler `DOMContentLoaded` để thêm:

```js
document.addEventListener('keydown', (e) => {
  // Escape: thoát history view
  if (e.key === 'Escape' && QuizHistory.cursor !== null) {
    QuizHistory.exitHistoryView();
    return;
  }
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (!isNavAllowed()) return;
  e.preventDefault();
  if (e.key === 'ArrowLeft') QuizHistory.prev();
  else QuizHistory.next();
});
```

- [ ] **Step 3: Manual verify**

1. Làm 3 câu VQ, ở câu cuối bấm đáp án (đã submit, `VQ.answered=true`).
2. Bấm phím ← → verify về chấm 2 (hoặc câu trước).
3. Bấm → verify tiến.
4. Vào 1 câu history, bấm Esc → thoát.
5. Mở mode TQ, click vào ô input → bấm ← → → verify con trỏ trong input di chuyển, KHÔNG trigger history nav.
6. Ở câu TQ mới (chưa submit), click ra ngoài input → bấm ← → → verify không làm gì (vì `TQ.answered=false`).

- [ ] **Step 4: Commit**

```bash
git add static/js/quiz.js
git commit -m "feat(quiz): add keyboard arrow navigation with focus/submit guards"
```

---

## Task 7: Retry flow

**Files:**
- Modify: `static/js/quiz.js` — thêm `retryHistoryItem(idx)`

- [ ] **Step 1: Thêm hàm `retryHistoryItem` vào cuối `quiz.js`**

```js
function retryHistoryItem(idx) {
  const it = QuizHistory.items[idx];
  if (!it) return;
  const p = it.payload;

  // Thoát history view UI trước (khôi phục container gốc)
  exitHistoryViewUI();
  QuizHistory.cursor = null;
  QuizHistory.render();

  if (it.quizType === 'vq') {
    VQ.isRetry = true;
    VQ.retryOfIdx = idx;
    VQ.answered = false;
    VQ.currentQ = {
      hanzi: p.hanzi, pinyin: p.pinyin, vietnamese: p.vietnamese,
      exampleSentence: p.exampleSentence, examplePinyin: p.examplePinyin,
      exampleVietnamese: p.exampleVietnamese,
      topicId: it.topicId, topicName: it.topicName, questionId: it.questionId,
      options: p.options, correctIdx: p.correctIdx,
    };
    // Re-render câu VQ từ currentQ — tận dụng logic render sẵn có nếu được,
    // hoặc viết lại snippet render options tương tự loadVQ
    _rerenderVQFromCurrent();
  } else if (it.quizType === 'tq') {
    TQ.isRetry = true;
    TQ.retryOfIdx = idx;
    TQ.answered = false;
    TQ.currentQ = {
      hanzi: p.hanzi, pinyin: p.pinyin, vietnamese: p.vietnamese,
      exampleSentence: p.exampleSentence, examplePinyin: p.examplePinyin,
      exampleVietnamese: p.exampleVietnamese,
      topicId: it.topicId, topicName: it.topicName, questionId: it.questionId,
    };
    _rerenderTQFromCurrent();
  } else if (it.quizType === 'sq') {
    SQ.isRetry = true;
    SQ.retryOfIdx = idx;
    SQ.answered = false;
    SQ.currentQ = {
      hanzi: p.hanziOriginal, pinyin: p.pinyin, vietnamese: p.vietnamese,
      topicId: it.topicId, topicName: it.topicName, questionId: it.questionId,
      correctOrder: p.correctOrder,
    };
    _rerenderSQFromCurrent();
  }
}

// Re-render helpers — tái sử dụng DOM logic của load functions
function _rerenderVQFromCurrent() {
  // Build 1 object `q` giả lập API response, gọi lại phần render của loadVQ
  const q = {
    id: VQ.currentQ.questionId,
    hanzi: VQ.currentQ.hanzi,
    pinyin: VQ.currentQ.pinyin,
    vietnamese: VQ.currentQ.vietnamese,
    example_sentence: VQ.currentQ.exampleSentence,
    example_pinyin: VQ.currentQ.examplePinyin,
    example_vietnamese: VQ.currentQ.exampleVietnamese,
    topic_id: VQ.currentQ.topicId,
    topic_name: VQ.currentQ.topicName,
    options: VQ.currentQ.options,
  };
  // Gọi hàm render nội bộ của VQ. Nếu loadVQ không tách render riêng,
  // copy phần render options từ loadVQ vào đây (phần sau fetch).
  _renderVQFromData(q);
}

function _rerenderTQFromCurrent() {
  const q = {
    id: TQ.currentQ.questionId,
    hanzi: TQ.currentQ.hanzi,
    pinyin: TQ.currentQ.pinyin,
    vietnamese: TQ.currentQ.vietnamese,
    example_sentence: TQ.currentQ.exampleSentence,
    example_pinyin: TQ.currentQ.examplePinyin,
    example_vietnamese: TQ.currentQ.exampleVietnamese,
    topic_id: TQ.currentQ.topicId,
    topic_name: TQ.currentQ.topicName,
  };
  _renderTQFromData(q);
}

function _rerenderSQFromCurrent() {
  const q = {
    id: SQ.currentQ.questionId,
    hanzi: SQ.currentQ.hanzi,
    pinyin: SQ.currentQ.pinyin,
    vietnamese: SQ.currentQ.vietnamese,
    topic_id: SQ.currentQ.topicId,
    topic_name: SQ.currentQ.topicName,
  };
  _renderSQFromData(q);
}
```

- [ ] **Step 2: Tách logic render của `loadVQ/loadTQ/loadSQ` thành hàm riêng**

Đây là bước refactor nhỏ nhưng quan trọng. Với mỗi load function:

**Ví dụ `loadVQ`:**

```js
async function loadVQ() {
  // ... phần build params + fetch giữ nguyên
  const q = await api('/api/quiz/vocab?' + params);
  if (q.error) { /* handle */ return; }
  _renderVQFromData(q);
}

function _renderVQFromData(q) {
  // Copy toàn bộ phần sau fetch của loadVQ cũ vào đây
  // (phần set innerHTML, bind click, v.v.)
  VQ.currentQ = {
    hanzi: q.hanzi, pinyin: q.pinyin, vietnamese: q.vietnamese,
    exampleSentence: q.example_sentence, examplePinyin: q.example_pinyin,
    exampleVietnamese: q.example_vietnamese,
    topicId: q.topic_id, topicName: q.topic_name, questionId: q.id,
    options: q.options,
    correctIdx: q.options.findIndex(o => o.correct),
  };
  VQ.answered = false;
  // ... phần render DOM cũ
}
```

Làm tương tự cho `loadTQ` → `_renderTQFromData(q)`, `loadSQ` → `_renderSQFromData(q)`.

**Note:** Nếu phần render trong load function ngắn, có thể chỉ inline vào `_renderXXFromData` mà không cần giữ lại trong load. Nếu dài và có side-effects (reset timer, v.v.), giữ lại trong load gọi xuống render.

- [ ] **Step 3: Disable nút "Thử lại" khi đang trong retry**

Trong `renderHistoryView`, kiểm tra nếu bất kỳ mode nào có `isRetry === true`, disable nút:

```js
const canRetry = !(VQ.isRetry || TQ.isRetry || SQ.isRetry);
const actions = `
  <div style="margin-top:16px; display:flex; gap:8px;">
    <button class="qh-retry-btn" ${canRetry ? '' : 'disabled'} onclick="retryHistoryItem(${idx})">🔄 Thử lại</button>
    ...
  </div>
`;
```

- [ ] **Step 4: Manual verify**

1. Làm 1 câu VQ đúng.
2. Click chấm → vào history view → click "🔄 Thử lại".
3. Verify: quay về UI câu đó nhưng options unselected, có thể click lại.
4. Click 1 option sai → verify chấm chuyển màu đỏ, viền vàng (retried), không tạo chấm mới.
5. Verify score/streak không tăng: mở console, kiểm tra `VQ.streak` không đổi so với trước retry.
6. Làm tương tự TQ, SQ.
7. Verify: sau retry (đúng/sai), items vẫn đúng 1 chấm, retried=true.

- [ ] **Step 5: Commit**

```bash
git add static/js/quiz.js
git commit -m "feat(quiz): add retry flow with no score impact"
```

---

## Task 8: Full end-to-end manual verification

- [ ] **Step 1: Test case 1 — Đổi type clear history**

1. Mode VQ, làm 3 câu → bar có 3 chấm.
2. Bấm mode TQ → bar clear, `items.length===0`.
3. Làm 2 câu TQ → bar có 2 chấm.
4. Bấm lại VQ → bar clear.

- [ ] **Step 2: Test case 2 — Đổi topic giữ history + badge**

1. Mode VQ, topic "Gia đình", làm 2 câu.
2. Đổi topic sang "Du lịch" (không đổi mode), làm 2 câu.
3. Verify: bar có 4 chấm, `items[0].topicName === 'Gia đình'`, `items[2].topicName === 'Du lịch'`.
4. Hover chấm 1 → tooltip có "Gia đình", chấm 3 có "Du lịch".

- [ ] **Step 3: Test case 3 — Retry không ảnh hưởng score**

1. Mode VQ, làm 5 câu đúng liên tục → streak = 5 (check trên UI).
2. Click chấm 1 → retry → làm sai.
3. Verify: streak vẫn = 5, không giảm. Chấm 1 màu đỏ viền vàng, các chấm khác nguyên.

- [ ] **Step 4: Test case 4 — Phím mũi tên với focus input**

1. Mode TQ, câu mới (chưa answered).
2. Click vào input, gõ 1 ký tự hán, dùng ← → → verify con trỏ di chuyển trong input, bar không nav.
3. Check input, submit câu → VQ.answered=true.
4. Click ra ngoài input, bấm ← → verify bar nav hoạt động.

- [ ] **Step 5: Test case 5 — Cap 50 câu**

1. Mode VQ, console: `for(let i=0;i<60;i++) QuizHistory.push({quizType:'vq', topicName:'T', result:'correct', payload:{hanzi:'测试'}})`.
2. Verify `QuizHistory.items.length === 50`.
3. Verify chấm đầu tiên là item thứ 11 (10 đã bị shift ra).

- [ ] **Step 6: Test case 6 — Reload mất hết**

1. Làm 3 câu → bar có 3 chấm.
2. F5 reload.
3. Verify: bar ẩn, `QuizHistory.items.length === 0`.

- [ ] **Step 7: Test case 7 — Collapse/expand**

1. Có ≥1 chấm → click `×` trên bar.
2. Verify: bar thu thành icon nhỏ `📋 N` ở góc phải dưới.
3. Click icon → bar mở lại full.

- [ ] **Step 8: Test case 8 — Escape thoát history**

1. Làm 3 câu, click chấm 1 → history view.
2. Bấm Esc → verify về câu đang làm dở.

- [ ] **Step 9: Nếu bất kỳ test case nào fail**, quay lại task tương ứng fix. Nếu tất cả pass → commit "test" note.

```bash
git commit --allow-empty -m "test(quiz): end-to-end history verification passed"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Data model → Task 1, 3
- ✅ Session boundary (reset on type) → Task 2
- ✅ Keep history on topic change → Task 8 test case 2
- ✅ Cap 50 → Task 1 `MAX_ITEMS`, Task 8 test case 5
- ✅ Timeline UI với dot → Task 1
- ✅ Click/prev/next/keyboard → Task 4, 5, 6
- ✅ History view mode → Task 4
- ✅ Retry flow không điểm → Task 7
- ✅ Esc thoát → Task 6
- ✅ Collapse → Task 1, Task 8 test case 7
- ✅ Tất cả 12 test cases → Task 8

**Rủi ro đã lường trong spec:**
- `quiz.js` lớn → module `QuizHistory` có comment block phân cách rõ.
- State flags mới (`answered`, `isRetry`, `retryOfIdx`) reset trong load + check functions.
- SQ history view render phức tạp → tách hàm riêng `_renderSQHistory` không đụng state SQ.

**Có thể cần điều chỉnh khi implement:**
- Tên ID container thật của 3 mode (`vq-area`, `tq-area`, `sq-area`) — verify ở Task 4 Step 1.
- Tên field trong `SQ.picked` — verify ở Task 3 Step 7.
- `checkTQ` lấy `userInput` từ đâu — verify ở Task 3 Step 5.
- Phần render của `loadVQ/loadTQ/loadSQ` có thể có side-effect khi tách — cẩn thận ở Task 7 Step 2.
