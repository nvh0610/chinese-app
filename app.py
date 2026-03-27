from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, init_db
from functools import wraps
import random

app = Flask(__name__)
app.secret_key = 'chinese_secret_2024_xyz'

with app.app_context():
    init_db()

# ── Decorators ────────────────────────────────────────────────────────────────

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

# ── Pages ─────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

# ── Auth ──────────────────────────────────────────────────────────────────────

@app.route('/api/me')
def me():
    return jsonify({'user': session.get('user')})

@app.route('/api/login', methods=['POST'])
def login():
    d = request.json
    db = get_db()
    u = db.execute("SELECT * FROM users WHERE username=?", (d.get('username','').strip(),)).fetchone()
    db.close()
    if u and check_password_hash(u['password'], d.get('password','')):
        session['user'] = {'id': u['id'], 'username': u['username'], 'role': u['role']}
        return jsonify({'success': True, 'user': session['user']})
    return jsonify({'success': False, 'error': 'Sai tên đăng nhập hoặc mật khẩu'})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

# ── Users (admin only) ────────────────────────────────────────────────────────

@app.route('/api/users', methods=['GET'])
@require_admin
def get_users():
    db = get_db()
    users = db.execute("SELECT id, username, role, created_at FROM users ORDER BY created_at").fetchall()
    db.close()
    return jsonify([dict(u) for u in users])

@app.route('/api/users', methods=['POST'])
@require_admin
def create_user():
    d = request.json
    username = d.get('username','').strip()
    password = d.get('password','').strip()
    role = d.get('role','user')
    if not username or not password:
        return jsonify({'error': 'Thiếu thông tin'}), 400
    db = get_db()
    try:
        db.execute("INSERT INTO users (username,password,role) VALUES (?,?,?)",
                   (username, generate_password_hash(password), role))
        db.commit()
        u = db.execute("SELECT id,username,role,created_at FROM users WHERE username=?", (username,)).fetchone()
        db.close()
        return jsonify({'success': True, 'user': dict(u)})
    except Exception:
        db.close()
        return jsonify({'error': 'Tên đăng nhập đã tồn tại'}), 400

@app.route('/api/users/<int:uid>', methods=['PUT'])
@require_admin
def update_user(uid):
    d = request.json
    db = get_db()
    if d.get('password'):
        db.execute("UPDATE users SET password=?, role=? WHERE id=?",
                   (generate_password_hash(d['password']), d.get('role','user'), uid))
    else:
        db.execute("UPDATE users SET role=? WHERE id=?", (d.get('role','user'), uid))
    db.commit()
    db.close()
    return jsonify({'success': True})

@app.route('/api/users/<int:uid>', methods=['DELETE'])
@require_admin
def delete_user(uid):
    if uid == session['user']['id']:
        return jsonify({'error': 'Không thể xóa tài khoản đang dùng'}), 400
    db = get_db()
    db.execute("DELETE FROM users WHERE id=?", (uid,))
    db.commit()
    db.close()
    return jsonify({'success': True})

# ── Topics ────────────────────────────────────────────────────────────────────

@app.route('/api/topics', methods=['GET'])
@require_login
def get_topics():
    u = session['user']
    db = get_db()
    # Public + own private
    if u['role'] == 'admin':
        rows = db.execute("""
            SELECT t.*, COUNT(DISTINCT v.id) vc, COUNT(DISTINCT s.id) sc,
                   CASE WHEN t.owner_id IS NULL THEN 'public' ELSE 'private' END as scope,
                   u.username as owner_name
            FROM topics t
            LEFT JOIN vocabulary v ON v.topic_id=t.id
            LEFT JOIN sentences s ON s.topic_id=t.id
            LEFT JOIN users u ON u.id=t.owner_id
            GROUP BY t.id ORDER BY t.owner_id IS NULL DESC, t.name
        """).fetchall()
    else:
        rows = db.execute("""
            SELECT t.*, COUNT(DISTINCT v.id) vc, COUNT(DISTINCT s.id) sc,
                   CASE WHEN t.owner_id IS NULL THEN 'public' ELSE 'private' END as scope,
                   u.username as owner_name
            FROM topics t
            LEFT JOIN vocabulary v ON v.topic_id=t.id
            LEFT JOIN sentences s ON s.topic_id=t.id
            LEFT JOIN users u ON u.id=t.owner_id
            WHERE t.owner_id IS NULL OR t.owner_id=?
            GROUP BY t.id ORDER BY t.owner_id IS NULL DESC, t.name
        """, (u['id'],)).fetchall()
    db.close()
    result = []
    for r in rows:
        row = dict(r)
        row['vocab_count'] = row.pop('vc')
        row['sentence_count'] = row.pop('sc')
        result.append(row)
    return jsonify(result)

