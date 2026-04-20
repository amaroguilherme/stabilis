FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN git config --global url."https://${GITHUB_TOKEN}:x-oauth-basic@github.com/".insteadOf "https://github.com/"

COPY requirements.txt .

RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

RUN --mount=type=secret,id=GITHUB_TOKEN,mode=0444,required=true \
    TOKEN=$(cat /run/secrets/GITHUB_TOKEN | tr -d '\n\r') && \
    sed -i "s|git+https://github.com/|git+https://${TOKEN}@github.com/|g" requirements.txt && \
    pip install --no-cache-dir -r requirements.txt

FROM python:3.13-slim AS runner

RUN useradd -m -u 1000 user

ENV HOME=/home/user \
    PATH="/opt/venv/bin:$PATH"

WORKDIR $HOME/app

RUN apt-get update && apt-get install -y \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=user:user /opt/venv /opt/venv

COPY --chown=user:user . $HOME/app/

EXPOSE 7860
ENV FLASK_APP=app.py
ENV PORT=7860

USER user

CMD ["python", "app.py"]