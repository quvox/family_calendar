# 家族カレンダー表示システム

リビングに設置したタブレットで、家族全員の今日の予定を常時表示するシステムです。

iCloud の家族共有カレンダーを Raspberry Pi Zero W で定期取得し、React PWA でリアルタイム表示します。

```
iPhone（予定入力）
  → iCloud Calendar（共有）
    → Raspberry Pi Zero W（5分ごとに取得・配信）
      → タブレット（PWA で常時表示）
```

## スクリーンショット

| 予定あり | 予定なし |
|---------|---------|
| 終日・時間指定イベントをメンバー色で表示 | 「今日の予定はありません」を表示 |

---

## システム構成

| コンポーネント | 技術スタック |
|-------------|------------|
| サーバー | Python 3 / Flask / APScheduler / icalendar |
| WebApp | React 18 / TypeScript / Vite / Tailwind CSS |
| 実行環境 | Raspberry Pi Zero W（ARMv6, RAM 512MB） |
| 設定 | YAML |

## ディレクトリ構成

```
.
├── Makefile                        # 全操作の統一インターフェース
├── server/
│   ├── server.py                   # Flask API サーバー
│   ├── config.yaml                 # 設定ファイル（要編集）
│   ├── requirements.txt            # Python 依存パッケージ
│   └── family-calendar.service    # systemd サービスファイル
└── webapp/
    ├── src/
    │   ├── App.tsx
    │   ├── hooks/useCalendarEvents.ts
    │   ├── components/             # Header, EventCard, StatusBar …
    │   └── types.ts
    └── public/manifest.json        # PWA マニフェスト
```

---

## 準備手順

### 前提条件

**開発マシン**
- Python 3.11 以上
- Node.js 20 以上
- GNU Make
- rsync（Pi へのデプロイ時）

**Raspberry Pi Zero W**
- Raspberry Pi OS Lite（32bit）
- Python 3.11 以上
- SSH 接続可能な状態

---

### 1. iCloud カレンダーの公開 URL を取得する

1. iPhone の「カレンダー」アプリを開く
2. 共有したいカレンダーの横にある `i` をタップ
3. **「カレンダーを共有」→「公開カレンダー」をオン**にする
4. 「リンクを共有」をタップして URL をコピーする

> URL の形式: `https://p**-caldav.icloud.com/published/2/...`

---

### 2. イベントへのメンバー名記入ルールを決める

iPhoneでイベントを作成・編集するとき、**メモ欄（説明）の1行目**に誰の予定かを記入してください。

```
例）
  タイトル: 歯医者
  メモ:     ママ          ← 1行目にメンバー名
            ○○歯科 2階   ← 2行目以降はメモ本文（省略可）
```

メモ欄が空、または1行目がメンバー名と一致しない場合はグレーで表示されます。

---

### 3. リポジトリをクローンする

```bash
git clone <repository-url> family-calendar
cd family-calendar
```

---

### 4. 設定ファイルを編集する

`server/config.yaml` を開き、取得した iCloud URL とメンバー情報を設定します。

```yaml
server:
  port: 8080
  fetch_interval_minutes: 5

calendar:
  ics_url: "https://p**-caldav.icloud.com/published/2/YOUR_URL"  # ← 書き換える

members:
  - name: パパ       # ← メモ欄に書く名前と完全一致させる
    color: "#4A90D9"
  - name: ママ
    color: "#E85D75"
  - name: 太郎
    color: "#50C878"
  - name: 花子
    color: "#FFB347"

unassigned:
  color: "#888888"   # メンバー未識別イベントの色
```

> `members[].name` は iPhone のメモ欄1行目と**完全一致**で照合されます。スペースや全角・半角に注意してください。

---

### 5. 開発マシンでセットアップ・動作確認する

```bash
# Python venv の作成 + npm install を一括実行
make setup

# Flask サーバーをフォアグラウンドで起動（ターミナル 1）
make dev-server

# Vite 開発サーバーを起動（ターミナル 2）
make dev-webapp
```

