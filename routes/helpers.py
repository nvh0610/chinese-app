from flask import session, jsonify
from functools import wraps
from database import get_db, fetchone, fetchall, execute

def require_login(f):
    @wraps(f)
    def d(*a, **kw):
        if not session.get('user'):
            return jsonify({'error': 'Chưa đăng nhập'}), 401
        return f(*a, **kw)
    return d

def require_admin(f):
    @wraps(f)
    def d(*a, **kw):
        u = session.get('user')
        if not u or u['role'] != 'admin':
            return jsonify({'error': 'Không có quyền'}), 403
        return f(*a, **kw)
    return d

def vocab_query(user, topic_id=None, page=1, per_page=20, search=''):
    conn = get_db()
    base = """SELECT v.*, t.name as topic_name,
              CASE WHEN v.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
              FROM vocabulary v 
              JOIN topics t ON t.id = v.topic_id"""
    
    conds, params = [], []

    if user['role'] == 'admin':
        conds.append("v.owner_id IS NULL")
    else:
        # Postgres dùng %s
        conds.append("(v.owner_id IS NULL OR v.owner_id = %s)")
        params.append(user['id'])

    if topic_id:
        conds.append("v.topic_id = %s")
        params.append(topic_id)
        
    if search:
        conds.append("(v.hanzi LIKE %s OR v.vietnamese LIKE %s OR v.pinyin LIKE %s)")
        params += [f'%{search}%', f'%{search}%', f'%{search}%']

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
    # Tính tổng bản ghi
    total_query = f"SELECT COUNT(*) as count FROM vocabulary v JOIN topics t ON t.id = v.topic_id {where}"
    total_row = fetchone(conn, total_query, params)
    total = total_row['count'] if total_row else 0
    
    # Lấy dữ liệu phân trang - Đổi LIMIT ? OFFSET ? thành %s
    offset = (page - 1) * per_page
    rows = fetchall(conn, f"{base} {where} ORDER BY t.name, v.hanzi LIMIT %s OFFSET %s", 
                    params + [per_page, offset])
    
    conn.close()
    return [dict(r) for r in rows], total

def vocab_query_all(user, topic_id=None):
    """Đã fix: Dùng fetchall helper và đổi ? thành %s"""
    conn = get_db()
    base = """SELECT v.*, t.name as topic_name,
              CASE WHEN v.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
              FROM vocabulary v 
              JOIN topics t ON t.id = v.topic_id"""
    
    conds, params = [], []

    if user['role'] == 'admin':
        conds.append("v.owner_id IS NULL")
    else:
        conds.append("(v.owner_id IS NULL OR v.owner_id = %s)")
        params.append(user['id'])

    if topic_id:
        conds.append("v.topic_id = %s")
        params.append(topic_id)

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
    query = f"{base} {where} ORDER BY t.name, v.hanzi"
    
    # SỬA TẠI ĐÂY: Dùng fetchall thay vì conn.execute
    rows = fetchall(conn, query, params)
    
    conn.close()
    return [dict(r) for r in rows]

def sent_query(user, topic_id=None):
    conn = get_db()
    base = """SELECT s.*, t.name as topic_name,
              CASE WHEN s.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
              FROM sentences s 
              JOIN topics t ON t.id = s.topic_id"""
    
    conds, params = [], []

    if user['role'] == 'admin':
        conds.append("s.owner_id IS NULL")
    else:
        conds.append("(s.owner_id IS NULL OR s.owner_id = %s)")
        params.append(user['id'])

    if topic_id:
        conds.append("s.topic_id = %s")
        params.append(topic_id)

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
    query = f"{base} {where} ORDER BY t.name"
    rows = fetchall(conn, query, params)
    
    conn.close()
    return [dict(r) for r in rows]