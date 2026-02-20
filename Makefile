.PHONY: help setup install migrate run test lint format clean docker-up docker-down docker-build

help:
	@echo "Available commands:"
	@echo "  make setup       - Initial project setup"
	@echo "  make install     - Install Python dependencies"
	@echo "  make migrate     - Run database migrations"
	@echo "  make run         - Run development server"
	@echo "  make test        - Run tests"
	@echo "  make lint        - Run linters"
	@echo "  make format      - Format code"
	@echo "  make clean       - Clean Python cache"
	@echo "  make docker-up   - Start Docker containers"
	@echo "  make docker-down - Stop Docker containers"
	@echo "  make docker-build - Build Docker images"

setup:
	@echo "Setting up project..."
	@cp .env.example .env
	@echo "Created .env file. Please update it with your settings."
	@cd backend && pip install -r requirements.txt
	@echo "Installed Python dependencies."
	@echo "Run 'make migrate' to set up the database."

install:
	cd backend && pip install -r requirements.txt

migrate:
	cd backend && python manage.py makemigrations
	cd backend && python manage.py migrate

run:
	cd backend && python manage.py runserver

test:
	cd backend && pytest

lint:
	cd backend && ruff check .
	cd backend && black --check .
	cd backend && isort --check-only .

format:
	cd backend && black .
	cd backend && isort .

clean:
	find . -type d -name "__pycache__" -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete

docker-up:
	cd infra && docker-compose up -d

docker-down:
	cd infra && docker-compose down

docker-build:
	cd infra && docker-compose build
