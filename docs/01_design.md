# 家族カレンダー表示システム — 要件定義・設計書

## 1. プロジェクト概要

### 1.1 目的

リビングに設置したタブレット端末で、家族全員の今日の予定を常時表示する。
各家族メンバーはiPhoneでカレンダーを管理し、スマホを持たないメンバーの予定は親が代理入力する。

### 1.2 システム構成概要

```
┌─────────────┐   iCloud同期（家族共有カレンダーに入力）
│  iPhone x N  │ ──────────────────────────────────────▶  ┌──────────────────┐
│（各家族メンバー）│   ※イベントのコメント先頭行に名前を記入            │  iCloud Calendar  │
│              │   例) DESCRIPTION: "パパ\n打ち合わせ"        │  （家族共有1つ）    │
└─────────────┘                                          │  （公開.ics URL）  │
                                                         └────────┬─────────┘
                                                                  │ HTTPS（5分間隔）
                                                                  ▼
                                                       ┌─────────────────────┐
                                                       │  Raspberry Pi Zero W │
                                                       │  （自宅LAN内常時稼働）  │
                                                       │                     │
                                                       │  ・.ics定期取得      │
                                                       │  ・コメント先頭行で   │
                                                       │    メンバー識別      │
                                                       │  ・CORS付きHTTP配信  │
                                                       └────────┬────────────┘
                                                                │ HTTP（LAN内）
                                                                ▼
                                                       ┌─────────────────────┐
                                                       │  タブレット端末       │
                                                       │  （ブラウザ常時表示）   │
                                                       │                     │
                                                       │  PWA（React/TS）     │
                                                       │  今日の予定一覧表示    │
                                                       └─────────────────────┘
```

---

## 2. 要件定義

### 2.1 機能要件

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-01 | iCloudの公開カレンダー（.ics形式）を定期的に取得しキャッシュする | 必須 |
| FR-02 | イベントのコメント（DESCRIPTION）先頭行に記載されたメンバー名を読み取り、誰の予定かを識別する | 必須 |
| FR-03 | 今日の予定を時系列順で一覧表示する | 必須 |
| FR-04 | 家族メンバーごとに色分け表示する | 必須 |
| FR-05 | 終日イベントと時間指定イベントを区別して表示する | 必須 |
| FR-06 | 日付が変わったら自動的に表示を更新する | 必須 |
| FR-07 | 現在時刻を表示する | 必須 |
| FR-08 | 予定データを一定間隔で自動リフレッシュする | 必須 |
| FR-09 | 明日以降の予定（数日先）も確認できる | 任意 |
| FR-10 | 天気情報を表示する | 任意 |

### 2.2 非機能要件

| ID | 要件 | 詳細 |
|----|------|------|
| NFR-01 | 常時表示 | アプリが中断せず画面に表示され続けること |
| NFR-02 | 自動復帰 | ネットワーク断・サーバー再起動時に自動で再接続すること |
| NFR-03 | 省リソース | Pi Zero W（RAM 512MB）で安定動作すること |
| NFR-04 | プライバシー | カレンダーデータが自宅LAN外に流出しないこと（iCloudへの取得通信を除く） |
| NFR-05 | 低メンテナンス | 一度セットアップしたら日常的な操作が不要であること |
| NFR-06 | 視認性 | リビングから離れた位置（2〜3m）でも予定が読める文字サイズであること |
| NFR-07 | レスポンス | データ受信後の画面描画（state更新→DOM反映）が1秒以内に完了すること（データ取得間隔とは独立した要件） |

### 2.3 制約事項

| ID | 制約 |
|----|------|
| C-01 | サーバーはRaspberry Pi Zero W（ARMv6, RAM 512MB, Raspberry Pi OS Lite） |
| C-02 | サーバー実装はPython 3（標準ライブラリ + 最小限の依存） |
| C-03 | PWAはReact + TypeScript + shadcn/ui で実装 |
| C-04 | Docker不使用（ARMv6非対応のため） |
| C-05 | 外部クラウドサービスへの依存は最小限（iCloud公開URLのみ） |

