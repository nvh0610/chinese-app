// ══ Writing Quiz (HanziWriter) ════════════════════════════════════════════════
let wrWriter = null;
let wrCurrentStroke = 0;
let wrOutlineVisible = true;
let wrCurrentQ = null;
let wrRight = 0, wrWrong = 0;
let wrExclude = [];

async function loadWR() {
    const card = document.getElementById('wrCard');
    card.innerHTML = '<div class="qload">Đang tải...</div>';

    const tid = document.getElementById('wrTopic').value;
    const params = new URLSearchParams({ exclude: wrExclude.join(',') });
    if (tid) params.set('topic_id', tid);

    const q = await api('/api/quiz/vocab?' + params);
    if (q.error) { card.innerHTML = emptyHtml('Không có từ vựng nào.'); return; }

    // Chỉ lấy chữ đơn hoặc chữ đầu tiên để vẽ
    const charsToWrite = [...q.hanzi];
    let wrCharIndex = 0;
    wrCurrentQ = q;

    const [fg, bg] = tagColor(q.topic_name);
    card.innerHTML = `
    <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start">
      <!-- Info bên trái -->
      <div style="flex:1;min-width:200px">
        <div class="ql">Luyện viết chữ</div>
        <div style="font-family:var(--fz);font-size:56px;font-weight:900;color:var(--c-ink);line-height:1;margin-bottom:8px">${q.hanzi}</div>
        <div style="font-style:italic;color:var(--c-blue);font-size:16px;margin-bottom:4px">${q.pinyin}</div>
        <div style="font-size:18px;font-weight:600;color:var(--c-ink);margin-bottom:12px">${q.vietnamese}</div>
        <span class="qtag" style="color:${fg};background:${bg}">${q.topic_name}</span>
        ${q.example_sentence ? `
        <div class="vex" style="margin-top:16px">
          <div class="vex-hz">${q.example_sentence}</div>
          <div class="vex-py">${q.example_pinyin || ''}</div>
          <div class="vex-vn">${q.example_vietnamese || ''}</div>
        </div>` : ''}
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-ghost" onclick="wrAnimateChar()">▶ Xem nét</button>
          <button class="btn-ghost" onclick="wrHint()">💡 Gợi ý nét</button>
          <button class="btn-ghost" id="wrOutlineBtn" onclick="wrToggleOutline()">👁 Ẩn nét mờ</button>
          <button class="btn-ghost" onclick="wrRetry()">🔄 Thử lại</button>
          <button class="speak-btn-f" style="font-size:18px;border:1.5px solid var(--c-bdr);border-radius:var(--r-sm);padding:5px 8px" onclick="speakZH('${esc(q.hanzi)}','female')" title="Giọng nữ">🔊</button>
          <button class="speak-btn-m" style="font-size:18px;border:1.5px solid var(--c-bdr);border-radius:var(--r-sm);padding:5px 8px" onclick="speakZH('${esc(q.hanzi)}','male')" title="Giọng nam">🔉</button>
        </div>
      </div>

      <!-- Canvas bên phải -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
        <div id="wrCanvas" style="
          border: 2px solid var(--c-bdr); border-radius: var(--r);
          background: #fff; position:relative;
        "></div>
        <div id="wrStatus" style="font-size:14px;font-weight:600;color:var(--c-ink3);min-height:22px;text-align:center"></div>
        <button class="btn-primary" id="wrNextBtn" style="display:none" onclick="nextWR(${q.id})">Chữ tiếp →</button>
      </div>
    </div>
  `;

    // Khởi tạo HanziWriter
    if (wrWriter) { try { wrWriter = null; } catch (e) { } }
    wrCurrentStroke = 0;
    wrCharIndex = 0;
    _initWriterForChar(charsToWrite, 0, q);
}

function wrAnimateChar() {
    if (wrWriter) {
        wrWriter.cancelQuiz();
        wrWriter.animateCharacter({
            onComplete: () => wrWriter.quiz()
        });
    }
}

function wrHint() {
    // Gợi ý đúng nét hiện tại đang cần vẽ
    if (wrWriter) wrWriter.highlightStroke(wrCurrentStroke);
}

function wrRetry() {
    document.getElementById('wrNextBtn').style.display = 'none';
    if (wrCurrentQ) _initWriterForChar([...wrCurrentQ.hanzi], 0, wrCurrentQ);
}

function wrToggleOutline() {
    wrOutlineVisible = !wrOutlineVisible;
    const btn = document.getElementById('wrOutlineBtn');
    if (btn) btn.textContent = wrOutlineVisible ? '👁 Ẩn nét mờ' : '👁 Hiện nét mờ';
    if (wrCurrentQ) {
        _initWriterForChar([...wrCurrentQ.hanzi], 0, wrCurrentQ);
    }
}

function nextWR(excludeId) {
    if (!wrExclude.includes(excludeId)) wrExclude.push(excludeId);
    loadWR();
}

function resetWR() {
    wrExclude = []; wrRight = 0; wrWrong = 0;
    document.getElementById('wrRight').textContent = '0';
    document.getElementById('wrWrong').textContent = '0';
    loadWR();
}

function _initWriterForChar(chars, idx, q) {
    const canvasEl = document.getElementById('wrCanvas');
    if (!canvasEl) return;
    canvasEl.innerHTML = '';
    wrCurrentStroke = 0;

    const char = chars[idx];
    const total = chars.length;

    // Cập nhật tiêu đề chữ đang tập
    const statusEl = document.getElementById('wrStatus');
    if (statusEl) {
        statusEl.textContent = total > 1 ? `Chữ ${idx + 1}/${total}: ${char}` : '';
        statusEl.style.color = 'var(--c-ink3)';
    }

    wrWriter = HanziWriter.create('wrCanvas', char, {
        width: 280,
        height: 280,
        padding: 20,
        showOutline: wrOutlineVisible,
        strokeColor: '#1c1917',
        outlineColor: '#e8e2d9',
        drawingColor: '#dc2626',
        drawingWidth: 4,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 100,
        showHintAfterMisses: 999,
        highlightOnComplete: true,
        highlightColor: '#16a34a',
        onMistake: () => {
            const el = document.getElementById('wrStatus');
            if (el) { el.textContent = '✗ Nét chưa đúng!'; el.style.color = 'var(--c-red)'; }
        },
        onCorrectStroke: () => {
            wrCurrentStroke++;
            const el = document.getElementById('wrStatus');
            if (el) { el.textContent = '✓ Nét đúng!'; el.style.color = 'var(--c-grn)'; }
        },
        onComplete: () => {
            speakZH(char, 'female');
            if (idx + 1 < total) {
                // Còn chữ tiếp theo trong cụm
                const el = document.getElementById('wrStatus');
                if (el) { el.textContent = `✅ Xong chữ ${idx + 1}! Tiếp theo: ${chars[idx + 1]}`; el.style.color = 'var(--c-grn)'; }
                setTimeout(() => _initWriterForChar(chars, idx + 1, q), 1200);
            } else {
                // Hoàn thành cả cụm
                wrRight++;
                document.getElementById('wrRight').textContent = wrRight;
                const el = document.getElementById('wrStatus');
                if (el) { el.innerHTML = '🎉 Hoàn thành cả cụm!'; el.style.color = 'var(--c-grn)'; }
                document.getElementById('wrNextBtn').style.display = '';
                speakZH(q.hanzi, 'female');
            }
        }
    });
    wrWriter.quiz();
}