from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash
from database import get_db
from .helpers import require_login, require_admin

users_bp = Blueprint('users', __name__)

@users_bp.route('/api/users')
@require_admin
def get_users():
    db = get_db()
    rows = db.execute("SELECT id,username,role,is_active,active_from,active_until,created_at FROM users ORDER BY created_at").fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@users_bp.route('/api/users', methods=['POST'])
@require_admin
def create_user():
    d = request.json
    username = d.get('username','').strip()
    password = d.get('password','').strip()
    if not username or not password:
        return jsonify({'error': 'Thiếu thông tin'}), 400
    db = get_db()
    try:
        db.execute("INSERT INTO users (username,password,role,is_active,active_from,active_until) VALUES (?,?,?,?,?,?)",
                   (username, generate_password_hash(password),
                    d.get('role','user'),
                    1 if d.get('is_active', True) else 0,
                    d.get('active_from') or None,
                    d.get('active_until') or None))
        db.commit()
        u = db.execute("SELECT id,username,role,is_active,active_from,active_until,created_at FROM users WHERE username=?",(username,)).fetchone()
        db.close()
        return jsonify({'success': True, 'user': dict(u)})
    except Exception:
        db.close()
        return jsonify({'error': 'Tên đăng nhập đã tồn tại'}), 400

@users_bp.route('/api/users/<int:uid>', methods=['PUT'])
@require_admin
def update_user(uid):
    d = request.json
    db = get_db()
    if d.get('password'):
        db.execute("UPDATE users SET role=?,is_active=?,active_from=?,active_until=?,password=? WHERE id=?",
                   (d.get('role','user'),
                    1 if d.get('is_active', True) else 0,
                    d.get('active_from') or None,
                    d.get('active_until') or None,
                    generate_password_hash(d['password']), uid))
    else:
        db.execute("UPDATE users SET role=?,is_active=?,active_from=?,active_until=? WHERE id=?",
                   (d.get('role','user'),
                    1 if d.get('is_active', True) else 0,
                    d.get('active_from') or None,
                    d.get('active_until') or None,
                    uid))
    db.commit(); db.close()
    return jsonify({'success': True})

@users_bp.route('/api/users/<int:uid>', methods=['DELETE'])
@require_admin
def delete_user(uid):
    if uid == session['user']['id']:
        return jsonify({'error': 'Không thể xóa tài khoản đang dùng'}), 400
    db = get_db()
    db.execute("DELETE FROM users WHERE id=?", (uid,))
    db.commit(); db.close()
    return jsonify({'success': True})
