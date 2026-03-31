from flask import Blueprint, request, jsonify, session
from database import get_db, fetchone, fetchall, execute, insert_returning_id
from .helpers import require_login, vocab_query, sent_query
import pandas as pd

vocab_bp = Blueprint('vocab', __name__)

@vocab_bp.route('/api/vocabulary')
@require_login
def get_vocabulary():
    u = session['user']
    tid = request.args.get('topic_id')
    page = int(request.args.get('page', 1))
    search = request.args.get('search', '').strip()
    scope = request.args.get('scope', '')
    rows, total = vocab_query(u, tid, page, 20, search)
    if scope:
        rows = [r for r in rows if r['scope'] == scope]
    return jsonify({'items': rows, 'total': total, 'page': page})

@vocab_bp.route('/api/vocabulary', methods=['POST'])
@require_login
def create_vocabulary():
    u = session['user']
    d = request.json
    for f in ['topic_id','hanzi','pinyin','vietnamese']:
        if not str(d.get(f,'')).strip():
            return jsonify({'error': f'Thiếu {f}'}), 400
    
    owner_id = None if u['role'] == 'admin' else u['id']
    conn = get_db()
    
    # SỬA: Dùng %s và RETURNING id thông qua hàm insert_returning_id
    query = """
        INSERT INTO vocabulary
        (topic_id, hanzi, pinyin, vietnamese, example_sentence, example_pinyin, example_vietnamese, owner_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """
    params = (d['topic_id'], d['hanzi'].strip(), d['pinyin'].strip(), d['vietnamese'].strip(),
              d.get('example_sentence','').strip(), d.get('example_pinyin','').strip(),
              d.get('example_vietnamese','').strip(), owner_id)
    
    vid = insert_returning_id(conn, query, params)
    conn.commit()
    
    row = fetchone(conn, "SELECT v.*, t.name as topic_name FROM vocabulary v JOIN topics t ON t.id=v.topic_id WHERE v.id=%s", (vid,))
    conn.close()
    return jsonify({'success': True, 'vocabulary': dict(row)})

