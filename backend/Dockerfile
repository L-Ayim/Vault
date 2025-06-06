# ─────────────────────────────────────────────────────────────────────────────
# Django + MySQL image for Vault2 backend
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.10-slim

# ─── OS packages needed to compile mysqlclient ────────────────────────────────
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        default-libmysqlclient-dev \
        pkg-config \
        default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# ─── Set working directory ─────────────────────────────────────────────────────
WORKDIR /code

# ─── Install Python deps first (leverages Docker layer cache) ──────────────────
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# ─── Copy project code after deps to maximise cache hits ───────────────────────
COPY . .

# ─── Add entry-point that runs migrations every container start ────────────────
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
