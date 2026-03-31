from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash
from database import get_db, fetchone, fetchall, execute
from .helpers import require_login, require_admin

users_bp = Blueprint('users', __name__)

@users_bp.route('/api/users')
@require_admin
def get_users():
    conn = get_db()
    # Query cơ bản không đổi, nhưng fetchall đã được bọc cursor bên trong database.py
    rows = fetchall(conn, "SELECT id,username,role,is_active,active_from,active_until,created_at FROM users ORDER BY created_at")
    conn.close()
    return jsonify([dict(r) for r in rows])

@users_bp.route('/api/users', methods=['POST'])
@require_admin
def create_user():
    d = request.json
    username = d.get('username','').strip()
    password = d.get('password','').strip()
    
    if not username or not password:
        return jsonify({'error': 'Thiếu thông tin'}), 400
    
    conn = get_db()
    try:
        # SỬA: Đổi ? thành %s cho PostgreSQL
        execute(conn, """
            INSERT INTO users (username, password, role, is_active, active_from, active_until) 
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            username, 
            generate_password_hash(password),
            d.get('role', 'user'),
            1 if d.get('is_active', True) else 0,
            d.get('active_from') or None,
            d.get('active_until') or None
        ))
        conn.commit()
        
        # SỬA: Đổi ? thành %s
        u = fetchone(conn, "SELECT id,username,role,is_active,active_from,active_until,created_at FROM users WHERE username=%s", (username,))
        conn.close()
        return jsonify({'success': True, 'user': dict(u)})
    except Exception as e:
        print(f"Lỗi create_user: {e}")
        conn.close()
        return jsonify({'error': 'Tên đăng nhập đã tồn tại hoặc lỗi hệ thống'}), 400

@users_bp.route('/api/users/<int:uid>', methods=['PUT'])
@require_admin
def update_user(uid):
    d = request.json
    conn = get_db()
    
    # SỬA: Đổi toàn bộ ? thành %s
    if d.get('password'):
        execute(conn, """
            UPDATE users 
            SET role=%s, is_active=%s, active_from=%s, active_until=%s, password=%s 
            WHERE id=%s
        """, (
            d.get('role', 'user'),
            1 if d.get('is_active', True) else 0,
            d.get('active_from') or None,
            d.get('active_until') or None,
            generate_password_hash(d['password']), 
            uid
        ))
    else:
        execute(conn, """
            UPDATE users 
            SET role=%s, is_active=%s, active_from=%s, active_until=%s 
            WHERE id=%s
        """, (
            d.get('role', 'user'),
            1 if d.get('is_active', True) else 0,
            d.get('active_from') or None,
            d.get('active_until') or None,
            uid
        ))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@users_bp.route('/api/users/<int:uid>', methods=['DELETE'])
@require_admin
def delete_user(uid):
    if uid == session['user']['id']:
        return jsonify({'error': 'Không thể xóa tài khoản đang dùng'}), 400
    
    conn = get_db()
    # SỬA: Đổi ? thành %s
    execute(conn, "DELETE FROM users WHERE id=%s", (uid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})