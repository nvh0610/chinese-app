# Error-Weighted Quiz Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bias quiz question selection toward words the user frequently answers incorrectly, reset error weight on correct answer, show a badge on boosted cards.

**Architecture:** Modify the two quiz SQL queries to LEFT JOIN `word_errors` and replace `ORDER BY RANDOM()` with a weighted formula. Add one new reset endpoint. Update frontend to pass `quiz_type`, call reset on correct, and render the badge from the API response instead of a separate round-trip.

**Tech Stack:** Python/Flask, PostgreSQL, Vanilla JS

**Spec:** `docs/superpowers/specs/2026-05-14-error-weighted-quiz-design.md`

---

### Task 1: Add `POST /api/errors/reset` endpoint

**Files:**
- Modify: `routes/quiz.py` (after `record_error` function, around line 305)

- [ ] **Step 1: Add the reset endpoint**

In `routes/quiz.py`, add this route immediately after the `record_error` function (after line 305):

```python
@quiz_bp.route('/api/errors/reset', methods=['POST'])
@require_login
def reset_error():
    u = session['user']
    d = request.json
    with db_conn() as conn:
        execute(conn, """
            DELETE FROM word_errors
            WHERE user_id = %s AND word_ref = %s AND quiz_type = %s
        """, (u['id'], d['word_ref'], d['quiz_type']))
    return jsonify({'success': True})
```

- [ ] **Step 2: Verify manually**

