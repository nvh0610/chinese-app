import sqlite3, os
from werkzeug.security import generate_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'chinese_app.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db(); c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        is_active INTEGER NOT NULL DEFAULT 1,
        active_from DATE DEFAULT NULL,
        active_until DATE DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        owner_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        hanzi TEXT NOT NULL,
        pinyin TEXT NOT NULL,
        vietnamese TEXT NOT NULL,
        example_sentence TEXT,
        example_pinyin TEXT,
        example_vietnamese TEXT,
        owner_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS sentences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id INTEGER NOT NULL,
        hanzi TEXT NOT NULL,
        pinyin TEXT,
        vietnamese TEXT NOT NULL,
        owner_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )''')

    # Leaderboard: best streak per user per topic per quiz_type per period
    c.execute('''CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        topic_id INTEGER DEFAULT NULL,
        quiz_type TEXT NOT NULL,
        streak INTEGER NOT NULL DEFAULT 0,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS word_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        word_ref TEXT NOT NULL,      -- hanzi hoặc sentence hanzi
        quiz_type TEXT NOT NULL,
        error_count INTEGER DEFAULT 0,
        UNIQUE(user_id, word_ref, quiz_type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )''')

    conn.commit()

    # for uname, pw, role in [('admin','123456','admin'), ('user','123456','user')]:
    #     try:
    #         c.execute("INSERT INTO users (username,password,role) VALUES (?,?,?)",
    #                   (uname, generate_password_hash(pw), role))
    #     except sqlite3.IntegrityError:
    #         pass
    # conn.commit()

    # tlist = [
    #     ('Chào hỏi','Các từ vựng chào hỏi cơ bản'),
    #     ('Gia đình','Các từ vựng về thành viên gia đình'),
    #     ('Số đếm','Số đếm từ 1 đến 100'),
    #     ('Màu sắc','Các màu sắc thông dụng'),
    #     ('Thức ăn','Các loại thức ăn phổ biến'),
    #     ('Du lịch','Từ vựng về du lịch và đi lại'),
    # ]
    # for name, desc in tlist:
    #     if not c.execute("SELECT id FROM topics WHERE name=? AND owner_id IS NULL",(name,)).fetchone():
    #         c.execute("INSERT INTO topics (name,description,owner_id) VALUES (?,?,NULL)",(name,desc))
    # conn.commit()

    # t = {r['name']:r['id'] for r in c.execute("SELECT * FROM topics WHERE owner_id IS NULL").fetchall()}

    # vdata = [
    #     (t['Chào hỏi'],'你好','nǐ hǎo','Xin chào','你好，我叫小明。','Nǐ hǎo, wǒ jiào Xiǎomíng.','Xin chào, tôi tên là Tiểu Minh.'),
    #     (t['Chào hỏi'],'谢谢','xiè xiè','Cảm ơn','谢谢你的帮助！','Xiè xiè nǐ de bāngzhù!','Cảm ơn bạn đã giúp đỡ!'),
    #     (t['Chào hỏi'],'对不起','duì bu qǐ','Xin lỗi','对不起，我来晚了。','Duì bu qǐ, wǒ lái wǎn le.','Xin lỗi, tôi đến muộn.'),
    #     (t['Chào hỏi'],'再见','zài jiàn','Tạm biệt','再见，明天见！','Zài jiàn, míngtiān jiàn!','Tạm biệt, ngày mai gặp lại!'),
    #     (t['Chào hỏi'],'请问','qǐng wèn','Xin hỏi','请问，厕所在哪里？','Qǐng wèn, cèsuǒ zài nǎlǐ?','Xin hỏi, nhà vệ sinh ở đâu?'),
    #     (t['Chào hỏi'],'没关系','méi guān xi','Không sao','没关系，我不介意。','Méi guān xi, wǒ bù jièyì.','Không sao, tôi không bận tâm.'),
    #     (t['Gia đình'],'爸爸','bà ba','Bố/Ba','我爸爸是医生。','Wǒ bàba shì yīshēng.','Bố tôi là bác sĩ.'),
    #     (t['Gia đình'],'妈妈','mā ma','Mẹ','我妈妈很漂亮。','Wǒ māma hěn piàoliang.','Mẹ tôi rất đẹp.'),
    #     (t['Gia đình'],'哥哥','gē ge','Anh trai','我哥哥在北京工作。','Wǒ gēge zài Běijīng gōngzuò.','Anh trai tôi làm việc ở Bắc Kinh.'),
    #     (t['Gia đình'],'姐姐','jiě jie','Chị gái','我姐姐结婚了。','Wǒ jiějie jiéhūn le.','Chị gái tôi đã kết hôn.'),
    #     (t['Gia đình'],'弟弟','dì di','Em trai','我弟弟今年八岁。','Wǒ dìdi jīnnián bā suì.','Em trai tôi năm nay 8 tuổi.'),
    #     (t['Gia đình'],'妹妹','mèi mei','Em gái','我妹妹很可爱。','Wǒ mèimei hěn kě\'ài.','Em gái tôi rất đáng yêu.'),
    #     (t['Số đếm'],'一','yī','Một','我有一本书。','Wǒ yǒu yī běn shū.','Tôi có một quyển sách.'),
    #     (t['Số đếm'],'二','èr','Hai','我买了二斤苹果。','Wǒ mǎi le èr jīn píngguǒ.','Tôi mua hai cân táo.'),
    #     (t['Số đếm'],'三','sān','Ba','我们班有三十个同学。','Wǒmen bān yǒu sānshí gè tóngxué.','Lớp chúng tôi có 30 bạn học.'),
    #     (t['Số đếm'],'十','shí','Mười','今天是十号。','Jīntiān shì shí hào.','Hôm nay là ngày 10.'),
    #     (t['Số đếm'],'百','bǎi','Trăm','这件衣服一百块钱。','Zhè jiàn yīfú yī bǎi kuài qián.','Bộ quần áo này một trăm tệ.'),
    #     (t['Màu sắc'],'红色','hóng sè','Màu đỏ','我喜欢红色的玫瑰。','Wǒ xǐhuān hóngsè de méiguī.','Tôi thích hoa hồng đỏ.'),
    #     (t['Màu sắc'],'蓝色','lán sè','Màu xanh dương','天空是蓝色的。','Tiānkōng shì lánsè de.','Bầu trời màu xanh dương.'),
    #     (t['Màu sắc'],'绿色','lǜ sè','Màu xanh lá','草地是绿色的。','Cǎodì shì lǜsè de.','Bãi cỏ màu xanh lá.'),
    #     (t['Màu sắc'],'白色','bái sè','Màu trắng','雪是白色的。','Xuě shì báisè de.','Tuyết màu trắng.'),
    #     (t['Màu sắc'],'黑色','hēi sè','Màu đen','我的头发是黑色的。','Wǒ de tóufà shì hēisè de.','Tóc tôi màu đen.'),
    #     (t['Thức ăn'],'米饭','mǐ fàn','Cơm','我每天都吃米饭。','Wǒ měitiān dōu chī mǐfàn.','Tôi ăn cơm mỗi ngày.'),
    #     (t['Thức ăn'],'面条','miàn tiáo','Mì sợi','我喜欢吃面条。','Wǒ xǐhuān chī miàntiáo.','Tôi thích ăn mì sợi.'),
    #     (t['Thức ăn'],'饺子','jiǎo zi','Sủi cảo','过年要吃饺子。','Guònián yào chī jiǎozi.','Tết phải ăn sủi cảo.'),
    #     (t['Thức ăn'],'茶','chá','Trà','中国人爱喝茶。','Zhōngguó rén ài hē chá.','Người Trung Quốc thích uống trà.'),
    #     (t['Thức ăn'],'水果','shuǐ guǒ','Hoa quả','多吃水果对身体好。','Duō chī shuǐguǒ duì shēntǐ hǎo.','Ăn nhiều hoa quả tốt cho sức khỏe.'),
    #     (t['Du lịch'],'飞机','fēi jī','Máy bay','我坐飞机去北京。','Wǒ zuò fēijī qù Běijīng.','Tôi đi máy bay đến Bắc Kinh.'),
    #     (t['Du lịch'],'火车','huǒ chē','Tàu hỏa','高铁比火车快很多。','Gāotiě bǐ huǒchē kuài hěnduō.','Tàu cao tốc nhanh hơn tàu hỏa nhiều.'),
    #     (t['Du lịch'],'酒店','jiǔ diàn','Khách sạn','这家酒店很舒适。','Zhè jiā jiǔdiàn hěn shūshì.','Khách sạn này rất thoải mái.'),
    #     (t['Du lịch'],'地图','dì tú','Bản đồ','请给我一张地图。','Qǐng gěi wǒ yī zhāng dìtú.','Làm ơn cho tôi một tấm bản đồ.'),
    #     (t['Du lịch'],'护照','hù zhào','Hộ chiếu','出国旅行需要护照。','Chūguó lǚxíng xūyào hùzhào.','Du lịch nước ngoài cần hộ chiếu.'),
    # ]
    # for v in vdata:
    #     if not c.execute("SELECT id FROM vocabulary WHERE hanzi=? AND topic_id=? AND owner_id IS NULL",(v[1],v[0])).fetchone():
    #         c.execute("INSERT INTO vocabulary (topic_id,hanzi,pinyin,vietnamese,example_sentence,example_pinyin,example_vietnamese,owner_id) VALUES (?,?,?,?,?,?,?,NULL)",v)

    # sdata = [
    #     (t['Chào hỏi'],'你好吗','nǐ hǎo ma','Bạn có khỏe không?'),
    #     (t['Chào hỏi'],'我很好谢谢','wǒ hěn hǎo xiè xiè','Tôi rất khỏe cảm ơn.'),
    #     (t['Chào hỏi'],'你叫什么名字','nǐ jiào shénme míngzì','Bạn tên là gì?'),
    #     (t['Chào hỏi'],'我的名字是小明','wǒ de míngzì shì Xiǎomíng','Tên tôi là Tiểu Minh.'),
    #     (t['Gia đình'],'我家有四口人','wǒ jiā yǒu sì kǒu rén','Gia đình tôi có 4 người.'),
    #     (t['Gia đình'],'我爱我的家人','wǒ ài wǒ de jiārén','Tôi yêu gia đình tôi.'),
    #     (t['Thức ăn'],'这个菜很好吃','zhège cài hěn hǎo chī','Món này rất ngon.'),
    #     (t['Thức ăn'],'我想吃北京烤鸭','wǒ xiǎng chī Běijīng kǎoyā','Tôi muốn ăn vịt quay Bắc Kinh.'),
    #     (t['Du lịch'],'我想去中国旅行','wǒ xiǎng qù Zhōngguó lǚxíng','Tôi muốn đi du lịch Trung Quốc.'),
    #     (t['Du lịch'],'北京是中国的首都','Běijīng shì Zhōngguó de shǒudū','Bắc Kinh là thủ đô của Trung Quốc.'),
    # ]
    # for s in sdata:
    #     if not c.execute("SELECT id FROM sentences WHERE hanzi=? AND topic_id=? AND owner_id IS NULL",(s[1],s[0])).fetchone():
    #         c.execute("INSERT INTO sentences (topic_id,hanzi,pinyin,vietnamese,owner_id) VALUES (?,?,?,?,NULL)",s)

    conn.commit(); conn.close()
    print("DB initialized!")

if __name__ == '__main__':
    init_db()
