from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash
from database import get_db
from datetime import date, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, timedelta

auth_bp = Blueprint('auth', __name__)

def is_account_active(user):
    if not user['is_active']:
        return False, 'Tài khoản đã bị vô hiệu hóa'
    today = date.today().isoformat()
    if user['active_from'] and today < user['active_from']:
        return False, f'Tài khoản chưa được kích hoạt (từ {user["active_from"]})'
    if user['active_until'] and today > user['active_until']:
        return False, f'Tài khoản đã hết hạn (đến {user["active_until"]})'
    return True, None

@auth_bp.route('/api/me')
def me():
    return jsonify({'user': session.get('user')})

@auth_bp.route('/api/login', methods=['POST'])
def login():
    d = request.json
    db = get_db()
    u = db.execute("SELECT * FROM users WHERE username=?", (d.get('username','').strip(),)).fetchone()
    db.close()
    if not u:
        return jsonify({'success': False, 'error': 'Sai tên đăng nhập hoặc mật khẩu'})
    if not check_password_hash(u['password'], d.get('password','')):
        return jsonify({'success': False, 'error': 'Sai tên đăng nhập hoặc mật khẩu'})
    ok, msg = is_account_active(u)
    if not ok:
        return jsonify({'success': False, 'error': msg})
    session['user'] = {'id': u['id'], 'username': u['username'], 'role': u['role']}
    return jsonify({'success': True, 'user': session['user']})

@auth_bp.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@auth_bp.route('/api/register', methods=['POST'])
def register():
    d = request.json
    username = d.get('username', '').strip()
    password = d.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': 'Thiếu thông tin'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Tên đăng nhập tối thiểu 3 ký tự'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Mật khẩu tối thiểu 6 ký tự'}), 400

    today = date.today()
    expire = today + timedelta(days=15)

    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username,password,role,is_active,active_from,active_until) VALUES (?,?,?,?,?,?)",
            (username, generate_password_hash(password), 'user', 1,
             today.isoformat(), expire.isoformat())
        )
        db.commit()
        db.close()
        return jsonify({'success': True, 'expire': expire.isoformat()})
    except Exception:
        db.close()
        return jsonify({'error': 'Tên đăng nhập đã tồn tại'}), 400