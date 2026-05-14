# Error-Weighted Quiz Selection

**Date:** 2026-05-14
**Status:** Approved

## Problem

The quiz currently selects questions with `ORDER BY RANDOM()`, meaning words the user frequently answers incorrectly have the same probability of appearing as words they've never missed. The `word_errors` table already stores per-word error counts but is never consulted during question selection.

## Goal

Prioritize words with high error counts in quiz question selection across all 3 quiz types (VQ, TQ, SQ). When a user answers correctly, reset that word's error count to zero. Show a visible badge on the card when a word is being boosted.

## Decisions

| Question | Answer |
|---|---|
| Scope | All 3 quiz types: VQ (vocab), TQ (type), SQ (sentence) |
| Correct answer behavior | Option C — resets error_count to 0 (DELETE the row) |
| User visibility | Option B — show 🔥 badge on card when word is boosted |
| Algorithm | Weighted random in SQL: `(error_count * 4 + 1) * RANDOM() DESC` |

## Weighting Formula

```
weight = (error_count * 4 + 1) * RANDOM()
```

| error_count | Max weight | vs. clean word |
|---|---|---|
| 0 | 1× | baseline |
| 1 | 5× | 5× more likely |
| 2 | 9× | 9× more likely |
| 3 | 13× | 13× more likely |
| 5 | 21× | 21× more likely |

The multiplier `4` can be tuned. Higher = more aggressive prioritization.

## Backend Changes

### 1. `/api/quiz/vocab` — add `quiz_type` param + weighted CTE

New query param: `quiz_type` (`vocab` | `type`), default `vocab`.

Modified CTE:
```sql
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
```

Params order: `[u['id'], qt] + where_params + [exclude_ids]`

Response includes new field: `"error_count": <int>`

### 2. `/api/quiz/sentence` — same weighted CTE

Same modification with `quiz_type` hardcoded to `'sent'`.

Params order: `[u['id'], 'sent'] + where_params + [exclude_ids]`

Response includes new field: `"error_count": <int>`

### 3. New endpoint: `POST /api/errors/reset`

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

No DB schema changes needed — `word_errors` table already exists.

## Frontend Changes (`static/js/quiz.js`)

### 1. Pass `quiz_type` param in API calls

- `loadVQ()`: append `&quiz_type=vocab` to `/api/quiz/vocab` URL
- `loadTQ()`: append `&quiz_type=type` to `/api/quiz/vocab` URL
- `loadSQ()`: no change (sentence endpoint always uses `'sent'`)

### 2. `resetError()` function

```js
function resetError(wordRef, quizType) {
  api('/api/errors/reset', 'POST', { word_ref: wordRef, quiz_type: quizType });
}
```

Called on correct answer:
- `checkVQ()`: `resetError(vqCurrentQ.hanzi, 'vocab')`
- `checkTQ()`: `resetError(tqCurrentQ.hanzi, 'type')`
- `_finishSQ()`: `resetError(sqCurrentQ.hanzi, 'sent')`

Only called when NOT in retry context (`QuizHistory.retryCtx` is null).

### 3. Badge injection on card render

When server returns `error_count > 0`, prepend badge to card content:

```html
<span class="error-weight-badge">🔥 Từ hay sai (N lần)</span>
```

Rules:
- Only shown on freshly loaded questions (not in history view, not in retry view)
- `N` = the `error_count` value from the API response

## CSS Changes (`static/css/style.css`)

```css
.error-weight-badge {
  display: inline-block;
  background: #f97316;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  margin-bottom: 8px;
}
```

Dark mode inherits fine (white text on orange is readable on both themes).

## Data Flow

```
User answers wrong
  → recordError(hanzi, quizType)  [existing]
  → word_errors row upserted / error_count++

Next question loaded
  → /api/quiz/vocab?quiz_type=vocab
  → CTE LEFT JOIN word_errors → weighted ORDER BY
  → returns error_count in response

Frontend renders card
  → if error_count > 0: show 🔥 badge

User answers correctly
  → resetError(hanzi, quizType)   [new]
  → DELETE FROM word_errors WHERE user_id/word_ref/quiz_type
  → word dropped back to uniform probability
```

## Files Changed

| File | Change |
|---|---|
| `routes/quiz.py` | Modify VQ query, modify SQ query, add `/api/errors/reset` endpoint |
| `static/js/quiz.js` | Add `quiz_type` param to loadVQ/loadTQ, add `resetError()`, badge injection in 3 render functions |
| `static/css/style.css` | Add `.error-weight-badge` style |
