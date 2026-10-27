import os

bind = f"0.0.0.0:{os.environ.get('PORT', '7860')}"
workers = 1             # one copy of the model in RAM; the in-memory job store needs a single process
worker_class = "gthread"
threads = 4             # concurrent health/poll requests; the LLM runs on the single job-worker thread
timeout = 120           # worker liveness, not request length (gthread keeps heartbeating)
graceful_timeout = 20
keepalive = 5
preload_app = False     # warm-up and job-worker threads must start inside the worker process
max_requests = 0        # recycling the worker would drop queued jobs and reload the model
control_socket_disable = True  # gunicorn >= 26 opens a control socket in $HOME by default; not needed here
accesslog = None        # the app logs requests itself, without bodies or query strings
errorlog = "-"
loglevel = "info"