@app.route('/api/topics', methods=['POST'])
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

@app.route('/api/topics/<int:tid>', methods=['PUT'])
@require_login
def update_topic(tid):
    u = session['user']
    db = get_db()
    t = db.execute("SELECT * FROM topics WHERE id=?", (tid,)).fetchone()
    if not t:
        db.close(); return jsonify({'error': 'Không tìm thấy'}), 404
    if u['role'] != 'admin' and t['owner_id'] != u['id']:
        db.close(); return jsonify({'error': 'Không có quyền'}), 403
    d = request.json
    db.execute("UPDATE topics SET name=?,description=? WHERE id=?",
               (d.get('name','').strip(), d.get('description','').strip(), tid))
    db.commit(); db.close()
    return jsonify({'success': True})

@app.route('/api/topics/<int:tid>', methods=['DELETE'])
@require_login
def delete_topic(tid):
    u = session['user']
    db = get_db()
    t = db.execute("SELECT * FROM topics WHERE id=?", (tid,)).fetchone()
    if not t:
        db.close(); return jsonify({'error': 'Không tìm thấy'}), 404
    if u['role'] != 'admin' and t['owner_id'] != u['id']:
        db.close(); return jsonify({'error': 'Không có quyền'}), 403
    db.execute("DELETE FROM topics WHERE id=?", (tid,))
    db.commit(); db.close()
    return jsonify({'success': True})

# ── Vocabulary ────────────────────────────────────────────────────────────────

def vocab_query(user, topic_id=None):
    db = get_db()
    base = """SELECT v.*, t.name as topic_name,
              CASE WHEN v.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
              FROM vocabulary v JOIN topics t ON t.id=v.topic_id"""
    if user['role'] == 'admin':
        if topic_id:
            rows = db.execute(base+" WHERE v.topic_id=? ORDER BY v.hanzi",(topic_id,)).fetchall()
        else:
            rows = db.execute(base+" ORDER BY t.name,v.hanzi").fetchall()
    else:
        if topic_id:
            rows = db.execute(base+" WHERE v.topic_id=? AND (v.owner_id IS NULL OR v.owner_id=?) ORDER BY v.hanzi",
                              (topic_id, user['id'])).fetchall()
        else:
            rows = db.execute(base+" WHERE v.owner_id IS NULL OR v.owner_id=? ORDER BY t.name,v.hanzi",
                              (user['id'],)).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.route('/api/vocabulary')
@require_login
def get_vocabulary():
    u = session['user']
    tid = request.args.get('topic_id')
    return jsonify(vocab_query(u, tid))

@app.route('/api/vocabulary/count')
@require_login
def vocab_count():
    u = session['user']
    tid = request.args.get('topic_id')
    rows = vocab_query(u, tid)
    return jsonify({'count': len(rows)})

@app.route('/api/vocabulary', methods=['POST'])
@require_login
def create_vocabulary():
    u = session['user']
    d = request.json
    for f in ['topic_id','hanzi','pinyin','vietnamese']:
        if not str(d.get(f,'')).strip():
            return jsonify({'error': f'Thiếu {f}'}), 400
    owner_id = None if u['role'] == 'admin' else u['id']
    db = get_db()
    db.execute("""INSERT INTO vocabulary
        (topic_id,hanzi,pinyin,vietnamese,example_sentence,example_pinyin,example_vietnamese,owner_id)
        VALUES (?,?,?,?,?,?,?,?)""", (
        d['topic_id'], d['hanzi'].strip(), d['pinyin'].strip(), d['vietnamese'].strip(),
        d.get('example_sentence','').strip(), d.get('example_pinyin','').strip(),
        d.get('example_vietnamese','').strip(), owner_id))
    db.commit()
    vid = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    row = db.execute("SELECT v.*,t.name as topic_name FROM vocabulary v JOIN topics t ON t.id=v.topic_id WHERE v.id=?",(vid,)).fetchone()
    db.close()
    return jsonify({'success': True, 'vocabulary': dict(row)})

@app.route('/api/vocabulary/<int:vid>', methods=['PUT'])
@require_login
def update_vocabulary(vid):
    u = session['user']
    db = get_db()
    v = db.execute("SELECT * FROM vocabulary WHERE id=?",(vid,)).fetchone()
    if not v: db.close(); return jsonify({'error':'Không tìm thấy'}),404
    if u['role'] != 'admin' and v['owner_id'] != u['id']:
        db.close(); return jsonify({'error':'Không có quyền'}),403
    d = request.json
    db.execute("""UPDATE vocabulary SET topic_id=?,hanzi=?,pinyin=?,vietnamese=?,
        example_sentence=?,example_pinyin=?,example_vietnamese=? WHERE id=?""",
        (d['topic_id'],d['hanzi'],d['pinyin'],d['vietnamese'],
         d.get('example_sentence',''),d.get('example_pinyin',''),d.get('example_vietnamese',''),vid))
    db.commit(); db.close()
    return jsonify({'success': True})