---

## 3. 設計

### 3.1 サーバー設計（Raspberry Pi Zero W）

#### 3.1.1 技術スタック

| 要素 | 選定 | 理由 |
|------|------|------|
| HTTP フレームワーク | Flask | 軽量、Pi Zeroでも十分動作 |
| .ics パーサー | icalendar | Python標準的なiCalendarライブラリ |
| 設定ファイル | PyYAML（pyyaml） | コメント記述可能なYAML形式 |
| スケジューラー | APScheduler or cron | 定期的な.ics取得 |
| 仮想環境 | venv（標準ライブラリ） | システムPythonを汚染しない、Pi Zero Wでも動作 |
| 操作統一 | GNU Make | ビルド・起動・停止・デプロイ等を単一インターフェースで提供 |
| プロセス管理 | systemd | OS標準、自動起動・再起動 |

#### 3.1.2 ディレクトリ構成

リポジトリルートに `Makefile` を置き、`server/`・`webapp/` をサブディレクトリとして管理する。

```
（リポジトリルート）
├── Makefile               # 全操作の統一インターフェース
├── server/
│   ├── server.py          # メインアプリケーション
│   ├── config.yaml        # カレンダーURL・メンバー設定
│   ├── requirements.txt   # Pythonパッケージ一覧
│   ├── family-calendar.service  # systemdサービスファイルテンプレート
│   ├── venv/              # Python仮想環境（git管理対象外）
│   └── cache/             # 取得した.icsのキャッシュ（git管理対象外）
└── webapp/
    ├── package.json
    ├── src/
    └── dist/              # Viteビルド成果物（git管理対象外）
```

#### 3.1.3 venv 仕様

Python の実行には `venv` による仮想環境を使用する。システムの Python 環境を汚染せず、依存パッケージのバージョンを固定できる。

##### セットアップ手順

```bash
cd /home/pi/family-calendar-server

# 仮想環境の作成
python3 -m venv venv

# 仮想環境の有効化
source venv/bin/activate

# パッケージのインストール
pip install -r requirements.txt
```

##### requirements.txt

```
flask>=3.0
icalendar>=6.0
pyyaml>=6.0
APScheduler>=3.10
```

バージョンは `>=` で下限のみ指定し、Pi Zero Wで動作確認済みの最低バージョンを明記する。インストール後に `pip freeze > requirements.lock` で完全固定版を別途保存することを推奨する。

##### 運用上の注意

- `venv/` および `cache/` は `.gitignore` に追加し、リポジトリには含めない
- パッケージ追加・更新時は `venv` を有効化した状態で `pip install` し、`requirements.txt` を手動更新する
- `server.py` は仮想環境外から直接 `python3 server.py` で起動しない。必ず venv 内の Python を使用する（systemd 経由または `source venv/bin/activate` 後に起動）

#### 3.1.4 設定ファイル（config.yaml）

設定ファイルはYAML形式を採用する。JSONに比べてコメントが書けるため、iCloud URLなどの補足情報を直接ファイルに記載できる。

```yaml
# 家族カレンダーサーバー設定

server:
  port: 8080
  fetch_interval_minutes: 5   # iCloudからの.ics取得間隔（分）
  cache_dir: cache             # キャッシュディレクトリ（server.pyからの相対パス）

calendar:
  ics_url: "https://p**-caldav.icloud.com/published/2/..."   # 家族共有カレンダーのiCloud公開URL

members:
  - name: パパ
    color: "#4A90D9"
  - name: ママ
    color: "#E85D75"
  - name: 太郎
    color: "#50C878"
  - name: 花子
    color: "#FFB347"

unassigned:
  color: "#888888"   # メンバー識別できなかったイベントの色
```

##### 設定項目一覧

