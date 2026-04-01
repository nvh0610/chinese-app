from flask import Blueprint, request, jsonify, session
from database import get_db, fetchone, fetchall, execute, insert_returning_id
from .helpers import require_login

topics_bp = Blueprint('topics', __name__)

@topics_bp.route('/api/topics')
@require_login
def get_topics():
    u = session['user']
    search = request.args.get('search', '').strip()
    page = int(request.args.get('page', 1))
    per_page = 20
    conn = get_db()

    conds, params = [], []

    if u['role'] == 'admin':
        conds.append("t.owner_id IS NULL")
    else:
        # Dùng %s cho Postgres
        conds.append("(t.owner_id IS NULL OR t.owner_id = %s)")
        params.append(u['id'])

    if search:
        conds.append("(t.name ILIKE %s OR t.description ILIKE %s)")
        params += [f'%{search}%', f'%{search}%']

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
    row_total = fetchone(conn, f"SELECT COUNT(*) as count FROM topics t {where}", params)
    total = row_total['count'] if row_total else 0
    offset = (page - 1) * per_page

    # FIX LỖI GROUP BY: Phải thêm t.id và u.username vào GROUP BY
    rows = fetchall(conn, f"""
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
        GROUP BY t.id, u.username 
        ORDER BY (t.owner_id IS NULL) DESC, t.name
        LIMIT %s OFFSET %s
    """, params + [per_page, offset])
    
    conn.close()

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
    conn = get_db()
    
    if u['role'] == 'admin':
        query = """
            SELECT id, name, owner_id, 'admin_own' as scope 
            FROM topics 
            WHERE owner_id IS NULL OR owner_id = %s
            ORDER BY name
        """
        rows = fetchall(conn, query, (u['id'],))
    else:
        query = """
            SELECT id, name, owner_id,
                   CASE 
                        WHEN owner_id IS NULL THEN 'public'
                        WHEN owner_id = %s THEN 'private'
                        ELSE 'official' 
                   END as scope
            FROM topics 
            WHERE owner_id IS NULL 
               OR owner_id = %s 
               OR owner_id IN (SELECT id FROM users WHERE role = 'admin')
            ORDER BY owner_id IS NULL DESC, (owner_id IN (SELECT id FROM users WHERE role = 'admin')) DESC, name
        """
        rows = fetchall(conn, query, (u['id'], u['id']))

    conn.close()
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
    conn = get_db()
    try:
        # SỬA: Postgres dùng RETURNING, không dùng rowid/last_insert_rowid
        new_id = insert_returning_id(conn, 
            "INSERT INTO topics (name, description, owner_id) VALUES (%s, %s, %s)",
            (name, d.get('description','').strip(), owner_id))
        conn.commit()
        
        t = fetchone(conn, "SELECT * FROM topics WHERE id = %s", (new_id,))
        conn.close()
        return jsonify({'success': True, 'topic': dict(t)})
    except Exception as e:
        print(f"Error create_topic: {e}")
        conn.close()
        return jsonify({'error': 'Lỗi tạo chủ đề'}), 400

@topics_bp.route('/api/topics/<int:tid>', methods=['PUT'])
@require_login
def update_topic(tid):
    u = session['user']
    conn = get_db()
    t = fetchone(conn, "SELECT * FROM topics WHERE id=%s",(tid,))
    if not t: conn.close(); return jsonify({'error': 'Không tìm thấy'}), 404
    if u['role'] != 'admin' and t['owner_id'] != u['id']:
        conn.close(); return jsonify({'error': 'Không có quyền'}), 403
    d = request.json
    execute(conn, "UPDATE topics SET name=%s, description=%s WHERE id=%s",
               (d.get('name','').strip(), d.get('description','').strip(), tid))
    conn.commit(); conn.close()
    return jsonify({'success': True})

@topics_bp.route('/api/topics/<int:tid>', methods=['DELETE'])
@require_login
def delete_topic(tid):
    u = session['user']
    conn = get_db()
    t = fetchone(conn, "SELECT * FROM topics WHERE id=%s",(tid,))
    if not t: conn.close(); return jsonify({'error': 'Không tìm thấy'}), 404
    if u['role'] != 'admin' and t['owner_id'] != u['id']:
        conn.close(); return jsonify({'error': 'Không có quyền'}), 403
    execute(conn, "DELETE FROM topics WHERE id=%s",(tid,))
    conn.commit(); conn.close()
    return jsonify({'success': True})