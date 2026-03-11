FROM python:3.12-slim

WORKDIR /app

# System deps for pymupdf and python-docx
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first for layer caching
COPY pyproject.toml .

# Install dependencies
RUN uv pip install --system --no-cache -e .

# Copy application code
COPY . .

EXPOSE 8000

CMD ["python", "run.py"]
