from flask import Flask, render_template
from database import init_db
from routes.auth import auth_bp
from routes.users import users_bp
from routes.topics import topics_bp
from routes.vocabulary import vocab_bp
from routes.quiz import quiz_bp

app = Flask(__name__)
app.secret_key = 'chinese_secret_nvh0610_2024'

with app.app_context():
    init_db()

app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(topics_bp)
app.register_blueprint(vocab_bp)
app.register_blueprint(quiz_bp)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
