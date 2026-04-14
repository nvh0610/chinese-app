# Quiz Session History — Design Spec

**Date:** 2026-04-14
**Branch context:** dev-database
**Scope:** Frontend only (vanilla JS + HTML/CSS). No backend, no DB change.

## Goal

Trong 1 session làm quiz, hiển thị 1 thanh timeline nhỏ ở đáy màn hình cho phép user:
- Xem lại các câu đã làm trong session hiện tại.
- Retry 1 câu đã làm (không tính điểm, chỉ học tập).
- Điều hướng qua lại bằng nút ◀ ▶ hoặc phím ← →.

## Scope

**Quiz types được hỗ trợ:**
- `vq` — Vocabulary Question (trắc nghiệm 4 đáp án)
- `tq` — Typing Question (gõ chữ Hán từ pinyin/nghĩa)
- `sq` — Sentence Question (sắp xếp ký tự thành câu)

**Không support:** luyện viết chữ (writing) — đã loại trừ khỏi scope.

## Core Decisions

| Vấn đề | Quyết định |
|---|---|
| Persistence | **In-memory only**. Reload trang = mất history. |
| Session boundary | **1 session = 1 quiz type liên tục**. Đổi type → reset history. |
| Đổi topic trong cùng type | **Giữ history**, thêm badge topic để phân biệt. |
| Retry scoring | **KHÔNG tính điểm**, không lưu score, chỉ update item cũ với flag `retried=true`. |
| Cap size | **50 câu gần nhất**; quá 50 push ra câu cũ nhất. |
| Xung đột phím ← → | Chỉ hoạt động khi **(a)** focus không ở input/textarea **và** **(b)** câu hiện tại đã submit, hoặc đang ở history view mode. |
| UI layout | **Timeline ngang ở đáy màn hình**, mỗi câu là 1 chấm tròn (xanh=đúng, đỏ=sai, viền vàng nếu đã retry). |

## Data Model

### HistoryItem

```js
{
  id: "<uuid>",                // unique cho key DOM
  quizType: "vq" | "tq" | "sq",
  topicId: <number>,
  topicName: "<string>",
  questionId: <number>,        // id vocabulary/sentence từ backend
  payload: { /* phụ thuộc quizType, xem bên dưới */ },
  result: "correct" | "wrong",
  retried: <boolean>,          // true nếu user đã dùng nút "thử lại" ít nhất 1 lần
  timestamp: <number>          // Date.now()
}
```

### Payload per type

**VQ payload:**
```js
{
  hanzi, pinyin, vietnamese,
  exampleSentence, examplePinyin, exampleVietnamese,
  options: [{ hanzi, pinyin, vietnamese, correct }],
  chosenIdx: <number>,       // index option user chọn
  correctIdx: <number>       // index option đúng
}
```

**TQ payload:**
```js
{
  hanzi, pinyin, vietnamese,
  exampleSentence, examplePinyin, exampleVietnamese,
  userInput: "<string>"      // chữ Hán user đã gõ
}
```

**SQ payload:**
```js
{
  hanziOriginal: "<string>",   // câu đúng
  pinyin, vietnamese,
  userOrder: ["<char>", ...],  // thứ tự ký tự user đã sắp
  correctOrder: ["<char>", ...]
}
```

### Session state (global trong quiz.js)

```js
const QuizHistory = {
  activeType: null,          // "vq" | "tq" | "sq" | null
  items: [],                 // HistoryItem[]
  cursor: null,              // index đang xem; null = đang làm câu mới
};
```

## UI Design

### Layout

Thanh ngang cố định `position: fixed; bottom: 0`, height ~50px desktop / ~42px mobile. Chỉ hiện khi `items.length > 0`. Body có `padding-bottom` tương ứng để không đè quiz area.

```html
<div id="quiz-history-bar" class="qh-bar hidden">
  <button id="qh-prev" class="qh-nav" aria-label="Câu trước">◀</button>
  <div id="qh-track" class="qh-track">
    <!-- mỗi item là 1 button.qh-dot -->
  </div>
  <button id="qh-next" class="qh-nav" aria-label="Câu tiếp">▶</button>
  <span id="qh-counter">12 / 12</span>
  <button id="qh-collapse" class="qh-collapse" aria-label="Thu gọn">×</button>
</div>
```

### Dot styling

- **14px** desktop, **12px** mobile, khoảng cách 6px.
- **Màu nền:** xanh `--ok` nếu `result === 'correct'`, đỏ `--bad` nếu `wrong`.
- **Viền vàng 2px** nếu `retried === true`.
- **Active state** (khi `cursor === idx`): viền dày 3px + glow.
- **Badge 1 ký tự** ở góc (V/T/S) — phòng mở rộng sau này.
- **Track:** `overflow-x: auto`, auto-scroll tới chấm active khi cursor đổi.