| キー | 型 | 必須 | デフォルト | 説明 |
|------|----|------|------------|------|
| `server.port` | int | 任意 | `8080` | HTTPサーバーのリッスンポート |
| `server.fetch_interval_minutes` | int | 任意 | `5` | .ics取得間隔（分）。最小値は1 |
| `server.cache_dir` | str | 任意 | `cache` | キャッシュ保存先ディレクトリ |
| `calendar.ics_url` | str | **必須** | — | 家族共有カレンダーのiCloud公開.ics URL |
| `members` | list | **必須** | — | メンバー定義のリスト（1件以上） |
| `members[].name` | str | **必須** | — | 表示名（例: "パパ"）。イベントのコメント先頭行と照合する |
| `members[].color` | str | **必須** | — | 表示色（CSSカラーコード `#RRGGBB`） |
| `unassigned.color` | str | 任意 | `#888888` | メンバー未識別イベントの表示色 |

##### 読み込み仕様

- 起動時に `config.yaml` を読み込む。ファイルが存在しない場合は起動を中断してエラーログを出力する
- `PyYAML`（`pyyaml` パッケージ）を使用してパースする
- `server` セクションが省略された場合はデフォルト値を使用する
- `calendar.ics_url` が存在しない場合は起動を中断する
- `members` が空リストまたは存在しない場合は起動を中断する
- `members[].color` の値が `#RRGGBB` 形式でない場合は警告ログを出力し、フォールバック値 `#888888` を使用する

#### 3.1.5 APIエンドポイント

| メソッド | パス | 説明 | レスポンス |
|---------|------|------|-----------|
| GET | `/api/events/today` | 今日のイベント一覧 | JSON |
| GET | `/api/events?date=YYYY-MM-DD` | 指定日のイベント一覧 | JSON |
| GET | `/api/health` | ヘルスチェック | JSON |

#### 3.1.6 レスポンス形式

**GET /api/events/today**

```json
{
  "date": "2026-04-11",
  "last_fetched": "2026-04-11T08:30:00+09:00",
  "events": [
    {
      "id": "uuid-string",
      "title": "歯医者",
      "member": "ママ",
      "color": "#E85D75",
      "start": "2026-04-11T10:00:00+09:00",
      "end": "2026-04-11T11:00:00+09:00",
      "allDay": false,
      "location": "○○歯科",
      "description": "○○歯科 2階"
    },
    {
      "id": "uuid-string",
      "title": "運動会",
      "member": "太郎",
      "color": "#50C878",
      "start": "2026-04-11",
      "end": "2026-04-11",
      "allDay": true,
      "location": "○○小学校",
      "description": "持ち物: 体操服"
    },
    {
      "id": "uuid-string",
      "title": "ゴミ捨て",
      "member": null,
      "color": "#888888",
      "start": "2026-04-11",
      "end": "2026-04-11",
      "allDay": true,
      "location": null,
      "description": null
    }
  ]
}
```

#### 3.1.7 メンバー識別仕様

メンバーの識別方法は以下の**2通り**を用意する。どちらを使っても同じ結果が得られる。

##### 方法 A：メモ欄（DESCRIPTION）の先頭行にメンバー名を記入する

iPhoneのカレンダーアプリでイベントを作成・編集するとき、**メモ欄の1行目**にメンバー名のみを記入する。

```
例）
  タイトル: 打ち合わせ
  メモ:     パパ            ← 1行目にメンバー名のみ
            詳細メモ...    ← 2行目以降はメモ本文（省略可）

  タイトル: 歯医者
  メモ:     ママ
```

##### 方法 B：タイトルの先頭に「メンバー名:」を付ける

タイトルを `メンバー名: タイトル本文` の形式で入力する。メモ欄への記入が不要で手軽に使える。

```
例）
  タイトル: パパ: 打ち合わせ   → 表示タイトルは「打ち合わせ」
  タイトル: ママ: 歯医者        → 表示タイトルは「歯医者」
  タイトル: 太郎:運動会         → 表示タイトルは「運動会」（コロン直後の空白は除去）
```