ブラウザで `http://localhost:5173` を開いて動作を確認します。

---

### 6. Raspberry Pi にデプロイする

#### 6-1. Pi にリポジトリをクローンする

```bash
ssh pi@raspberrypi.local
git clone <repository-url> /home/pi/family-calendar-server
exit
```

#### 6-2. Pi 上でサーバーをセットアップする

```bash
ssh pi@raspberrypi.local
cd /home/pi/family-calendar-server

# config.yaml を編集（iCloud URL・メンバー情報を設定）
nano server/config.yaml

# venv 作成 + 依存パッケージインストール
make setup-server
```

#### 6-3. WebApp をビルドして転送する

開発マシンで実行します。

```bash
# ビルド → rsync で Pi に転送（サーバーコードも一緒に転送）
make deploy
```

`PI_HOST` や `PI_DIR` を変更したい場合は環境変数で上書きできます。

```bash
PI_HOST=pi@192.168.1.10 make deploy
```

#### 6-4. systemd サービスを登録して自動起動を設定する

Pi 上で実行します。

```bash
ssh pi@raspberrypi.local
cd /home/pi/family-calendar-server

# systemd に登録 + OS 起動時の自動起動を有効化
make cron-install

# 今すぐ起動
make service-start

# 起動確認
make service-status
```

サーバーが正常に起動したら、タブレットのブラウザで `http://raspberrypi.local:8080` を開きます。

---

### 7. タブレットを常時表示に設定する

**iPad の場合**
1. 設定 → 画面表示と明るさ → 自動ロック → **「なし」**
2. 設定 → アクセシビリティ → アクセスガイド → オン
3. `http://raspberrypi.local:8080` をホーム画面に追加（PWA としてインストール）
4. PWA を起動してアクセスガイドを開始

**Android タブレットの場合**
1. 設定 → ディスプレイ → スリープ → **「なし」**
2. `http://raspberrypi.local:8080` をホーム画面に追加

---

## Make ターゲット一覧

| カテゴリ | コマンド | 説明 |
|---------|---------|------|
| セットアップ | `make setup` | venv 作成 + npm install |
| | `make setup-server` | サーバー venv のみ |
| | `make setup-webapp` | webapp npm install のみ |
| ビルド | `make build` | WebApp をビルド |
| 開発 | `make dev-server` | Flask 開発サーバー起動 |
| | `make dev-webapp` | Vite 開発サーバー起動 |
| サーバー制御 | `make start` | バックグラウンド起動（開発用） |
| | `make stop` | 停止 |
| | `make restart` | 再起動 |
| | `make status` | 稼働状況確認 |
| デプロイ | `make deploy` | ビルド + Pi へ転送 |
| | `make deploy-webapp` | WebApp のみ転送 |
| | `make deploy-server` | サーバーコードのみ転送 |
| サービス管理 | `make cron-install` | systemd 登録 + 自動起動設定 |
| | `make service-start` | `systemctl start` |
| | `make service-stop` | `systemctl stop` |
| | `make service-restart` | `systemctl restart` |
| | `make service-status` | `systemctl status` |
| | `make service-log` | ログをリアルタイム表示 |
| クリーン | `make clean` | ビルド成果物を削除 |
| | `make clean-all` | venv・node_modules も削除 |
| | `make clean-cache` | .ics キャッシュを削除 |

---

## 運用メモ

### ログの確認

```bash
ssh pi@raspberrypi.local
make service-log        # リアルタイムログ表示（Ctrl+C で終了）
```

### カレンダーが更新されない場合

```bash
# キャッシュを削除して強制再取得（サービス再起動で自動再取得）
make clean-cache
make service-restart
```

### サービスが起動しない場合

```bash
make service-status     # エラー内容を確認
```

よくある原因:
- `config.yaml` の `ics_url` が未設定または不正
- venv が作成されていない（`make setup-server` を実行）

---

## 詳細設計

[docs/01_design.md](docs/01_design.md) を参照してください。
