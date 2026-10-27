# API for the Hugging Face Space: Flask + gunicorn + llama.cpp on CPU. Only the language service
# (free text -> structured suggestions) runs here; treatment logic runs in the browser.
FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# The machine that builds the image is not the one that runs it: no -march=native. AVX2/FMA are
# available on the Space's x86-64 CPUs and keep inference fast.
ENV CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON" \
    CMAKE_BUILD_PARALLEL_LEVEL=4

COPY requirements.txt .
RUN pip install -r requirements.txt

FROM python:3.13-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 user

ENV HOME=/home/user \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    LLM_THREADS=2 \
    OMP_NUM_THREADS=2

WORKDIR $HOME/app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=user:user app.py gunicorn.conf.py ./
COPY --chown=user:user api ./api
COPY --chown=user:user core ./core
COPY --chown=user:user knowledge ./knowledge

USER user
EXPOSE 7860
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]