- コロン（`:`）はASCIIのコロン（U+003A）に限る
- コロンの直後にある**連続した空白**はすべて除去してタイトルを表示する
- メモ欄は従来通り本文として利用可能

##### 識別の優先順位

両方が設定されている場合は **方法 A（DESCRIPTION）を優先**する。

```
① DESCRIPTION の先頭行をトリムして members[].name と完全一致で照合
     ├─ 一致した → そのメンバーの color を使用、DESCRIPTION 2行目以降を description に格納
     └─ 不一致・未設定
          ↓
② SUMMARY（タイトル）が「メンバー名:」で始まるか照合
     ├─ 一致した → そのメンバーの color を使用、プレフィックスを除去した文字列を title として返す
     └─ 不一致
          → member: null、color: unassigned.color、警告ログを出力
```

##### 共通ルール

- 照合は**完全一致**とする（前後の空白除去後）
- DESCRIPTION・SUMMARY ともに一致しない場合も「未識別」として表示は継続する（クラッシュしない）
- 方法 A で識別した場合、DESCRIPTION の**2行目以降**を `description` フィールドに格納する
- 方法 B で識別した場合、DESCRIPTION が存在する場合は**全行**を `description` フィールドに格納する

#### 3.1.8 処理フロー

キャッシュファイルは `cache/family.ics` の**1ファイル固定**で、取得のたびに上書きする。ファイルが増え続けることはなく、ディスク枯渇は発生しない。`make clean-cache` はトラブルシューティング（強制再取得）用途のみ。

```
[起動時]
  │
  ├─ config.yaml 読み込み
  ├─ カレンダーの.icsを初回取得 → cache/family.ics を上書き保存
  └─ HTTPサーバー起動（ポート8080）

[5分ごと（バックグラウンド）]
  │
  ├─ calendar.ics_url に HTTPS GET
  ├─ 取得成功 → cache/family.ics を上書き更新
  └─ 取得失敗 → 前回キャッシュを維持（ログ出力）

[APIリクエスト受信時]
  │
  ├─ cache/family.ics をパース
  ├─ 指定日のイベントを抽出
  ├─ 各イベントの DESCRIPTION 先頭行 → SUMMARY プレフィックスの順でメンバーを識別 → member名・color・表示title を付与
  ├─ 時系列ソート（終日イベントは先頭、同時刻は登録順）
  └─ JSON返却
```

#### 3.1.9 CORSポリシー

LAN内通信のみを想定するが、ブラウザのCORS制約に対応するため全レスポンスに以下を付与する。

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

本システムはLAN内でのみ稼働するため `*` で問題ない。

### 3.2 PWA設計（React / TypeScript / shadcn/ui）

#### 3.2.1 技術スタック

| 要素 | 選定 | 理由 |
|------|------|------|
| フレームワーク | React 18 | コンポーネントベースで保守しやすい |
| 言語 | TypeScript | 型安全 |
| UIライブラリ | shadcn/ui | 軽量でカスタマイズ性が高い |
| スタイル | Tailwind CSS | shadcn/uiの前提、ユーティリティファースト |
| ビルド | Vite | 高速ビルド |
| 日時処理 | date-fns | 軽量な日付ライブラリ |

#### 3.2.2 ページ構成

本アプリはシングルページ（SPA）で、ルーティングは不要。

#### 3.2.3 コンポーネントツリー

```
App
├── Header
│   ├── CurrentDate        # 今日の日付（「4月11日 土曜日」）
│   └── CurrentTime        # 現在時刻（リアルタイム更新）
├── AllDayEvents           # 終日イベント一覧
│   └── EventCard          # 終日イベントカード × N
├── TimelineEvents         # 時間指定イベント一覧
│   └── EventCard          # 時間指定イベントカード × N
├── EmptyState             # 予定がない場合の表示
└── StatusBar
    ├── ConnectionStatus   # サーバー接続状態
    └── LastUpdated        # 最終更新時刻
```

