import os

from api import create_app

app = create_app()

if __name__ == '__main__':
    # Local development only. Production runs under gunicorn (see gunicorn.conf.py).
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 7860)))
