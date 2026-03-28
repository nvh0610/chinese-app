from flask import session, jsonify
from functools import wraps
from database import get_db

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
    db = get_db()
    # Base query giữ nguyên nhưng tôi thêm alias 'v' và 't' cho rõ ràng
    base = """SELECT v.*, t.name as topic_name,
              CASE WHEN v.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
              FROM vocabulary v 
              JOIN topics t ON t.id = v.topic_id"""
    
    conds, params = [], []

    # --- SỬA LOGIC PHÂN QUYỀN Ở ĐÂY ---
    if user['role'] == 'admin':
        # Admin: CHỈ thấy từ vựng của hệ thống (owner_id IS NULL)
        conds.append("v.owner_id IS NULL")
    else:
        # User: Thấy từ vựng của chính mình HOẶC của hệ thống (Admin tạo)
        conds.append("(v.owner_id IS NULL OR v.owner_id = ?)")
        params.append(user['id'])
    # ----------------------------------

    if topic_id:
        conds.append("v.topic_id = ?")
        params.append(topic_id)
        
    if search:
        # Thêm dấu ngoặc bao quanh các điều kiện OR để không làm hỏng logic AND bên ngoài
        conds.append("(v.hanzi LIKE ? OR v.vietnamese LIKE ? OR v.pinyin LIKE ?)")
        params += [f'%{search}%', f'%{search}%', f'%{search}%']

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
    # Tính tổng bản ghi (Count)
    total_query = f"SELECT COUNT(*) FROM vocabulary v JOIN topics t ON t.id = v.topic_id {where}"
    total = db.execute(total_query, params).fetchone()[0]
    
    # Lấy dữ liệu phân trang
    offset = (page - 1) * per_page
    rows = db.execute(f"{base} {where} ORDER BY t.name, v.hanzi LIMIT ? OFFSET ?", 
                      params + [per_page, offset]).fetchall()
    
    db.close()
    return [dict(r) for r in rows], total

def vocab_query_all(user, topic_id=None):
    """Không phân trang, dùng cho Quiz - Đã fix phân quyền Admin/User"""
    db = get_db()
    base = """SELECT v.*, t.name as topic_name,
              CASE WHEN v.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
              FROM vocabulary v 
              JOIN topics t ON t.id = v.topic_id"""
    
    conds, params = [], []

    # --- ĐỒNG BỘ LOGIC PHÂN QUYỀN ---
    if user['role'] == 'admin':
        # Admin: Chỉ lấy từ vựng hệ thống (owner_id IS NULL)
        conds.append("v.owner_id IS NULL")
    else:
        # User: Lấy từ vựng hệ thống + từ vựng của chính mình
        conds.append("(v.owner_id IS NULL OR v.owner_id = ?)")
        params.append(user['id'])
    # --------------------------------

    if topic_id:
        conds.append("v.topic_id = ?")
        params.append(topic_id)

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
    # Thực thi query - Nhớ thêm khoảng trắng trước {where}
    query = f"{base} {where} ORDER BY t.name, v.hanzi"
    rows = db.execute(query, params).fetchall()
    
    db.close()
    return [dict(r) for r in rows]

def sent_query(user, topic_id=None):
    db = get_db()
    base = """SELECT s.*, t.name as topic_name,
              CASE WHEN s.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
              FROM sentences s 
              JOIN topics t ON t.id = s.topic_id"""
    
    conds, params = [], []

    # --- ĐỒNG BỘ LOGIC PHÂN QUYỀN ---
    if user['role'] == 'admin':
        # Admin: CHỈ thấy các câu ví dụ hệ thống (owner_id IS NULL)
        conds.append("s.owner_id IS NULL")
    else:
        # User: Thấy câu ví dụ của hệ thống HOẶC của chính mình
        conds.append("(s.owner_id IS NULL OR s.owner_id = ?)")
        params.append(user['id'])
    # --------------------------------

    if topic_id:
        conds.append("s.topic_id = ?")
        params.append(topic_id)

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
    # Thực thi query - Nhớ thêm khoảng trắng trước {where} để tránh dính chữ
    query = f"{base} {where} ORDER BY t.name"
    rows = db.execute(query, params).fetchall()
    
    db.close()
    return [dict(r) for r in rows]