#### 3.2.4 EventCard コンポーネント仕様

```
┌──────────────────────────────────────────────────┐
│  ● ママ                            10:00 – 11:00  │  ← 時刻は大きく・太く・右寄せ
│    歯医者                                         │  ← タイトルは最大フォント
│    📍 ○○歯科                                      │
└──────────────────────────────────────────────────┘
     ▲色付きドット（member.color）
```

| 要素 | 表示仕様 |
|------|---------|
| 色付きドット | メンバーのテーマカラー（左端） |
| メンバー名 | ドットの右隣、小さめのセカンダリテキスト |
| 時刻 | 右端に大きく・太字で表示。終日イベントは「終日」 |
| タイトル | 2行目、最も大きいフォントサイズ（`text-2xl`） |
| 場所 | 3行目、ピンアイコン付きのセカンダリテキスト（あれば） |

時刻を最も視認しやすい要素として設計する（距離 2〜3m でも判読できるサイズ）。

#### 3.2.5 変更反映の仕組み

##### エンドツーエンドの伝播経路

予定の変更は以下のポーリング2段構成で自動反映される。プッシュ通知は使用しない。

```
① iPhone でイベントを編集・追加
      │
      │  iCloud が自動同期（通常数十秒〜数分、Appleの処理）
      ▼
② iCloud 上の .ics が更新される
      │
      │  Pi が 5分ごとに .ics を取得（fetch_interval_minutes）
      ▼
③ Pi のキャッシュ（cache/family.ics）が更新される
      │
      │  PWA が 5分ごとに /api/events/today をポーリング
      ▼
④ タブレットの表示が更新される
```

##### 最大遅延

| 区間 | 遅延 | 制御可否 |
|------|------|---------|
| iCloud 同期（iPhone → iCloud） | 数十秒〜数分 | 不可（Apple依存） |
| Pi の .ics 取得間隔 | 最大 5分 | `fetch_interval_minutes` で調整可 |
| PWA のポーリング間隔 | 最大 5分 | PWA 側の interval で調整可 |
| **合計（最悪ケース）** | **約 10〜12分** | — |

家族のリビング用途では最大約10分の反映遅延を許容仕様とする。急ぎの共有が必要な場合は口頭・LINEで連絡することを運用で補う。

##### ポーリング間隔の調整指針

| 間隔 | 特性 |
|------|------|
| 5分（デフォルト） | Pi Zero W・iCloud サーバーへの負荷が最小 |
| 1分 | 反映が早くなるが Pi の CPU・iCloud への通信が増える |
| 10分以上 | 負荷は下がるが鮮度が落ちる。終日イベントなら十分 |

Pi Zero W の性能を考慮し、**デフォルト 5分を推奨**する。

#### 3.2.6 データフロー（PWA内部）

```
[初回表示]
  │
  ├─ Pi サーバーの /api/events/today にGET
  ├─ レスポンスをstateに格納
  └─ 画面描画

[自動リフレッシュ（5分間隔）]
  │
  ├─ /api/events/today にGET
  ├─ state更新 → 再描画
  └─ 失敗時はリトライ（30秒後）、前回データを維持

[日付変更検知（1分ごとにチェック）]
  │
  └─ 日付が変わっていたら /api/events/today を即時再取得

[現在時刻表示]
  │
  └─ 1秒ごとにsetIntervalで更新
```

#### 3.2.7 状態管理

React hooks（useState / useEffect）のみで管理する。状態管理ライブラリは不要。

```typescript
interface Event {
  id: string;
  title: string;
  member: string;
  color: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
}

interface AppState {
  events: Event[];
  lastUpdated: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}
```

#### 3.2.8 環境設定

PWA と API サーバーは同一オリジンで動作するため（4.3 参照）、API のベース URL は空文字列とし相対パスでリクエストする。

```
# .env
VITE_API_BASE_URL=
```

開発時（`npm run dev`）はローカルの Vite dev server と Pi の Flask が別オリジンになるため、`.env.development` でポートを明示する。

