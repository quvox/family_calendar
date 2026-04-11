# CLAUDE.md

<!-- claude-dev-auto-start -->

## 注意事項

- 必ず公式の最新情報、最新仕様を調べて、それを適用すること

## Web アプリの動作確認（重要）

- コンテナ内で Google Chrome が動作している。ユーザーは noVNC 経由でブラウザ画面をリアルタイムに確認できる
- chrome-devtools MCP サーバー経由で Chrome を操作すること
- **ヘッドレスブラウザを別途起動しないこと**（`chromium.launch()` 等は禁止）

### 動作確認の手順

1. 開発サーバーを起動する（`0.0.0.0` にバインドすること）
2. chrome-devtools MCP で Chrome を操作する（ページ遷移、クリック、入力、スクリーンショット等）
3. ユーザーは noVNC 画面で操作をリアルタイムに確認できる

### 注意事項
- 開発サーバーは `0.0.0.0` にバインドする（`--host 0.0.0.0` 等）
- コンテナ内の Chrome からは `localhost` で開発サーバーにアクセスできる

## Docker ネットワーク（重要）

- このシェルは Docker コンテナ `family_calendar` 内で動作している
- `localhost` / `127.0.0.1` では他のコンテナにアクセスできない。必ず**コンテナ名**を使うこと
  - 例: `curl http://localhost:8000` → `curl http://family_calendar:8000`
- 自コンテナ内のサーバーへのアクセスは `localhost` で可
- `docker ps` でコンテナ名を確認できる
- 全コンテナは Docker ネットワーク `claude-dev-net` に接続されている

<!-- claude-dev-auto-end -->
