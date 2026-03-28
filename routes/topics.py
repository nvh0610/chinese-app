from flask import Blueprint, request, jsonify, session
from database import get_db
from .helpers import require_login

topics_bp = Blueprint('topics', __name__)

@topics_bp.route('/api/topics')
@require_login
def get_topics():
    u = session['user']
    search = request.args.get('search', '').strip()
    page = int(request.args.get('page', 1))
    per_page = 20
    db = get_db()

    conds, params = [], []

    # --- SỬA LOGIC PHÂN QUYỀN TẠI ĐÂY ---
    if u['role'] == 'admin':
        # Admin: CHỈ xem những gì do Admin tạo (owner_id là NULL)
        conds.append("t.owner_id IS NULL")
    else:
        # User: Xem của chính mình (t.owner_id=?) HOẶC của Admin (t.owner_id IS NULL)
        conds.append("(t.owner_id IS NULL OR t.owner_id = ?)")
        params.append(u['id'])
    # ------------------------------------

    if search:
        conds.append("(t.name LIKE ? OR t.description LIKE ?)")
        params += [f'%{search}%', f'%{search}%']

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
    # Tính tổng bản ghi để phân trang dựa trên điều kiện lọc
    total = db.execute(f"SELECT COUNT(*) FROM topics t {where}", params).fetchone()[0]
    offset = (page - 1) * per_page

    # Câu lệnh lấy dữ liệu chi tiết
    # Lưu ý: params ở đây bao gồm cả tham số search/user_id + per_page và offset
    rows = db.execute(f"""
        SELECT t.*, 
               COUNT(DISTINCT v.id) vc, 
               COUNT(DISTINCT s.id) sc,
               CASE WHEN t.owner_id IS NULL THEN 'public' ELSE 'private' END as scope,
               u.username as owner_name
        FROM topics t
        LEFT JOIN vocabulary v ON v.topic_id = t.id
        LEFT JOIN sentences s ON s.topic_id = t.id
        LEFT JOIN users u ON u.id = t.owner_id
        {where}
        GROUP BY t.id 
        ORDER BY t.owner_id IS NULL DESC, t.name
        LIMIT ? OFFSET ?
    """, params + [per_page, offset]).fetchall()
    
    db.close()

    result = []
    for r in rows:
        row = dict(r)
        row['vocab_count'] = row.pop('vc')
        row['sentence_count'] = row.pop('sc')
        result.append(row)

    return jsonify({'topics': result, 'total': total, 'page': page, 'per_page': per_page})

@topics_bp.route('/api/topics/all')
@require_login
def get_topics_all():
    u = session['user']
    db = get_db()
    
    if u['role'] == 'admin':
        # Admin chỉ thấy: Public (NULL) + Của chính mình
        query = """
            SELECT id, name, owner_id, 'admin_own' as scope 
            FROM topics 
            WHERE owner_id IS NULL OR owner_id = ?
            ORDER BY name
        """
        rows = db.execute(query, (u['id'],)).fetchall()
    else:
        # User thấy: Public + Của chính mình + Của TẤT CẢ các tài khoản có role 'admin'
        query = """
            SELECT id, name, owner_id,
                   CASE 
                        WHEN owner_id IS NULL THEN 'public'
                        WHEN owner_id = ? THEN 'private'
                        ELSE 'official' 
                   END as scope
            FROM topics 
            WHERE owner_id IS NULL 
               OR owner_id = ? 
               OR owner_id IN (SELECT id FROM users WHERE role = 'admin')
            ORDER BY owner_id IS NULL DESC, scope = 'official' DESC, name
        """
        rows = db.execute(query, (u['id'], u['id'])).fetchall()

    db.close()
    return jsonify([dict(r) for r in rows])

@topics_bp.route('/api/topics', methods=['POST'])
@require_login
def create_topic():
    u = session['user']
    d = request.json
    name = d.get('name','').strip()
    if not name:
        return jsonify({'error': 'Tên chủ đề không được trống'}), 400
    owner_id = None if u['role'] == 'admin' else u['id']
    db = get_db()
    try:
        db.execute("INSERT INTO topics (name,description,owner_id) VALUES (?,?,?)",
                   (name, d.get('description','').strip(), owner_id))
        db.commit()
        t = db.execute("SELECT * FROM topics WHERE rowid=last_insert_rowid()").fetchone()
        db.close()
        return jsonify({'success': True, 'topic': dict(t)})
    except Exception:
        db.close()
        return jsonify({'error': 'Lỗi tạo chủ đề'}), 400

@topics_bp.route('/api/topics/<int:tid>', methods=['PUT'])
@require_login
def update_topic(tid):
    u = session['user']
    db = get_db()
    t = db.execute("SELECT * FROM topics WHERE id=?",(tid,)).fetchone()
    if not t: db.close(); return jsonify({'error': 'Không tìm thấy'}), 404
    if u['role'] != 'admin' and t['owner_id'] != u['id']:
        db.close(); return jsonify({'error': 'Không có quyền'}), 403
    d = request.json
    db.execute("UPDATE topics SET name=?,description=? WHERE id=?",
               (d.get('name','').strip(), d.get('description','').strip(), tid))
    db.commit(); db.close()
    return jsonify({'success': True})

@topics_bp.route('/api/topics/<int:tid>', methods=['DELETE'])
@require_login
def delete_topic(tid):
    u = session['user']
    db = get_db()
    t = db.execute("SELECT * FROM topics WHERE id=?",(tid,)).fetchone()
    if not t: db.close(); return jsonify({'error': 'Không tìm thấy'}), 404
    if u['role'] != 'admin' and t['owner_id'] != u['id']:
        db.close(); return jsonify({'error': 'Không có quyền'}), 403
    db.execute("DELETE FROM topics WHERE id=?",(tid,))
    db.commit(); db.close()
    return jsonify({'success': True})
