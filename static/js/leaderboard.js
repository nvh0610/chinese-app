async function loadLB() {
  const tid = document.getElementById('lbTopic').value;
  const type = document.getElementById('lbType').value;
  const period = document.getElementById('lbPeriod').value;
  const params = new URLSearchParams({ quiz_type: type, period });
  if (tid) params.set('topic_id', tid);
  const rows = await api('/api/leaderboard?' + params);
  const cont = document.getElementById('lbList');
  if (!rows.length) {
    cont.innerHTML = `<div class="lb-empty"><div style="font-size:40px">📊</div><p>Chưa có dữ liệu nào.<br>Hãy làm quiz để ghi điểm!</p></div>`;
    return;
  }
  const rankEmoji = (i) => {
    if (i === 0) return '<span class="lb-rank rank-1">🥇</span>';
    if (i === 1) return '<span class="lb-rank rank-2">🥈</span>';
    if (i === 2) return '<span class="lb-rank rank-3">🥉</span>';
    return `<span class="lb-rank rank-n">${i + 1}</span>`;
  };
  const typeLabel = { vocab: 'Trắc nghiệm', type: 'Gõ chữ Hán', sent: 'Sắp xếp câu', all: 'Tất cả' };
  cont.innerHTML = `<div class="lb-table">${rows.map((r, i) => `
    <div class="lb-row">
      ${rankEmoji(i)}
      <div class="lb-avatar ${r.role === 'admin' ? 'admin' : ''}">${r.username[0].toUpperCase()}</div>
      <div class="lb-info">
        <div class="lb-name">${r.username} ${r.role === 'admin' ? '<span style="font-size:11px;color:var(--c-red)">👑</span>' : ''}</div>
        <div class="lb-meta">${r.attempts} lần làm · Gần nhất: ${r.last_date || '-'}</div>
      </div>
      <div style="text-align:center">
        <div class="lb-streak">🔥 ${r.best_streak}</div>
        <div class="lb-streak-lbl">streak cao nhất</div>
      </div>
    </div>
  `).join('')}</div>`;
}
