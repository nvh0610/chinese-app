from flask import Blueprint, request, jsonify, session
from database import db_conn, fetchone, fetchall, execute, insert_returning_id
from .helpers import require_login, vocab_query_all, sent_query, build_vocab_filters
import random

quiz_bp = Blueprint('quiz', __name__)

# @quiz_bp.route('/api/quiz/vocab')
# @require_login
# def quiz_vocab():
#     u = session['user']
#     tid = request.args.get('topic_id')
#     exclude = [int(x) for x in request.args.get('exclude','').split(',') if x]
    
#     # 1. Lấy tất cả từ trong topic hiện tại
#     with db_conn() as conn:
#         all_v = vocab_query_all(conn, u, tid)
#     avail = [v for v in all_v if v['id'] not in exclude]
    
#     if not avail: avail = all_v
#     if not avail: return jsonify({'error':'Không có từ vựng'}), 404
    
#     # 2. Chọn từ đúng
#     chosen = random.choice(avail)
    
#     # 3. Lấy các từ sai TRONG CÙNG topic
#     others = [v for v in all_v if v['id'] != chosen['id']]
    
#     # 4. Logic lấy thêm từ "rác" nếu thiếu
#     if len(others) < 3:
#         # Lấy thêm từ ở TẤT CẢ các topic khác của user này
#         # Giả sử hàm vocab_query_all(u, None) sẽ trả về toàn bộ từ vựng của user
#         with db_conn() as conn:
#             global_all = vocab_query_all(conn, u, None) 
        
#         # Lọc bỏ từ đã chọn (chosen) và những từ đã có trong others
#         existing_ids = {chosen['id']} | {v['id'] for v in others}
#         extra_needed = 3 - len(others)
        
#         potential_extras = [v for v in global_all if v['id'] not in existing_ids]
        
#         # Lấy thêm cho đủ
#         extras = random.sample(potential_extras, min(extra_needed, len(potential_extras)))
#         others.extend(extras)

#     # 5. Chọn ngẫu nhiên 3 từ sai từ danh sách đã gộp
#     wrong = random.sample(others, min(3, len(others)))
    
#     # 6. Đóng gói kết quả
#     opts = [{'hanzi':w['hanzi'],'pinyin':w['pinyin'],'vietnamese':w['vietnamese'],'correct':False} for w in wrong]
#     opts.append({'hanzi':chosen['hanzi'],'pinyin':chosen['pinyin'],'vietnamese':chosen['vietnamese'],'correct':True})
#     random.shuffle(opts)
    
#     return jsonify({**chosen, 'options': opts, 'total': len(all_v)})

