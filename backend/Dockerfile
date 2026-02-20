FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (PostgreSQL + WeasyPrint/Cairo/Pango)
# CRITICAL: WeasyPrint требует libcairo2, libpango — без них PDF не генерируется
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    python3-dev \
    libpq-dev \
    build-essential \
    libcairo2 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Убираем CRLF в shell-скриптах (иначе в контейнере: set: -, $'\r': command not found)
RUN sed -i 's/\r$//' /app/entrypoint.prod.sh 2>/dev/null || true

# Create media and static directories
RUN mkdir -p /app/media /app/staticfiles

# Expose port
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