```
# .env.development
VITE_API_BASE_URL=http://raspberrypi.local:8080
```

#### 3.2.9 PWAマニフェスト

```json
{
  "name": "Family Calendar",
  "short_name": "Calendar",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#f1f5f9",
  "theme_color": "#f1f5f9"
}
```

`display: fullscreen` により、ブラウザのアドレスバー等を非表示にし、ネイティブアプリに近い表示を実現する。

#### 3.2.10 画面モックアップ

ライトテーマ（slate-100 ベース）を採用し、視認性を優先する。

```
╔══════════════════════════════════════════════════════════╗  ← 白背景ヘッダー
║  4月11日（土）                              15:32:08      ║
╠══════════════════════════════════════════════════════════╣  ← slate-100 背景
║                                                          ║
║  終日 ──────────────────────────────────────────────     ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │ 🟢 太郎                                    終日   │   ║  ← 白カード
║  │   運動会                                         │   ║
║  │   📍 ○○小学校                                    │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  時間指定 ───────────────────────────────────────────    ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │ 🔵 パパ                          09:00 – 10:00   │   ║  ← 時刻を大きく右寄せ
║  │   チームMTG                                      │   ║
║  └──────────────────────────────────────────────────┘   ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │ 🔴 ママ                          10:00 – 11:00   │   ║
║  │   歯医者                                         │   ║
║  │   📍 ○○歯科                                      │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║  ● 接続中　最終更新: 15:30                               ║  ← 白背景ステータスバー
╚══════════════════════════════════════════════════════════╝
```

カラーパレット:

| 要素 | クラス | カラーコード |
|------|-------|-------------|
| ページ背景 | `bg-slate-100` | #f1f5f9 |
| ヘッダー・カード・ステータスバー背景 | `bg-white` | #ffffff |
| 区切り線 | `border-slate-200` | #e2e8f0 |
| 主要テキスト | `text-slate-900` | #0f172a |
| 補助テキスト | `text-slate-500` | #64748b |
| セクション見出し | `text-slate-400` | #94a3b8 |

### 3.3 Makefile 仕様

リポジトリルートに置いた単一の `Makefile` で、ビルド・開発・デプロイ・サービス管理・cron設定まで全操作を統一する。

#### 3.3.1 変数

```makefile
PI_HOST     ?= pi@raspberrypi.local   # Pi のSSHアドレス（環境変数で上書き可）
PI_DIR      ?= /home/pi/family-calendar-server
SERVICE     ?= family-calendar
PYTHON      := server/venv/bin/python
PIP         := server/venv/bin/pip
```

#### 3.3.2 ターゲット一覧

| カテゴリ | ターゲット | 説明 |
|----------|-----------|------|
| **セットアップ** | `setup` | `setup-server` + `setup-webapp` を実行 |
| | `setup-server` | `server/venv` を作成し `pip install -r requirements.txt` |
| | `setup-webapp` | `webapp/` で `npm install` |
| **ビルド** | `build` | PWA をビルド（`build-webapp` の別名） |
| | `build-webapp` | `webapp/` で `npm run build` → `webapp/dist/` を生成 |
| **開発** | `dev-server` | Flask 開発サーバーを起動（`0.0.0.0:8080`） |
| | `dev-webapp` | Vite 開発サーバーを起動（`0.0.0.0:5173`） |
| **サーバー制御** | `start` | Flask サーバーをバックグラウンドで起動し PIDファイルを保存 |
| | `stop` | PIDファイルを参照してサーバーを停止 |
| | `restart` | `stop` → `start` |
| | `status` | サーバープロセスの稼働状況を表示 |
| **デプロイ** | `deploy` | `build` → `deploy-webapp` → `deploy-server` を順に実行 |
| | `deploy-webapp` | `webapp/dist/` を rsync で Pi の `dist/` に転送 |
| | `deploy-server` | `server/` を rsync で Pi に転送（`venv/`・`cache/` は除外） |
| **サービス管理** | `service-install` | systemd サービスファイルを Pi に配置し `daemon-reload` |
| | `service-enable` | サービスを OS 起動時に自動開始するよう設定（`systemctl enable`） |
| | `service-start` | `systemctl start` |
| | `service-stop` | `systemctl stop` |
| | `service-restart` | `systemctl restart` |
| | `service-status` | `systemctl status` |
| | `service-log` | `journalctl -u $(SERVICE) -f` でログをリアルタイム表示 |
| **cron** | `cron-install` | `service-install` + `service-enable` を実行し、サービスを永続化する |
| **クリーン** | `clean` | ビルド成果物（`webapp/dist/`）を削除 |
| | `clean-all` | `clean` + `server/venv/`・`webapp/node_modules/` も削除 |
| | `clean-cache` | `server/cache/` の .ics キャッシュを削除 |