### Tooltip/preview (hover desktop, long-press mobile)

```
[VQ] Gia đình
你好 → nǐ hǎo
Chọn: ✅ Xin chào
```

### Counter

Hiển thị `{cursor+1} / {items.length}` khi đang xem history, hoặc `{items.length}` khi đang làm câu mới.

### Collapsed state

User bấm `×` → thanh thu thành icon nhỏ `📋 12` ở góc phải dưới. Bấm icon → mở lại.

## Interactions

### Click dot

```js
onClick(dot, idx) => {
  QuizHistory.cursor = idx;
  enterHistoryView(idx);
}
```

### Nút ◀ ▶

- ◀: `cursor - 1` (nếu cursor=null, set = `items.length - 1`).
- ▶: `cursor + 1`. Nếu đang ở câu cuối history → thoát history view (`cursor = null`), **quay lại câu user đang làm dở** (không load câu mới).
- Nếu `cursor === null` và bấm ▶ → no-op.

### Keyboard ← →

```js
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (!isNavAllowed()) return;
  e.preventDefault();
  e.key === 'ArrowLeft' ? QuizHistory.prev() : QuizHistory.next();
});

function isNavAllowed() {
  const el = document.activeElement;
  if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return false;
  if (QuizHistory.cursor === null && !isCurrentQuestionSubmitted()) return false;
  return true;
}
```

`isCurrentQuestionSubmitted()` — kiểm tra flag `answered` trên state active:
- VQ: `VQ.answered`
- TQ: `TQ.answered`
- SQ: `SQ.answered`

### Thoát history view

- Bấm ▶ ở câu cuối history.
- Bấm nút "Câu tiếp" sẵn có (`nextVQ/nextTQ/nextSQ`).
- Phím `Escape`.

→ Tất cả đều set `cursor = null` và render lại câu user đang làm dở.

## History View Mode

Khi `cursor !== null`, khu vực quiz render từ `items[cursor].payload` thay vì API:

1. **Banner phía trên quiz area:**
   ```
   📖 Đang xem lại câu {cursor+1}/{items.length}    [× Thoát]
   ```

2. **Render read-only** theo quizType:
   - **VQ:** hiện 4 options, highlight `chosenIdx` (xanh nếu đúng / đỏ nếu sai), viền xanh quanh `correctIdx`. Không click được.
   - **TQ:** hiện pinyin + vietnamese, input disabled chứa `userInput`, bên cạnh show chữ Hán đúng.
   - **SQ:** hiện `userOrder` ở drop zone (màu theo đúng/sai), `correctOrder` ở dưới.

3. **2 nút bên dưới:** `🔄 Thử lại` và `➡️ Câu tiếp` (hoặc dùng ◀ ▶).

## Retry Flow

1. User bấm `🔄 Thử lại` trên câu đang xem.
2. Clone `items[cursor].payload` thành state VQ/TQ/SQ mới, giữ `questionId`.
3. Reset user input (options unselected / input empty / SQ drop zone empty).
4. Đặt cờ `VQ.isRetry = true` (hoặc TQ/SQ tương ứng) + `VQ.retryOfIdx = cursor`.
5. `QuizHistory.cursor = null` — coi như đang "làm câu mới", UI quay về trạng thái quiz bình thường.
6. Khi user check (`checkVQ/checkTQ/checkSQ`):
   - **KHÔNG** gọi `_saveStreakIfBetter()` hoặc `api('/api/scores')`.
   - **KHÔNG** push item mới vào `QuizHistory.items`.
   - Gọi `QuizHistory.markRetry(retryOfIdx, newPayload, newResult)` → update `items[retryOfIdx]`:
     - `payload.chosenIdx/userInput/userOrder` = giá trị lần retry
     - `result` = kết quả lần retry
     - `retried = true`
   - Sau đó auto `QuizHistory.goto(retryOfIdx)` để user thấy kết quả retry.
7. Không cho retry-trong-retry: disable nút `Thử lại` khi `isRetry === true` (trong history view sau retry thành công, user phải thoát ra làm câu mới hoặc retry 1 câu khác).

**Retry không giới hạn số lần** — mỗi lần retry đè payload cũ. Không đếm `retryCount` ở version đầu.

## Integration Points

### Files sửa

