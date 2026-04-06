from flask import Flask
from flask_cors import CORS

from api.routes import analysis

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])
app.register_blueprint(analysis)

if __name__ == '__main__':
    app.run(port=8080, debug=True)