@quiz_bp.route('/api/quiz/vocab')
@require_login
def quiz_vocab():
    u = session['user']
    tid = request.args.get('topic_id')
    exclude_str = request.args.get('exclude', '').strip()
    
    # 1. Xử lý exclude an toàn
    exclude_ids = [int(x) for x in exclude_str.split(',') if x.isdigit()]
    exclude_tuple = tuple(exclude_ids) if exclude_ids else (-1,)
    
    chosen = None
    total_in_topic = 0

    with db_conn() as conn:
        # Build filter chung
        where_clause, params = build_vocab_filters(u, tid)

        # 2. LẤY TỪ ĐÚNG (CHOSEN)
        # Query này loại trừ những id trong danh sách exclude
        query_chosen = f"""
            SELECT v.*, t.name as topic_name 
            FROM vocabulary v
            JOIN topics t ON t.id = v.topic_id
            {where_clause} AND v.id NOT IN %s
            ORDER BY RANDOM() LIMIT 1
        """
        chosen_row = fetchone(conn, query_chosen, params + [exclude_tuple])

        # Nếu đã làm hết sạch từ (exclude hết rồi) thì Reset: lấy lại ngẫu nhiên không exclude
        if not chosen_row:
            query_reset = f"""
                SELECT v.*, t.name as topic_name 
                FROM vocabulary v
                JOIN topics t ON t.id = v.topic_id
                {where_clause}
                ORDER BY RANDOM() LIMIT 1
            """
            chosen_row = fetchone(conn, query_reset, params)

        if not chosen_row:
            return jsonify({'error': 'Không có từ vựng'}), 404
        
        chosen = dict(chosen_row)

        # 3. LẤY 3 ĐÁP ÁN SAI (KHÔNG TRÙNG NHAU)
        # Sử dụng DISTINCT để đảm bảo 3 từ sai không bị trùng chữ Hán
        query_wrong = f"""
            SELECT hanzi, pinyin, vietnamese 
            FROM (
                SELECT DISTINCT ON (hanzi) hanzi, pinyin, vietnamese, priority, random_val
                FROM (
                    (
                        SELECT hanzi, pinyin, vietnamese, 1 as priority, RANDOM() as random_val
                        FROM vocabulary
                        WHERE topic_id = %s AND id != %s
                        LIMIT 20
                    )
                    UNION ALL
                    (
                        SELECT hanzi, pinyin, vietnamese, 2 as priority, RANDOM() as random_val
                        FROM vocabulary
                        WHERE id != %s
                        LIMIT 20
                    )
                ) sub_all
                WHERE hanzi != %s
                ORDER BY hanzi, priority ASC, random_val
            ) final_sub
            ORDER BY priority ASC, random_val
            LIMIT 3
        """
        # params: topic_id của từ đúng, id của từ đúng, id của từ đúng (global), hanzi của từ đúng
        wrong_rows = fetchall(conn, query_wrong, (chosen['topic_id'], chosen['id'], chosen['id'], chosen['hanzi']))

        # 4. ĐẾM TỔNG SỐ TỪ TRONG TOPIC (Cố định giá trị này)
        count_row = fetchone(conn, f"SELECT COUNT(*) as count FROM vocabulary v {where_clause}", params)
        total_in_topic = count_row['count'] if count_row else 0

    # 5. Đóng gói Options
    options = []
    # Đáp án đúng
    options.append({
        'hanzi': chosen['hanzi'],
        'pinyin': chosen['pinyin'],
        'vietnamese': chosen['vietnamese'],
        'correct': True
    })
    # Đáp án sai
    for w in wrong_rows:
        options.append({
            'hanzi': w['hanzi'],
            'pinyin': w['pinyin'],
            'vietnamese': w['vietnamese'],
            'correct': False
        })
    
    # Trộn ngẫu nhiên vị trí các câu trả lời
    random.shuffle(options)

    # 6. Response (Đã fix tên biến total)
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
        "total": total_in_topic, # Dùng đúng tên biến đã lấy từ DB
        "options": options
    })

@quiz_bp.route('/api/quiz/sentence')
@require_login
def quiz_sentence():
    u = session['user']
    tid = request.args.get('topic_id')
    
    # 1. Xử lý danh sách loại trừ (exclude) để không bị lặp lại câu vừa làm
    exclude_str = request.args.get('exclude', '').strip()
    exclude_ids = [int(x) for x in exclude_str.split(',') if x.isdigit()]
    exclude_tuple = tuple(exclude_ids) if exclude_ids else (-1,)
    
    chosen = None
    total_count = 0

    with db_conn() as conn:
        # 2. Xây dựng điều kiện lọc (Filter)
        conds, params = [], []
        if u['role'] == 'admin':
            conds.append("s.owner_id IS NULL")
        else:
            conds.append("(s.owner_id IS NULL OR s.owner_id = %s)")
            params.append(u['id'])
            
        if tid:
            conds.append("s.topic_id = %s")
            params.append(tid)

        where_clause = " WHERE " + " AND ".join(conds)

        # 3. Truy vấn lấy 1 câu ngẫu nhiên (Tối ưu: Không load all)
        # Ưu tiên lấy câu chưa nằm trong danh sách exclude
        query_chosen = f"""
            SELECT s.*, t.name as topic_name 
            FROM sentences s
            JOIN topics t ON t.id = s.topic_id
            {where_clause} AND s.id NOT IN %s
            ORDER BY RANDOM() LIMIT 1
        """
        chosen_row = fetchone(conn, query_chosen, params + [exclude_tuple])

        # Nếu đã làm hết (exclude chứa toàn bộ ID), thì Reset lấy lại ngẫu nhiên bất kỳ
        if not chosen_row:
            query_reset = f"""
                SELECT s.*, t.name as topic_name 
                FROM sentences s
                JOIN topics t ON t.id = s.topic_id
                {where_clause}
                ORDER BY RANDOM() LIMIT 1
            """
            chosen_row = fetchone(conn, query_reset, params)

        if not chosen_row:
            return jsonify({'error': 'Không tìm thấy câu nào'}), 404
        
        chosen = dict(chosen_row)

        # 4. Truy vấn lấy tổng số câu (Chỉ đếm, không load data)
        count_res = fetchone(conn, f"SELECT COUNT(*) as count FROM sentences s {where_clause}", params)
        total_count = count_res['count'] if count_res else 0

    # 5. Logic đảo từ (Giữ nguyên theo yêu cầu của bạn: đảo từng ký tự)
    chars = list(chosen['hanzi'])
    random.shuffle(chars)

    # 6. Trả về kết quả (Format chuẩn theo JSON bạn gửi)
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
        "total": total_count
    })