#### 3.3.3 主な使用シナリオ

**初回セットアップ（開発マシン）**

```bash
make setup          # venv 作成 + npm install
```

**開発中（開発マシン）**

```bash
make dev-server     # ターミナル1: Flask 起動
make dev-webapp     # ターミナル2: Vite 起動
```

**Pi へのデプロイ（開発マシン）**

```bash
make deploy         # ビルド → rsync で Pi に転送
```

**Pi 初回セットアップ（Pi 上で実行）**

```bash
make setup-server   # venv 作成 + pip install
make cron-install   # systemd サービスを登録・有効化し自動起動を設定
make service-start  # サービスを即時起動
```

**通常運用（Pi 上または開発マシンから SSH 越し）**

```bash
make service-status   # 稼働確認
make service-log      # ログ確認
make service-restart  # 設定変更後の再起動
make clean-cache      # キャッシュの手動クリア
```

#### 3.3.4 PIDファイルによるサーバー制御

`start` / `stop` ターゲットは systemd を使わずに Flask を直接操作する手段として提供する（開発・デバッグ用途）。PID を `server/server.pid` に保存し、`stop` で `kill` する。

```makefile
start:
	cd server && $(PYTHON) server.py & echo $$! > server/server.pid

stop:
	@if [ -f server/server.pid ]; then \
	  kill $$(cat server/server.pid) && rm server/server.pid; \
	else \
	  echo "PID file not found. Server may not be running."; \
	fi
```

本番（Pi）では `service-start` / `service-stop` を使用し、`start` / `stop` は使用しない。

---

## 4. デプロイ・運用設計

### 4.1 Pi Zero W セットアップ手順

1. Raspberry Pi OS Lite（32bit）をmicroSDに書き込み
2. Wi-Fi設定（wpa_supplicant.conf）
3. SSH有効化
4. リポジトリを Pi にクローン（`git clone ... /home/pi/family-calendar-server`）
5. `server/config.yaml` を編集（iCloud URL・メンバー情報を設定）
6. Pi 上で以下を実行してサービスを起動・永続化する

```bash
make setup-server    # venv 作成 + 依存パッケージインストール
make cron-install    # systemd サービス登録・有効化（OS起動時の自動起動を設定）
make service-start   # サービスを即時起動
make service-status  # 起動確認
```

### 4.2 systemdサービス定義

`ExecStart` には venv 内の Python インタープリターをフルパスで指定する。これにより `source venv/bin/activate` なしでも仮想環境のパッケージが使われる。

