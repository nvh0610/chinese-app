from flask import Blueprint, request, jsonify, session
from database import get_db
from .helpers import require_login, vocab_query_all, sent_query
import random

quiz_bp = Blueprint('quiz', __name__)

@quiz_bp.route('/api/quiz/vocab')
@require_login
def quiz_vocab():
    u = session['user']
    tid = request.args.get('topic_id')
    exclude = [int(x) for x in request.args.get('exclude','').split(',') if x]
    
    # 1. Lấy tất cả từ trong topic hiện tại
    all_v = vocab_query_all(u, tid)
    avail = [v for v in all_v if v['id'] not in exclude]
    
    if not avail: avail = all_v
    if not avail: return jsonify({'error':'Không có từ vựng'}), 404
    
    # 2. Chọn từ đúng
    chosen = random.choice(avail)
    
    # 3. Lấy các từ sai TRONG CÙNG topic
    others = [v for v in all_v if v['id'] != chosen['id']]
    
    # 4. Logic lấy thêm từ "rác" nếu thiếu
    if len(others) < 3:
        # Lấy thêm từ ở TẤT CẢ các topic khác của user này
        # Giả sử hàm vocab_query_all(u, None) sẽ trả về toàn bộ từ vựng của user
        global_all = vocab_query_all(u, None) 
        
        # Lọc bỏ từ đã chọn (chosen) và những từ đã có trong others
        existing_ids = {chosen['id']} | {v['id'] for v in others}
        extra_needed = 3 - len(others)
        
        potential_extras = [v for v in global_all if v['id'] not in existing_ids]
        
        # Lấy thêm cho đủ
        extras = random.sample(potential_extras, min(extra_needed, len(potential_extras)))
        others.extend(extras)

    # 5. Chọn ngẫu nhiên 3 từ sai từ danh sách đã gộp
    wrong = random.sample(others, min(3, len(others)))
    
    # 6. Đóng gói kết quả
    opts = [{'hanzi':w['hanzi'],'pinyin':w['pinyin'],'correct':False} for w in wrong]
    opts.append({'hanzi':chosen['hanzi'],'pinyin':chosen['pinyin'],'correct':True})
    random.shuffle(opts)
    
    return jsonify({**chosen, 'options': opts, 'total': len(all_v)})

@quiz_bp.route('/api/quiz/sentence')
@require_login
def quiz_sentence():
    u = session['user']
    tid = request.args.get('topic_id')
    exclude = [int(x) for x in request.args.get('exclude','').split(',') if x]
    all_s = sent_query(u, tid)
    avail = [s for s in all_s if s['id'] not in exclude]
    if not avail: avail = all_s
    if not avail: return jsonify({'error':'Không có câu'}),404
    chosen = random.choice(avail)
    chars = list(chosen['hanzi'])
    random.shuffle(chars)
    return jsonify({**chosen, 'shuffled': chars, 'total': len(all_s)})

@quiz_bp.route('/api/scores', methods=['POST'])
@require_login
def save_score():
    u = session['user']
    d = request.json
    streak = int(d.get('streak', 0))
    topic_id = d.get('topic_id') or None
    quiz_type = d.get('quiz_type', 'vocab')
    if streak <= 0: return jsonify({'success': True})
    db = get_db()
    db.execute("INSERT INTO scores (user_id,topic_id,quiz_type,streak) VALUES (?,?,?,?)",
               (u['id'], topic_id, quiz_type, streak))
    db.commit(); db.close()
    return jsonify({'success': True})

@quiz_bp.route('/api/leaderboard')
@require_login
def leaderboard():
    topic_id = request.args.get('topic_id') or None
    quiz_type = request.args.get('quiz_type', 'all')
    period = request.args.get('period', 'all')  # all, week, month, today

    db = get_db()

    # Build date filter
    date_filter = ""
    if period == 'today':
        date_filter = "AND DATE(s.recorded_at) = DATE('now')"
    elif period == 'week':
        date_filter = "AND DATE(s.recorded_at) >= DATE('now', '-7 days')"
    elif period == 'month':
        date_filter = "AND DATE(s.recorded_at) >= DATE('now', '-30 days')"

    topic_filter = "AND s.topic_id=?" if topic_id else ""
    type_filter  = "AND s.quiz_type=?" if quiz_type != 'all' else ""

    params = []
    if topic_id: params.append(topic_id)
    if quiz_type != 'all': params.append(quiz_type)

    rows = db.execute(f"""
        SELECT u.username, u.role, MAX(s.streak) as best_streak,
               COUNT(s.id) as attempts,
               DATE(MAX(s.recorded_at)) as last_date
        FROM scores s
        JOIN users u ON u.id=s.user_id
        WHERE 1=1 {topic_filter} {type_filter} {date_filter}
        GROUP BY s.user_id
        ORDER BY best_streak DESC
        LIMIT 20
    """, params).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])
