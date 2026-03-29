// ══ Shared Utilities ══════════════════════════════════════════════════════
const TAG_COLORS = [
  ['#1d4ed8', '#dbeafe'], ['#15803d', '#dcfce7'], ['#b45309', '#fef3c7'],
  ['#7c3aed', '#ede9fe'], ['#db2777', '#fce7f3'], ['#0f766e', '#ccfbf1'],
  ['#c2410c', '#ffedd5'], ['#0369a1', '#e0f2fe'], ['#6d28d9', '#f5f3ff'],
  ['#047857', '#d1fae5'],
];
const tagColorMap = {};
function tagColor(name) {
  if (!tagColorMap[name]) {
    const idx = Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % TAG_COLORS.length;
    tagColorMap[name] = TAG_COLORS[idx];
  }
  return tagColorMap[name];
}
function topicTagHtml(name, scope) {
  const [fg, bg] = tagColor(name);
  return `<span class="vtag" style="color:${fg};background:${bg}">${name}</span>`;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function emptyHtml(msg) {
  return `<div class="empty"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg; el.classList.remove('hidden');
}
function hideErr(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

function closeM(id) { document.getElementById(id).classList.add('hidden'); }

async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  try {
    const res = await fetch(url, opts);
    return await res.json();
  } catch (e) { return { error: 'Lỗi kết nối' }; }
}

let _debTimers = {};
function debounce(fn, ms) {
  return function (...args) {
    clearTimeout(_debTimers[fn]);
    _debTimers[fn] = setTimeout(() => fn(...args), ms);
  };
}

function pagerHtml(page, total, perPage, onPageFn) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return '';
  let html = '';
  if (page > 1) html += `<button class="pager-btn" onclick="${onPageFn}(${page - 1})">← Trước</button>`;
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) {
    html += `<button class="pager-btn ${p === page ? 'active' : ''}" onclick="${onPageFn}(${p})">${p}</button>`;
  }
  if (page < pages) html += `<button class="pager-btn" onclick="${onPageFn}(${page + 1})">Sau →</button>`;
  return html;
}

function revealHtml(ok, hanzi, pinyin, ex, expy, exvn, showAns = true) {
  return `
    <div class="rv-label ${ok ? 'ok' : 'bad'}">${ok ? '✓ Đúng rồi!' : '✗ Chưa đúng!'}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
      ${(!ok && showAns)
      ? `<div>Đáp án: <span class="rv-hz">${hanzi}</span></div>`
      : `<span class="rv-hz">${hanzi}</span>`}
      ${speakBtn(hanzi, 18)}
    </div>
    <div class="rv-py">${pinyin || ''}</div>
    ${ex ? `<div class="rv-ex">
      <div style="display:flex;align-items:center;gap:6px">
        <div class="rv-ex-hz">${ex}</div>
        ${speakBtn(ex, 14)}
      </div>
      <div class="rv-ex-py">${expy || ''}</div>
      <div class="rv-ex-vn">${exvn || ''}</div>
    </div>` : ''}
  `;
}

// Modal backdrop close
document.addEventListener('click', e => {
  document.querySelectorAll('.modal:not(.hidden)').forEach(m => {
    if (e.target === m && m.id !== 'mConfirm') closeM(m.id);
  });
});

function speakZH(text, gender = 'female') {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const trySpeak = () => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = gender === 'female' ? 'zh-CN' : 'zh-TW';
    utter.rate = gender === 'female' ? 0.8 : 0.75;
    utter.pitch = gender === 'female' ? 1.4 : 0.5;

    const voices = window.speechSynthesis.getVoices();
    const zhVoices = voices.filter(v =>
      v.lang.startsWith('zh') || v.lang.startsWith('cmn')
    );

    if (zhVoices.length) {
      // Tìm giọng khớp gender
      const femaleKeywords = /female|woman|ting|meijia|li\b|hanhan|xiaoxiao|huihui|yaoyao/i;
      const maleKeywords = /male|man|kangkang|zhiyu|yunyang|xiaochen|yunjian/i;

      const preferred = zhVoices.find(v =>
        gender === 'female' ? femaleKeywords.test(v.name) : maleKeywords.test(v.name)
      );

      // Nếu không tìm được đúng gender, dùng giọng index khác nhau
      if (preferred) {
        utter.voice = preferred;
      } else if (zhVoices.length >= 2) {
        utter.voice = gender === 'female' ? zhVoices[0] : zhVoices[1];
      } else {
        utter.voice = zhVoices[0];
        // Pitch/rate đã đủ khác biệt để phân biệt
      }
    }

    window.speechSynthesis.speak(utter);
  };

  // Voices có thể chưa load xong
  if (window.speechSynthesis.getVoices().length) {
    trySpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => { trySpeak(); };
  }
}

// Nút loa cạnh chữ Hán — dùng ở mọi nơi
function speakBtn(hanzi, size = 16) {
  return `
    <button class="speak-btn-f" onclick="speakZH('${esc(hanzi)}','female')" title="Giọng nữ" style="font-size:${size}px">🔊</button>
    <button class="speak-btn-m" onclick="speakZH('${esc(hanzi)}','male')"   title="Giọng nam" style="font-size:${size}px">🔉</button>
  `;
}

window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();