@quiz_bp.route('/api/scores', methods=['POST'])
@require_login
def save_score():
    u = session['user']
    d = request.json
    streak = int(d.get('streak', 0))
    topic_id = d.get('topic_id') or None
    quiz_type = d.get('quiz_type', 'vocab')
    if streak <= 0: return jsonify({'success': True})
    with db_conn() as conn:
        execute(conn, "INSERT INTO scores (user_id,topic_id,quiz_type,streak) VALUES (%s,%s,%s,%s)",
            (u['id'], topic_id, quiz_type, streak))
    return jsonify({'success': True})

@quiz_bp.route('/api/leaderboard')
@require_login
def leaderboard():
    topic_id = request.args.get('topic_id') or None
    quiz_type = request.args.get('quiz_type', 'all')
    period = request.args.get('period', 'all') 

    with db_conn() as conn:
        params = []

        # SỬA: Cú pháp ngày tháng của PostgreSQL
        date_filter = ""
        if period == 'today':
            date_filter = "AND s.recorded_at::date = CURRENT_DATE"
        elif period == 'week':
            date_filter = "AND s.recorded_at >= CURRENT_DATE - INTERVAL '7 days'"
        elif period == 'month':
            date_filter = "AND s.recorded_at >= CURRENT_DATE - INTERVAL '30 days'"

    topic_filter = ""
    if topic_id:
        topic_filter = "AND s.topic_id = %s"
        params.append(topic_id)
    
    type_filter = ""
    if quiz_type != 'all':
        type_filter = "AND s.quiz_type = %s"
        params.append(quiz_type)

    # SỬA: Dùng fetchall helper thay vì conn.execute
    query = f"""
        SELECT u.username, u.role, MAX(s.streak) as best_streak,
               COUNT(s.id) as attempts,
               MAX(s.recorded_at)::date as last_date
        FROM scores s
        JOIN users u ON u.id = s.user_id
        WHERE 1=1 {topic_filter} {type_filter} {date_filter}
        GROUP BY s.user_id, u.username, u.role
        ORDER BY best_streak DESC
        LIMIT 20
    """
    rows = fetchall(conn, query, params)
    return jsonify([dict(r) for r in rows])

@quiz_bp.route('/api/errors', methods=['POST'])
@require_login
def record_error():
    u = session['user']
    d = request.json
    with db_conn() as conn:
    # PostgreSQL sử dụng cú pháp ON CONFLICT hơi khác một chút (cần liệt kê cột target)
        execute(conn, """
            INSERT INTO word_errors (user_id, word_ref, quiz_type, error_count)
            VALUES (%s, %s, %s, 1)
            ON CONFLICT (user_id, word_ref, quiz_type)
            DO UPDATE SET error_count = word_errors.error_count + 1
        """, (u['id'], d['word_ref'], d['quiz_type']))
    return jsonify({'success': True})

@quiz_bp.route('/api/errors/<word_ref>')
@require_login
def get_error(word_ref):
    u = session['user']
    with db_conn() as conn:
    # SỬA: Dùng fetchall helper
        rows = fetchall(conn, 
            "SELECT quiz_type, error_count FROM word_errors WHERE user_id=%s AND word_ref=%s",
            (u['id'], word_ref)
        )
    total = sum(r['error_count'] for r in rows)
    return jsonify({'total': total, 'detail': [dict(r) for r in rows]})