```ini
[Unit]
Description=Family Calendar Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/family-calendar-server
ExecStart=/home/pi/family-calendar-server/venv/bin/python server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 4.3 PWAのホスティング

**Flask が API と静的ファイル（PWA）を同一ポートで配信する**方式を採用する。

#### 仕組み

```
タブレット（ブラウザ）
  │
  │  GET /              → index.html（PWA本体）
  │  GET /assets/*.js   → JSバンドル
  │  GET /assets/*.css  → CSS
  │  GET /api/events/today → JSON（カレンダーデータ）
  │
  └─────────────────────────────▶  Flask on :8080
                                    ├─ static: dist/（Viteビルド成果物）
                                    └─ routes: /api/*
```

PWA と API が**同一オリジン**（`http://raspberrypi.local:8080`）になるため:
- PWA 側の `VITE_API_BASE_URL` は空文字列 `""` でよく、`/api/events/today` のような相対パスでリクエストできる
- ブラウザの CORS 制約が発生しない（CORS ヘッダーは不要になるが、外部からの直接 API アクセスに備えて設定は維持する）

#### ディレクトリ構成（デプロイ後）

```
/home/pi/family-calendar-server/
├── server.py
├── config.yaml
├── requirements.txt
├── venv/
├── cache/
└── dist/                  ← Vite ビルド成果物をここに配置
    ├── index.html
    └── assets/
        ├── index-xxxx.js
        └── index-xxxx.css
```

#### Flask 側の実装方針

```python
# dist/ を静的ファイルのルートとして設定
app = Flask(__name__, static_folder="dist", static_url_path="")

# / への GET は index.html を返す（PWA エントリポイント）
@app.route("/")
def index():
    return send_from_directory("dist", "index.html")

# /api/* 以外の未知パスも index.html へフォールバック（SPA ルーティング対応）
@app.errorhandler(404)
def not_found(e):
    return send_from_directory("dist", "index.html")
```

#### ビルドとデプロイ手順

PWA のビルドは Pi 上では行わない（ARMv6 + 512MB RAM では Node.js ビルドが極めて遅い）。開発マシンでビルドして転送する。

```bash
# 1. 開発マシン: PWA をビルド
cd webapp
npm run build          # dist/ が生成される

# 2. 開発マシン: Pi に転送
rsync -av dist/ pi@raspberrypi.local:/home/pi/family-calendar-server/dist/

# 3. サーバーの再起動は不要（Flask は起動時に dist/ を読み込む）
```

> Pi の IP アドレスが変わる場合は `/etc/hosts` や mDNS（`raspberrypi.local`）を使うこと。

### 4.4 タブレット常時表示設定

**iPadの場合**
- 設定 → 画面表示と明るさ → 自動ロック → 「なし」
- 設定 → アクセシビリティ → アクセスガイド → オン
- PWAをホーム画面に追加 → 起動 → アクセスガイド開始

**Androidの場合**
- 設定 → ディスプレイ → スリープ → 「なし」
- Fully Kiosk Browser（無料）でPWAのURLを常時表示

### 4.5 監視・メンテナンス

| 項目 | 方法 |
|------|------|
| サーバー死活監視 | PWAのStatusBarで接続状態を常時表示 |
| ログ | journalctl -u family-calendar でsystemdログ確認 |
| .ics取得失敗 | ログに出力 + PWAの最終更新時刻が古くなることで気づける |
| Pi再起動 | systemdにより自動でサーバー再起動 |
| OS更新 | 月1回程度 `sudo apt update && sudo apt upgrade` |

---

## 5. セキュリティ考慮事項

| リスク | 対策 |
|--------|------|
| LAN外からのアクセス | Piのサーバーはポートフォワーディングしない。LAN内のみ |
| iCloud公開URLの漏洩 | config.yamlのパーミッションを600に設定 |
| Pi自体の侵害 | SSH鍵認証のみ、パスワード認証無効化 |
| カレンダーデータの盗聴 | LAN内HTTP通信のため低リスク（必要ならmkcertで自己署名TLS） |

---

## 6. 将来の拡張案

| 拡張 | 概要 |
|------|------|
| 天気表示 | OpenWeather API等から天気情報を取得して表示 |
| 複数日表示 | 今日だけでなく週間表示モードを追加 |
| ダークモード | 夜間自動切替で眩しさを軽減 |
| 通知音 | 予定の直前にタブレットから音を鳴らす |
| ゴミ出しリマインダー | 曜日ベースの定型イベントを自動表示 |