@vocab_bp.route('/api/vocabulary/import', methods=['POST'])
@require_login
def import_vocabulary():
    u = session['user']
    topic_id = request.form.get('topic_id')
    
    if not topic_id:
        return jsonify({'error': 'Thiếu topic_id'}), 400
    if 'file' not in request.files:
        return jsonify({'error': 'Không tìm thấy file'}), 400
    
    file = request.files['file']
    try:
        df = pd.read_excel(file)
        # SỬA: map() thay cho applymap() ở các bản pandas mới
        df = df.fillna('').map(lambda x: str(x).strip())

        owner_id = None if u['role'] == 'admin' else u['id']
        conn = get_db()
        count = 0
        
        for _, row in df.iterrows():
            if not row.get('hanzi') or not row.get('pinyin') or not row.get('vietnamese'):
                continue
                
            execute(conn, """
                INSERT INTO vocabulary 
                (topic_id, hanzi, pinyin, vietnamese, 
                 example_sentence, example_pinyin, example_vietnamese, owner_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                topic_id, row['hanzi'], row['pinyin'], row['vietnamese'],
                row.get('example_sentence', ''), row.get('example_pinyin', ''),
                row.get('example_vietnamese', ''), owner_id
            ))
            count += 1
            
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': f'Đã import thành công {count} từ vựng.'})
    except Exception as e:
        return jsonify({'error': f'Lỗi xử lý file: {str(e)}'}), 500

@vocab_bp.route('/api/vocabulary/<int:vid>', methods=['PUT'])
@require_login
def update_vocabulary(vid):
    u = session['user']
    conn = get_db()
    v = fetchone(conn, "SELECT * FROM vocabulary WHERE id=%s", (vid,))
    if not v: conn.close(); return jsonify({'error':'Không tìm thấy'}), 404
    if u['role'] != 'admin' and v['owner_id'] != u['id']:
        conn.close(); return jsonify({'error':'Không có quyền'}), 403
    
    d = request.json
    execute(conn, """UPDATE vocabulary SET topic_id=%s, hanzi=%s, pinyin=%s, vietnamese=%s,
        example_sentence=%s, example_pinyin=%s, example_vietnamese=%s WHERE id=%s""",
        (d['topic_id'], d['hanzi'], d['pinyin'], d['vietnamese'],
         d.get('example_sentence',''), d.get('example_pinyin',''), d.get('example_vietnamese',''), vid))
    conn.commit(); conn.close()
    return jsonify({'success': True})

@vocab_bp.route('/api/vocabulary/<int:vid>', methods=['DELETE'])
@require_login
def delete_vocabulary(vid):
    u = session['user']
    conn = get_db()
    v = fetchone(conn, "SELECT * FROM vocabulary WHERE id=%s", (vid,))
    if not v: conn.close(); return jsonify({'error':'Không tìm thấy'}), 404
    if u['role'] != 'admin' and v['owner_id'] != u['id']:
        conn.close(); return jsonify({'error':'Không có quyền'}), 403
    
    execute(conn, "DELETE FROM vocabulary WHERE id=%s", (vid,))
    conn.commit(); conn.close()
    return jsonify({'success': True})

@vocab_bp.route('/api/sentences')
@require_login
def get_sentences():
    u = session['user']
    tid = request.args.get('topic_id')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))

    rows = sent_query(u, tid)
    total = len(rows)
    start = (page - 1) * per_page
    paged = rows[start: start + per_page]
    return jsonify({'items': paged, 'total': total, 'page': page})

@vocab_bp.route('/api/sentences', methods=['POST'])
@require_login
def create_sentence():
    u = session['user']
    d = request.json
    if not d.get('topic_id') or not d.get('hanzi','').strip() or not d.get('vietnamese','').strip():
        return jsonify({'error':'Thiếu thông tin'}), 400
        
    owner_id = None if u['role'] == 'admin' else u['id']
    conn = get_db()
    
    # SỬA: Postgres dùng %s và RETURNING id
    query = "INSERT INTO sentences (topic_id, hanzi, pinyin, vietnamese, owner_id) VALUES (%s, %s, %s, %s, %s) RETURNING id"
    sid = insert_returning_id(conn, query, (d['topic_id'], d['hanzi'].strip(), d.get('pinyin','').strip(), d['vietnamese'].strip(), owner_id))
    conn.commit()
    
    row = fetchone(conn, "SELECT s.*, t.name as topic_name FROM sentences s JOIN topics t ON t.id=s.topic_id WHERE s.id=%s", (sid,))
    conn.close()
    return jsonify({'success': True, 'sentence': dict(row)})

@vocab_bp.route('/api/sentences/import', methods=['POST'])
@require_login
def import_sentences():
    u = session['user']
    topic_id = request.form.get('topic_id')
    if not topic_id:
        return jsonify({'error': 'Vui lòng chọn chủ đề'}), 400
    if 'file' not in request.files:
        return jsonify({'error': 'Không tìm thấy file'}), 400
    
    file = request.files['file']
    try:
        df = pd.read_excel(file)
        df.columns = [str(c).strip().lower() for c in df.columns]
        df = df.fillna('')
        owner_id = None if u['role'] == 'admin' else u['id']
        conn = get_db()
        count = 0
        
        for _, row in df.iterrows():
            hanzi = str(row.get('hanzi', '')).strip()
            vietnamese = str(row.get('vietnamese', '')).strip()
            if not hanzi or not vietnamese: continue

            execute(conn, "INSERT INTO sentences (topic_id, hanzi, pinyin, vietnamese, owner_id) VALUES (%s, %s, %s, %s, %s)",
                    (topic_id, hanzi, str(row.get('pinyin','')).strip(), vietnamese, owner_id))
            count += 1
            
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': f'Đã import thành công {count} câu.'})
    except Exception as e:
        return jsonify({'error': f'Lỗi file: {str(e)}'}), 500

@vocab_bp.route('/api/sentences/<int:sid>', methods=['DELETE'])
@require_login
def delete_sentence(sid):
    u = session['user']
    conn = get_db()
    s = fetchone(conn, "SELECT * FROM sentences WHERE id=%s", (sid,))
    if not s: conn.close(); return jsonify({'error':'Không tìm thấy'}), 404
    if u['role'] != 'admin' and s['owner_id'] != u['id']:
        conn.close(); return jsonify({'error':'Không có quyền'}), 403
        
    execute(conn, "DELETE FROM sentences WHERE id=%s", (sid,))
    conn.commit(); conn.close()
    return jsonify({'success': True})