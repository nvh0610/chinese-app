# 汉语学习 - Ứng dụng Học Tiếng Trung

Ứng dụng web học tiếng Trung với SQLite, hỗ trợ trắc nghiệm, tự điền chữ Hán, và sắp xếp câu.

## Cài đặt

### Yêu cầu
- Python 3.8+
- Flask (đã có sẵn trong hầu hết môi trường Python)

### Bước 1: Cài thư viện
```bash
pip install flask werkzeug
```

### Bước 2: Khởi động ứng dụng
```bash
python app.py
```

### Bước 3: Mở trình duyệt
```
http://localhost:5000
```

---
## Tính năng

### 📝 Trắc nghiệm từ vựng
- Hiển thị nghĩa tiếng Việt → chọn chữ Hán đúng (4 lựa chọn)
- Lọc theo chủ đề
- Hiện câu ví dụ sau khi trả lời
- Đếm điểm đúng/sai

### ✍️ Tự điền chữ Hán
- Hiển thị nghĩa tiếng Việt + pinyin gợi ý
- Tự nhập chữ Hán vào ô
- Có nút gợi ý chữ đầu
- Kiểm tra và hiện đáp án

### 🔀 Sắp xếp câu
- Hiển thị nghĩa tiếng Việt
- Nhấn chọn các chữ Hán để sắp xếp thành câu đúng
- Nhấn lại để bỏ chữ ra khỏi câu

### 📚 Quản lý (chỉ Admin)
- **Từ vựng**: Thêm/sửa/xóa từ vựng với câu ví dụ
- **Câu luyện tập**: Thêm câu mới để sắp xếp
- **Chủ đề**: Thêm/sửa/xóa chủ đề (xóa chủ đề sẽ xóa tất cả dữ liệu liên quan)

---

## Cấu trúc dự án

```
chinese-app/
├── app.py           # Flask server + API routes
├── database.py      # SQLite setup + seed data
├── requirements.txt
├── chinese_app.db   # SQLite database (tự tạo)
├── templates/
│   └── index.html   # Giao diện chính
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

---

## Dữ liệu mặc định

Ứng dụng đã có sẵn:
- **6 chủ đề**: Chào hỏi, Gia đình, Số đếm, Màu sắc, Thức ăn, Du lịch
- **30+ từ vựng** với câu ví dụ
- **10 câu luyện tập** sắp xếp
