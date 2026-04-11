.PHONY: setup setup-server setup-webapp \
        build build-webapp \
        dev-server dev-webapp \
        start stop restart status \
        deploy deploy-webapp deploy-server \
        service-install service-enable service-start service-stop \
        service-restart service-status service-log \
        cron-install \
        clean clean-all clean-cache

# ===== 変数（環境変数で上書き可） =====
PI_HOST  ?= pi@raspberrypi.local
PI_DIR   ?= /home/pi/family-calendar-server
SERVICE  ?= family-calendar
PYTHON   := server/venv/bin/python
PIP      := server/venv/bin/pip

# ===== セットアップ =====

setup: setup-server setup-webapp

setup-server: server/venv

server/venv:
	python3 -m venv server/venv
	$(PIP) install --upgrade pip
	$(PIP) install -r server/requirements.txt

setup-webapp:
	cd webapp && npm install

# ===== ビルド =====

build: build-webapp

build-webapp:
	cd webapp && npm run build

# ===== 開発（ローカル実行） =====

dev-server:
	FLASK_DEBUG=1 $(PYTHON) server/server.py

dev-webapp:
	cd webapp && npm run dev

# ===== サーバー制御（PID ファイルによる直接起動、開発・デバッグ用） =====
# 本番環境では service-start / service-stop を使用すること

start:
	$(PYTHON) server/server.py & echo $$! > server/server.pid
	@echo "サーバーを起動しました (PID: $$(cat server/server.pid))"

stop:
	@if [ -f server/server.pid ]; then \
		kill $$(cat server/server.pid) 2>/dev/null && rm server/server.pid \
		&& echo "サーバーを停止しました"; \
	else \
		echo "PID ファイルが見つかりません。サーバーは起動していない可能性があります。"; \
	fi

restart: stop start

status:
	@if [ -f server/server.pid ] && kill -0 $$(cat server/server.pid) 2>/dev/null; then \
		echo "サーバー稼働中 (PID: $$(cat server/server.pid))"; \
	else \
		echo "サーバーは停止しています"; \
	fi

# ===== デプロイ（開発マシン → Pi） =====

deploy: build deploy-webapp deploy-server

deploy-webapp:
	rsync -av --delete webapp/dist/ $(PI_HOST):$(PI_DIR)/dist/

deploy-server:
	rsync -av \
		--exclude 'venv/' \
		--exclude 'cache/' \
		--exclude '__pycache__/' \
		--exclude '*.pyc' \
		server/ $(PI_HOST):$(PI_DIR)/

# ===== サービス管理（Pi 上で実行） =====

service-install:
	sudo cp server/family-calendar.service /etc/systemd/system/$(SERVICE).service
	sudo systemctl daemon-reload

service-enable:
	sudo systemctl enable $(SERVICE)

service-start:
	sudo systemctl start $(SERVICE)

service-stop:
	sudo systemctl stop $(SERVICE)

service-restart:
	sudo systemctl restart $(SERVICE)

service-status:
	sudo systemctl status $(SERVICE)

service-log:
	sudo journalctl -u $(SERVICE) -f

# ===== cron（OS 起動時の自動起動を設定） =====

cron-install: service-install service-enable
	@echo "systemd サービスを登録・有効化しました。OS 起動時に自動起動します。"
	@echo "今すぐ起動するには: make service-start"

# ===== クリーン =====

clean:
	rm -rf webapp/dist

clean-all: clean
	rm -rf server/venv webapp/node_modules

clean-cache:
	rm -rf server/cache
