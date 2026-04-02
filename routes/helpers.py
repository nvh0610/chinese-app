from flask import session, jsonify
from functools import wraps
from database import db_conn, fetchone, fetchall, execute

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

# def vocab_query(conn, user, topic_id=None, page=1, per_page=20, search=''):
#     base = """SELECT v.*, t.name as topic_name,
#               CASE WHEN v.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
#               FROM vocabulary v 
#               JOIN topics t ON t.id = v.topic_id"""
    
#     conds, params = [], []

#     if user['role'] == 'admin':
#         conds.append("v.owner_id IS NULL")
#     else:
#         # Postgres dùng %s
#         conds.append("(v.owner_id IS NULL OR v.owner_id = %s)")
#         params.append(user['id'])

#     if topic_id:
#         conds.append("v.topic_id = %s")
#         params.append(topic_id)
        
#     if search:
#         conds.append("(v.hanzi ILIKE %s OR v.vietnamese ILIKE %s OR v.pinyin ILIKE %s)")
#         params += [f'%{search}%', f'%{search}%', f'%{search}%']

#     where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
#     # Tính tổng bản ghi
#     total_query = f"SELECT COUNT(*) as count FROM vocabulary v JOIN topics t ON t.id = v.topic_id {where}"
#     total_row = fetchone(conn, total_query, params)
#     total = total_row['count'] if total_row else 0
    
#     # Lấy dữ liệu phân trang - Đổi LIMIT ? OFFSET ? thành %s
#     offset = (page - 1) * per_page
#     rows = fetchall(conn, f"{base} {where} ORDER BY t.name, v.hanzi LIMIT %s OFFSET %s", 
#                     params + [per_page, offset])
    
#     return [dict(r) for r in rows], total

def vocab_query(conn, user, topic_id=None, page=1, per_page=20, search='', scope=''):
    conds, params = [], []

    # 1. Quyền truy cập cơ bản
    if user['role'] == 'admin':
        conds.append("v.owner_id IS NULL")
    else:
        conds.append("(v.owner_id IS NULL OR v.owner_id = %s)")
        params.append(user['id'])

    # 2. Lọc theo scope (Tối ưu tại đây)
    if scope == 'public':
        conds.append("v.owner_id IS NULL")
    elif scope == 'private':
        conds.append("v.owner_id IS NOT NULL")

    # 3. Lọc theo Topic
    if topic_id:
        conds.append("v.topic_id = %s")
        params.append(topic_id)
        
    # 4. Tìm kiếm
    if search:
        conds.append("(v.hanzi ILIKE %s OR v.vietnamese ILIKE %s OR v.pinyin ILIKE %s)")
        search_param = f'%{search}%'
        params += [search_param, search_param, search_param]

    where_clause = " WHERE " + " AND ".join(conds) if conds else ""
    
    # 5. Tính tổng (Chỉ JOIN khi thực sự cần thiết, ở đây JOIN t để đồng bộ với query chính nếu cần)
    total_query = f"SELECT COUNT(*) as count FROM vocabulary v {where_clause}"
    total_row = fetchone(conn, total_query, params)
    total = total_row['count'] if total_row else 0
    
    # 6. Lấy dữ liệu phân trang
    base_query = """
        SELECT v.*, t.name as topic_name,
        CASE WHEN v.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
        FROM vocabulary v 
        JOIN topics t ON t.id = v.topic_id
        {where}
        ORDER BY t.name, v.hanzi 
        LIMIT %s OFFSET %s
    """.format(where=where_clause)
    
    offset = (page - 1) * per_page
    rows = fetchall(conn, base_query, params + [per_page, offset])
    
    return [dict(r) for r in rows], total

def build_vocab_filters(user, topic_id):
    conds, params = [], []
    if user['role'] == 'admin':
        conds.append("v.owner_id IS NULL")
    else:
        conds.append("(v.owner_id IS NULL OR v.owner_id = %s)")
        params.append(user['id'])
    
    if topic_id:
        conds.append("v.topic_id = %s")
        params.append(topic_id)
        
    return " WHERE " + " AND ".join(conds), params

def vocab_query_all(conn, user, topic_id=None):
    """Đã fix: Dùng fetchall helper và đổi ? thành %s"""
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
    
    return [dict(r) for r in rows]

# def sent_query(conn, user, topic_id=None, limit=None, offset=None):
#     base = """SELECT s.*, t.name as topic_name,
#               CASE WHEN s.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
#               FROM sentences s 
#               JOIN topics t ON t.id = s.topic_id"""
    
#     conds, params = [], []

#     # Phân quyền
#     if user['role'] == 'admin':
#         conds.append("s.owner_id IS NULL")
#     else:
#         conds.append("(s.owner_id IS NULL OR s.owner_id = %s)")
#         params.append(user['id'])

#     # Lọc theo topic
#     if topic_id:
#         conds.append("s.topic_id = %s")
#         params.append(topic_id)

#     where = (" WHERE " + " AND ".join(conds)) if conds else ""
    
#     query = f"{base} {where} ORDER BY t.name"
    
#     # THÊM PHẦN PHÂN TRANG VÀO QUERY
#     if limit is not None:
#         query += " LIMIT %s"
#         params.append(limit)
#     if offset is not None:
#         query += " OFFSET %s"
#         params.append(offset)
        
#     rows = fetchall(conn, query, params)
#     return [dict(r) for r in rows]

def sent_query(conn, user, topic_id=None, page=None, per_page=None):
    conds, params = [], []

    # 1. Logic phân quyền (Dùng chung)
    if user['role'] == 'admin':
        conds.append("s.owner_id IS NULL")
    else:
        conds.append("(s.owner_id IS NULL OR s.owner_id = %s)")
        params.append(user['id'])

    # 2. Lọc theo topic (Dùng chung)
    if topic_id:
        conds.append("s.topic_id = %s")
        params.append(topic_id)

    where_clause = (" WHERE " + " AND ".join(conds)) if conds else ""

    # 3. Tính TOTAL (Chỉ JOIN khi thực sự cần thiết, ở đây COUNT không cần JOIN topics nếu không lọc theo topic name)
    count_query = f"SELECT COUNT(*) as count FROM sentences s {where_clause}"
    total_row = fetchone(conn, count_query, params)
    total = total_row['count'] if total_row else 0

    # 4. Lấy DATA
    base_query = f"""
        SELECT s.*, t.name as topic_name,
        CASE WHEN s.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
        FROM sentences s 
        JOIN topics t ON t.id = s.topic_id
        {where_clause} 
        ORDER BY t.name
    """
    
    query_params = list(params) # Copy params gốc để dùng cho data query
    
    if page and per_page:
        base_query += " LIMIT %s OFFSET %s"
        query_params.extend([per_page, (page - 1) * per_page])
        
    rows = fetchall(conn, base_query, query_params)
    return [dict(r) for r in rows], total