- `static/js/quiz.js` — thêm module `QuizHistory` và sửa các hàm sẵn có.
- `templates/index.html` — thêm DOM bar + nút × collapse + CSS.

### Files KHÔNG đụng

`main.js`, `writing.js`, `manage.js`, `leaderboard.js`, `utils.js`, backend routes, database schema.

### Thay đổi cụ thể trong `quiz.js`

1. **Thêm object `QuizHistory`** với các method:
   - `resetType(newType)` — nếu khác `activeType`, clear `items`, set `cursor=null`, update `activeType`, ẩn bar.
   - `push(item)` — append, cap 50, render bar.
   - `goto(idx)` — set `cursor`, render history view, auto-scroll chấm.
   - `prev()` / `next()` — logic ở Section 3.
   - `markRetry(idx, newPayload, newResult)` — update item, set `retried=true`, re-render dot.
   - `render()` — re-build track DOM.

2. **Sửa `setVQMode/setTQMode/setSQMode`:** gọi `QuizHistory.resetType('vq'|'tq'|'sq')` ở đầu.

3. **Sửa `loadVQ/loadTQ/loadSQ`:**
   - Reset các flag `answered`, `isRetry`, `retryOfIdx` ở đầu.
   - Nếu `cursor !== null` → render từ `items[cursor]`, không gọi API.

4. **Sửa `checkVQ/checkTQ/checkSQ`:**
   - Set `answered = true`.
   - Nếu `isRetry` → gọi `markRetry`, reset flag, `goto(retryOfIdx)`.
   - Ngược lại → `push` item mới + chạy logic cũ (`_saveStreakIfBetter`, `api('/api/scores')`).

5. **Sửa `nextVQ/nextTQ/nextSQ`:**
   - Nếu `cursor !== null` và không ở cuối → `cursor++`, render history view.
   - Nếu ở cuối → `cursor=null`, gọi API load câu mới (flow hiện tại).

6. **Thêm keyboard listener** global khi DOM ready.

7. **Thêm hàm `renderHistoryView(idx)`** — render read-only cho 3 type.

### Thay đổi trong `index.html`

- HTML cho `#quiz-history-bar` (đặt cuối `<body>` hoặc trong container quiz).
- CSS (~60 dòng): `.qh-bar`, `.qh-dot`, `.qh-correct`, `.qh-wrong`, `.qh-retried`, `.qh-active`, `.qh-badge`, `.qh-nav`, `.qh-track`, `.hidden`, `.qh-collapsed`.
- Responsive breakpoint cho mobile.

## Test Cases

1. **Đổi type giữa chừng** → history clear, bar ẩn.
2. **Đổi topic giữa chừng (cùng type)** → history giữ, chấm mới có badge topic khác.
3. **Retry đúng** → chấm xanh + viền vàng, result update, score không đổi.
4. **Retry sai** → chấm đỏ + viền vàng, result update, score không đổi.
5. **Phím ← → khi focus trong input TQ** → không trigger nav.
6. **Phím ← → khi VQ chưa chọn đáp án** → không trigger nav.
7. **Vượt 50 câu** → câu đầu rơi ra, cursor vẫn trỏ đúng item.
8. **Streak/score** không bị ảnh hưởng bởi retry (verify bằng `/api/leaderboard`).
9. **Reload trang** → history mất hoàn toàn (in-memory).
10. **Click dot đầu → bấm ▶ tới cuối → bấm ▶ lần nữa** → thoát history view, quay về câu đang dở.
11. **Bấm Esc trong history view** → thoát.
12. **Bấm nút × collapse** → bar thu gọn thành icon `📋 N`.

## Out of Scope (lần này)

- Persistence qua reload (localStorage).
- Lưu history vào DB.
- Loại "luyện viết chữ".
- Đếm số lần retry (`retryCount`).
- Export/share history.
- Filter history theo đúng/sai.
- Tìm kiếm trong history.

## Rủi ro

1. **Code `quiz.js` đã lớn** (~500 dòng). Thêm module `QuizHistory` và sửa 9+ hàm có thể làm file khó đọc hơn. → Mitigation: đặt `QuizHistory` thành 1 block có comment rõ ranh giới ở đầu file.
2. **State global nhiều flag mới** (`answered`, `isRetry`, `retryOfIdx`) rải trên 3 object VQ/TQ/SQ. → Mitigation: thêm các flag này có default value rõ ràng khi reset state.
3. **Render history view cho SQ phức tạp** — cần tái tạo drop zone với màu sắc đúng/sai. → Mitigation: tách riêng hàm `renderSQHistory(payload)` không đụng vào state SQ đang chạy.
