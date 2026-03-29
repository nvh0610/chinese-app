from flask import Blueprint, request, jsonify, session
from database import get_db
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
    db = get_db()
    db.execute("""INSERT INTO vocabulary
        (topic_id,hanzi,pinyin,vietnamese,example_sentence,example_pinyin,example_vietnamese,owner_id)
        VALUES (?,?,?,?,?,?,?,?)""",
        (d['topic_id'], d['hanzi'].strip(), d['pinyin'].strip(), d['vietnamese'].strip(),
         d.get('example_sentence','').strip(), d.get('example_pinyin','').strip(),
         d.get('example_vietnamese','').strip(), owner_id))
    db.commit()
    vid = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    row = db.execute("SELECT v.*,t.name as topic_name FROM vocabulary v JOIN topics t ON t.id=v.topic_id WHERE v.id=?",(vid,)).fetchone()
    db.close()
    return jsonify({'success': True, 'vocabulary': dict(row)})

@vocab_bp.route('/api/vocabulary/import', methods=['POST'])
@require_login
def import_vocabulary():
    u = session['user']
    topic_id = request.form.get('topic_id') # Lấy topic_id từ form-data
    
    if not topic_id:
        return jsonify({'error': 'Thiếu topic_id'}), 400
    
    if 'file' not in request.files:
        return jsonify({'error': 'Không tìm thấy file'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Tên file trống'}), 400

    try:
        # 1. Đọc file excel vào DataFrame
        df = pd.read_excel(file)
        
        # 2. Làm sạch dữ liệu (Xóa khoảng trắng, điền giá trị trống bằng chuỗi rỗng)
        df = df.fillna('').applymap(lambda x: str(x).strip())

        # 3. Xác định owner_id (Admin là NULL, User là ID)
        owner_id = None if u['role'] == 'admin' else u['id']
        
        db = get_db()
        count = 0
        
        # 4. Lặp qua từng dòng và chèn vào DB
        for _, row in df.iterrows():
            # Kiểm tra các trường bắt buộc
            if not row.get('hanzi') or not row.get('pinyin') or not row.get('vietnamese'):
                continue # Bỏ qua dòng thiếu thông tin quan trọng
                
            db.execute("""
                INSERT INTO vocabulary 
                (topic_id, hanzi, pinyin, vietnamese, 
                 example_sentence, example_pinyin, example_vietnamese, owner_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                topic_id,
                row['hanzi'],
                row['pinyin'],
                row['vietnamese'],
                row.get('example_sentence', ''),
                row.get('example_pinyin', ''),
                row.get('example_vietnamese', ''),
                owner_id
            ))
            count += 1
            
        db.commit()
        db.close()
        
        return jsonify({'success': True, 'message': f'Đã import thành công {count} từ vựng.'})
        
    except Exception as e:
        return jsonify({'error': f'Lỗi xử lý file: {str(e)}'}), 500

@vocab_bp.route('/api/vocabulary/<int:vid>', methods=['PUT'])
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

@vocab_bp.route('/api/vocabulary/<int:vid>', methods=['DELETE'])
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

@vocab_bp.route('/api/sentences')
@require_login
def get_sentences():
    u = session['user']
    tid = request.args.get('topic_id')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))

    rows = sent_query(u, tid)          # lấy tất cả như cũ
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
        return jsonify({'error':'Thiếu thông tin'}),400
    owner_id = None if u['role'] == 'admin' else u['id']
    db = get_db()
    db.execute("INSERT INTO sentences (topic_id,hanzi,pinyin,vietnamese,owner_id) VALUES (?,?,?,?,?)",
               (d['topic_id'],d['hanzi'].strip(),d.get('pinyin','').strip(),d['vietnamese'].strip(),owner_id))
    db.commit()
    sid = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    row = db.execute("SELECT s.*,t.name as topic_name FROM sentences s JOIN topics t ON t.id=s.topic_id WHERE s.id=?",(sid,)).fetchone()
    db.close()
    return jsonify({'success': True, 'sentence': dict(row)})

@vocab_bp.route('/api/sentences/import', methods=['POST'])
@require_login
def import_sentences():
    u = session['user']
    # Lấy topic_id trực tiếp từ Form Data
    topic_id = request.form.get('topic_id')
    
    if not topic_id:
        return jsonify({'error': 'Vui lòng chọn chủ đề để import'}), 400
    
    if 'file' not in request.files:
        return jsonify({'error': 'Không tìm thấy file'}), 400
    
    file = request.files['file']
    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({'error': 'File phải có định dạng Excel (.xlsx hoặc .xls)'}), 400

    try:
        # Đọc trực tiếp từ đối tượng file của Flask
        df = pd.read_excel(file)
        
        # Chuẩn hóa tên cột: viết thường, bỏ khoảng trắng
        df.columns = [str(c).strip().lower() for c in df.columns]
        df = df.fillna('')

        # Phân quyền: Admin là NULL (Public), User là ID cá nhân
        owner_id = None if u['role'] == 'admin' else u['id']
        
        db = get_db()
        count = 0
        
        for _, row in df.iterrows():
            hanzi = str(row.get('hanzi', '')).strip()
            pinyin = str(row.get('pinyin', '')).strip()
            vietnamese = str(row.get('vietnamese', '')).strip()

            # Chỉ cần Hán tự và Nghĩa là đủ điều kiện insert
            if not hanzi or not vietnamese:
                continue

            db.execute("""
                INSERT INTO sentences (topic_id, hanzi, pinyin, vietnamese, owner_id)
                VALUES (?, ?, ?, ?, ?)
            """, (topic_id, hanzi, pinyin, vietnamese, owner_id))
            count += 1
            
        db.commit()
        db.close()
        
        return jsonify({
            'success': True, 
            'message': f'Đã import thành công {count} câu ví dụ.'
        })
        
    except Exception as e:
        print(f"Import Sentences Error: {e}")
        return jsonify({'error': f'Lỗi khi xử lý file: {str(e)}'}), 500

@vocab_bp.route('/api/sentences/<int:sid>', methods=['DELETE'])
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