Start the server and run:
```bash
curl -s -X POST http://localhost:5000/api/errors/reset \
  -H "Content-Type: application/json" \
  -d '{"word_ref":"你好","quiz_type":"vocab"}' \
  -b "session=..."
```
Expected: `{"success": true}` (or redirect to login if not authenticated — that's fine, confirms the route exists).

- [ ] **Step 3: Commit**

```bash
git add routes/quiz.py
git commit -m "feat: add POST /api/errors/reset endpoint"
```

---

### Task 2: Modify `/api/quiz/vocab` — weighted selection + return `error_count`

**Files:**
- Modify: `routes/quiz.py` lines 56–162

- [ ] **Step 1: Read `quiz_type` param and restructure the CTE query**

Replace the entire `quiz_vocab` function body (lines 58–162) with:

```python
@quiz_bp.route('/api/quiz/vocab')
@require_login
def quiz_vocab():
    u = session['user']
    tid = request.args.get('topic_id')
    qt = request.args.get('quiz_type', 'vocab')
    exclude_str = request.args.get('exclude', '').strip()

    exclude_ids = [int(x) for x in exclude_str.split(',') if x.isdigit()]

    with db_conn() as conn:
        where_clause, where_params = build_vocab_filters(u, tid)

        query = f"""
            WITH pool AS (
                SELECT v.id, COALESCE(we.error_count, 0) AS ec
                FROM vocabulary v
                LEFT JOIN word_errors we
                    ON we.word_ref = v.hanzi
                    AND we.user_id = %s
                    AND we.quiz_type = %s
                {where_clause}
            ),
            picked AS (
                SELECT id, ec FROM pool WHERE id <> ALL(%s::int[])
                ORDER BY (ec * 4 + 1) * RANDOM() DESC LIMIT 1
            ),
            fallback AS (
                SELECT id, ec FROM pool
                WHERE NOT EXISTS (SELECT 1 FROM picked)
                ORDER BY (ec * 4 + 1) * RANDOM() DESC LIMIT 1
            ),
            chosen AS (
                SELECT id, ec FROM picked
                UNION ALL
                SELECT id, ec FROM fallback
                LIMIT 1
            )
            SELECT v.*, t.name as topic_name,
                   (SELECT COUNT(*) FROM pool) as total_in_topic,
                   (SELECT ec FROM chosen) as error_count
            FROM vocabulary v
            JOIN topics t ON t.id = v.topic_id
            WHERE v.id = (SELECT id FROM chosen)
        """
        chosen_row = fetchone(conn, query, [u['id'], qt] + where_params + [exclude_ids])

        if not chosen_row:
            return jsonify({'error': 'Không có từ vựng'}), 404

        chosen = dict(chosen_row)
        total_in_topic = chosen.pop('total_in_topic', 0)
        error_count = chosen.pop('error_count', 0) or 0

        owner_sql = "(owner_id IS NULL OR owner_id = %s)"
        wrong_query = f"""
            SELECT hanzi, pinyin, vietnamese FROM (
                SELECT DISTINCT ON (hanzi) hanzi, pinyin, vietnamese, pri, r FROM (
                    (SELECT hanzi, pinyin, vietnamese, 1 AS pri, RANDOM() AS r
                     FROM vocabulary
                     WHERE topic_id = %s AND id <> %s AND hanzi <> %s AND {owner_sql}
                     LIMIT 20)
                    UNION ALL
                    (SELECT hanzi, pinyin, vietnamese, 2 AS pri, RANDOM() AS r
                     FROM vocabulary
                     WHERE topic_id <> %s AND hanzi <> %s AND {owner_sql}
                     LIMIT 20)
                ) combined
                ORDER BY hanzi, pri, r
            ) deduped
            ORDER BY pri, r
            LIMIT 3
        """
        wrong_rows = fetchall(conn, wrong_query, (
            chosen['topic_id'], chosen['id'], chosen['hanzi'], u['id'],
            chosen['topic_id'], chosen['hanzi'], u['id'],
        ))

    options = [{'hanzi': chosen['hanzi'], 'pinyin': chosen['pinyin'],
                'vietnamese': chosen['vietnamese'], 'correct': True}]
    for w in wrong_rows:
        options.append({'hanzi': w['hanzi'], 'pinyin': w['pinyin'],
                        'vietnamese': w['vietnamese'], 'correct': False})
    random.shuffle(options)

    return jsonify({
        "id": chosen['id'],
        "hanzi": chosen['hanzi'],
        "pinyin": chosen['pinyin'],
        "vietnamese": chosen['vietnamese'],
        "example_sentence": chosen.get('example_sentence'),
        "example_pinyin": chosen.get('example_pinyin'),
        "example_vietnamese": chosen.get('example_vietnamese'),
        "topic_id": chosen['topic_id'],
        "topic_name": chosen['topic_name'],
        "owner_id": chosen['owner_id'],
        "scope": "public" if chosen['owner_id'] is None else "private",
        "created_at": chosen['created_at'].strftime("%a, %d %b %Y %H:%M:%S GMT") if chosen['created_at'] else None,
        "total": total_in_topic,
        "error_count": error_count,
        "options": options
    })
```

- [ ] **Step 2: Test the endpoint manually**

Open the app, do a vocab quiz. Answer a question wrong intentionally, then open DevTools Network tab, reload the page, and check the `/api/quiz/vocab` response — it should now contain `"error_count": N` where N > 0 for words you've previously missed.

- [ ] **Step 3: Commit**

```bash
git add routes/quiz.py
git commit -m "feat: weighted quiz selection in /api/quiz/vocab, return error_count"
```

---

### Task 3: Modify `/api/quiz/sentence` — weighted selection + return `error_count`

**Files:**
- Modify: `routes/quiz.py` lines 164–234

- [ ] **Step 1: Replace the sentence quiz query**

Replace the entire `quiz_sentence` function body (lines 164–234) with:

```python
@quiz_bp.route('/api/quiz/sentence')
@require_login
def quiz_sentence():
    u = session['user']
    tid = request.args.get('topic_id')

    exclude_str = request.args.get('exclude', '').strip()
    exclude_ids = [int(x) for x in exclude_str.split(',') if x.isdigit()]

    with db_conn() as conn:
        conds, where_params = [], []
        if u['role'] == 'admin':
            conds.append("s.owner_id IS NULL")
        else:
            conds.append("(s.owner_id IS NULL OR s.owner_id = %s)")
            where_params.append(u['id'])

        if tid:
            conds.append("s.topic_id = %s")
            where_params.append(tid)

        where_clause = " WHERE " + " AND ".join(conds)

        query = f"""
            WITH pool AS (
                SELECT s.id, COALESCE(we.error_count, 0) AS ec
                FROM sentences s
                LEFT JOIN word_errors we
                    ON we.word_ref = s.hanzi
                    AND we.user_id = %s
                    AND we.quiz_type = 'sent'
                {where_clause}
            ),
            picked AS (
                SELECT id, ec FROM pool WHERE id <> ALL(%s::int[])
                ORDER BY (ec * 4 + 1) * RANDOM() DESC LIMIT 1
            ),
            fallback AS (
                SELECT id, ec FROM pool
                WHERE NOT EXISTS (SELECT 1 FROM picked)
                ORDER BY (ec * 4 + 1) * RANDOM() DESC LIMIT 1
            ),
            chosen AS (
                SELECT id, ec FROM picked
                UNION ALL
                SELECT id, ec FROM fallback
                LIMIT 1
            )
            SELECT s.*, t.name as topic_name,
                   (SELECT COUNT(*) FROM pool) as total_count,
                   (SELECT ec FROM chosen) as error_count
            FROM sentences s
            JOIN topics t ON t.id = s.topic_id
            WHERE s.id = (SELECT id FROM chosen)
        """
        chosen_row = fetchone(conn, query, [u['id']] + where_params + [exclude_ids])

        if not chosen_row:
            return jsonify({'error': 'Không tìm thấy câu nào'}), 404

        chosen = dict(chosen_row)
        total_count = chosen.pop('total_count', 0)
        error_count = chosen.pop('error_count', 0) or 0

    chars = list(chosen['hanzi'])
    random.shuffle(chars)

    return jsonify({
        "id": chosen['id'],
        "hanzi": chosen['hanzi'],
        "pinyin": chosen['pinyin'],
        "vietnamese": chosen['vietnamese'],
        "topic_id": chosen['topic_id'],
        "topic_name": chosen['topic_name'],
        "scope": "public" if chosen['owner_id'] is None else "private",
        "created_at": chosen['created_at'].strftime("%a, %d %b %Y %H:%M:%S GMT") if chosen['created_at'] else None,
        "shuffled": chars,
        "total": total_count,
        "error_count": error_count
    })
```

- [ ] **Step 2: Commit**

```bash
git add routes/quiz.py
git commit -m "feat: weighted quiz selection in /api/quiz/sentence, return error_count"
```

---

### Task 4: Frontend — `quiz_type` param, `resetError()`, badge rendering

**Files:**
- Modify: `static/js/quiz.js`

- [ ] **Step 1: Pass `quiz_type` in `loadVQ` and `loadTQ`**

In `loadVQ()` (around line 365), change:
```js
const params = new URLSearchParams({ exclude: VQ.exclude.join(',') });
if (tid) params.set('topic_id', tid);
const q = await api('/api/quiz/vocab?' + params);
```
to:
```js
const params = new URLSearchParams({ exclude: VQ.exclude.join(','), quiz_type: 'vocab' });
if (tid) params.set('topic_id', tid);
const q = await api('/api/quiz/vocab?' + params);
```

In `loadTQ()` (around line 526), change:
```js
const params = new URLSearchParams({ exclude: TQ.exclude.join(',') });
if (tid) params.set('topic_id', tid);
const q = await api('/api/quiz/vocab?' + params);
```
to:
```js
const params = new URLSearchParams({ exclude: TQ.exclude.join(','), quiz_type: 'type' });
if (tid) params.set('topic_id', tid);
const q = await api('/api/quiz/vocab?' + params);
```

- [ ] **Step 2: Add `resetError()` function**

After the existing `recordError` function (around line 882), add:

```js
function resetError(wordRef, quizType) {
  api('/api/errors/reset', 'POST', { word_ref: wordRef, quiz_type: quizType });
}
```

- [ ] **Step 3: Call `resetError` on correct answer in `checkVQ`**

In `checkVQ` (around line 447), inside the `if (!isRetry)` block, after `VQ.right++; VQ.streak++;...`:

```js
if (!isRetry) {
  if (correct) {
    VQ.right++; VQ.streak++; VQ.maxStreak = Math.max(VQ.maxStreak, VQ.streak);
    _saveStreakIfBetter('vq');
    if (vqCurrentQ) resetError(vqCurrentQ.hanzi, 'vocab');
  } else {
    VQ.wrong++; VQ.streak = 0;
    if (vqCurrentQ) recordError(vqCurrentQ.hanzi, 'vocab');
  }
  VQ.done++;
  updateScoreUI('vq');
}
```

- [ ] **Step 4: Call `resetError` on correct answer in `checkTQ`**

In `checkTQ` (around line 603), inside the `if (!isRetry)` block:

```js
if (!isRetry) {
  if (ok) {
    TQ.right++; TQ.streak++; TQ.maxStreak = Math.max(TQ.maxStreak, TQ.streak);
    _saveStreakIfBetter('tq');
    if (tqCurrentQ) resetError(tqCurrentQ.hanzi, 'type');
  } else {
    TQ.wrong++; TQ.streak = 0;
    if (tqCurrentQ) recordError(tqCurrentQ.hanzi, 'type');
  }
  TQ.done++;
  updateScoreUI('tq');
}
```

- [ ] **Step 5: Call `resetError` on correct answer in `_finishSQ`**

In `_finishSQ` (around line 813), inside the `if (!isRetry)` block:

```js
if (!isRetry) {
  if (ok) {
    SQ.right++; SQ.streak++; SQ.maxStreak = Math.max(SQ.maxStreak, SQ.streak);
    _saveStreakIfBetter('sq');
    if (sqCurrentQ) resetError(sqCurrentQ.hanzi, 'sent');
  } else {
    SQ.wrong++; SQ.streak = 0;
    if (sqCurrentQ) recordError(sqCurrentQ.hanzi, 'sent');
  }
  SQ.done++;
  updateScoreUI('sq');
}
```

- [ ] **Step 6: Replace `loadErrorBadge` in `_renderVQCard` with inline badge**

`_renderVQCard` currently has `<div id="vqErrBadge" ...></div>` in both the `viet` and `han` branches, and calls `loadErrorBadge(q.hanzi, 'vqErrBadge')` at the bottom (line 427).

In the `viet` branch, replace:
```html
<div id="vqErrBadge" style="min-height:20px;margin-top:4px"></div>
```
with:
```js
${q.error_count > 0 ? `<span class="error-badge" style="margin-top:4px">🔥 Từ hay sai (${q.error_count} lần)</span>` : ''}
```

In the `han` branch, do the same replacement:
```js
${q.error_count > 0 ? `<span class="error-badge" style="margin-top:4px">🔥 Từ hay sai (${q.error_count} lần)</span>` : ''}
```

Remove the `loadErrorBadge(q.hanzi, 'vqErrBadge')` call at line 427.

- [ ] **Step 7: Add badge to `_renderTQCard`**

In `_renderTQCard`, in both the `read` and `listen` branches, add the badge after the `<span class="qtag" ...>` line:

For `read` mode block:
```js
<div class="ql">Nhập chữ Hán cho nghĩa sau</div>
<div class="qviet">${q.vietnamese}</div>
<span class="qtag" style="color:${fg};background:${bg}">${q.topic_name}</span>
${q.error_count > 0 ? `<div style="margin-top:6px"><span class="error-badge">🔥 Từ hay sai (${q.error_count} lần)</span></div>` : ''}
```

For `listen` mode block:
```js
<span class="qtag" style="color:${fg};background:${bg}">${q.topic_name}</span>
${q.error_count > 0 ? `<div style="margin-top:6px"><span class="error-badge">🔥 Từ hay sai (${q.error_count} lần)</span></div>` : ''}
<div style="font-size:12px;color:var(--c-ink3);margin-top:6px">Nhấn loa để nghe, sau đó gõ chữ Hán</div>
```

- [ ] **Step 8: Add badge to `loadSQ`**

In `loadSQ`, the card HTML is built inline. After `<div class="sq-viet">${q.vietnamese}</div>`, add:

```js
${q.error_count > 0 ? `<div style="margin-top:6px"><span class="error-badge">🔥 Từ hay sai (${q.error_count} lần)</span></div>` : ''}
```

- [ ] **Step 9: Commit**

```bash
git add static/js/quiz.js
git commit -m "feat: error-weighted quiz frontend — quiz_type param, resetError, badges"
```

---

### Task 5: CSS — update `.error-badge` style for the 🔥 badge

**Files:**
- Modify: `static/css/style.css` (around line 2091)

- [ ] **Step 1: Check existing style**

The existing `.error-badge` class uses a soft orange background (`var(--c-ora-s)`) with orange text (`var(--c-ora)`). This is fine as-is — the new badge reuses this class with the 🔥 emoji to make it visually distinct. No CSS change needed if the existing style looks good.

If you want the badge more prominent (solid orange, white text), replace the existing `.error-badge` block with:

```css
.error-badge {
  display: inline-block;
  background: #f97316;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
}
```

- [ ] **Step 2: Verify in both light and dark mode**

Open the app, answer a question wrong, then answer the next question of the same type. If that same word comes up again (may take a few tries since it's probabilistic), you should see the 🔥 badge. Toggle dark mode — badge should remain readable.

- [ ] **Step 3: Commit (only if CSS was changed)**

```bash
git add static/css/style.css
git commit -m "style: update error-badge for weighted quiz indicator"
```

---

## Manual End-to-End Verification

After all tasks are complete:

1. Answer 3+ questions wrong in VQ (same word if possible, or different words)
2. Watch DevTools Network — `/api/quiz/vocab` response should show `"error_count": N`
3. The card for a word you've missed should show `🔥 Từ hay sai (N lần)`
4. Answer that word **correctly** — DevTools should show `POST /api/errors/reset` firing
5. Next time that word appears, badge should be gone and `error_count` should be 0
6. Repeat steps 1–5 for TQ (type quiz) and SQ (sentence quiz)
7. Verify badge does NOT appear in history view (← arrow navigation)
8. Verify badge does NOT appear in wrong-list retry view
