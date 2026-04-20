import os
from flask import Flask
from flask_cors import CORS

from api.routes import analysis

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "https://stabilis.vercel.app"])
app.register_blueprint(analysis)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 7860)), debug=True)
