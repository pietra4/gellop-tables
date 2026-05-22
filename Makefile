.PHONY: deploy up down logs test build setup

deploy: ## Bootstrap or update the app on any Linux host
	chmod +x deploy.sh && sudo ./deploy.sh

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

logs: ## Tail logs from all services
	docker compose logs -f

test: ## Run backend tests
	cd backend && npm test

build: ## Rebuild images
	docker compose build

setup: ## Generate .env and install deps (local dev)
	cd backend && cp -n .env.example .env || true
	cd backend && npm install
	cd frontend && npm install

psql: ## Open database shell
	docker compose exec db psql -U clayite -d clayite

reset: ## Destroy data (⚠️  deletes volumes)
	docker compose down -v