@app.route('/api/vocabulary/<int:vid>', methods=['DELETE'])
@require_login
def delete_vocabulary(vid):
    u = session['user']
    db = get_db()
    v = db.execute("SELECT * FROM vocabulary WHERE id=?",(vid,)).fetchone()
    if not v: db.close(); return jsonify({'error':'Không tìm thấy'}),404
    if u['role'] != 'admin' and v['owner_id'] != u['id']:
        db.close(); return jsonify({'error':'Không có quyền'}),403
    db.execute("DELETE FROM vocabulary WHERE id=?",(vid,))
    db.commit(); db.close()
    return jsonify({'success': True})

# ── Sentences ─────────────────────────────────────────────────────────────────

def sent_query(user, topic_id=None):
    db = get_db()
    base = """SELECT s.*, t.name as topic_name,
              CASE WHEN s.owner_id IS NULL THEN 'public' ELSE 'private' END as scope
              FROM sentences s JOIN topics t ON t.id=s.topic_id"""
    if user['role'] == 'admin':
        if topic_id:
            rows = db.execute(base+" WHERE s.topic_id=? ORDER BY s.created_at DESC",(topic_id,)).fetchall()
        else:
            rows = db.execute(base+" ORDER BY t.name").fetchall()
    else:
        if topic_id:
            rows = db.execute(base+" WHERE s.topic_id=? AND (s.owner_id IS NULL OR s.owner_id=?) ORDER BY s.created_at DESC",
                              (topic_id, user['id'])).fetchall()
        else:
            rows = db.execute(base+" WHERE s.owner_id IS NULL OR s.owner_id=? ORDER BY t.name",
                              (user['id'],)).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.route('/api/sentences')
@require_login
def get_sentences():
    u = session['user']
    tid = request.args.get('topic_id')
    return jsonify(sent_query(u, tid))

@app.route('/api/sentences', methods=['POST'])
@require_login
def create_sentence():
    u = session['user']
    d = request.json
    if not d.get('topic_id') or not d.get('hanzi','').strip() or not d.get('vietnamese','').strip():
        return jsonify({'error':'Thiếu thông tin bắt buộc'}),400
    owner_id = None if u['role'] == 'admin' else u['id']
    db = get_db()
    db.execute("INSERT INTO sentences (topic_id,hanzi,pinyin,vietnamese,owner_id) VALUES (?,?,?,?,?)",
               (d['topic_id'],d['hanzi'].strip(),d.get('pinyin','').strip(),d['vietnamese'].strip(),owner_id))
    db.commit()
    sid = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    row = db.execute("SELECT s.*,t.name as topic_name FROM sentences s JOIN topics t ON t.id=s.topic_id WHERE s.id=?",(sid,)).fetchone()
    db.close()
    return jsonify({'success': True, 'sentence': dict(row)})

@app.route('/api/sentences/<int:sid>', methods=['DELETE'])
@require_login
def delete_sentence(sid):
    u = session['user']
    db = get_db()
    s = db.execute("SELECT * FROM sentences WHERE id=?",(sid,)).fetchone()
    if not s: db.close(); return jsonify({'error':'Không tìm thấy'}),404
    if u['role'] != 'admin' and s['owner_id'] != u['id']:
        db.close(); return jsonify({'error':'Không có quyền'}),403
    db.execute("DELETE FROM sentences WHERE id=?",(sid,))
    db.commit(); db.close()
    return jsonify({'success': True})

# ── Quiz ──────────────────────────────────────────────────────────────────────

@app.route('/api/quiz/vocab')
@require_login
def quiz_vocab():
    u = session['user']
    tid = request.args.get('topic_id')
    exclude = [int(x) for x in request.args.get('exclude','').split(',') if x]
    all_v = vocab_query(u, tid)
    avail = [v for v in all_v if v['id'] not in exclude]
    if not avail: avail = all_v
    if not avail: return jsonify({'error':'Không có từ vựng'}),404
    chosen = random.choice(avail)
    others = [v for v in all_v if v['id'] != chosen['id']]
    wrong = random.sample(others, min(3, len(others)))
    opts = [{'hanzi':w['hanzi'],'pinyin':w['pinyin'],'correct':False} for w in wrong]
    opts.append({'hanzi':chosen['hanzi'],'pinyin':chosen['pinyin'],'correct':True})
    random.shuffle(opts)
    return jsonify({**chosen, 'options': opts, 'total': len(all_v)})

@app.route('/api/quiz/sentence')
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
