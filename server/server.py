#!/usr/bin/env python3
"""家族カレンダーサーバー"""

import logging
import os
import re
import sys
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import recurring_ical_events
import yaml
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify, request, send_from_directory
from icalendar import Calendar

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent
COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
JST = ZoneInfo("Asia/Tokyo")

# ===== 設定読み込み =====

def load_config(path: Path) -> dict:
    if not path.exists():
        logger.error(f"設定ファイルが見つかりません: {path}")
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    if not cfg.get("calendar", {}).get("ics_url"):
        logger.error("config.yaml に calendar.ics_url が設定されていません")
        sys.exit(1)

    if not cfg.get("members"):
        logger.error("config.yaml に members が設定されていません（1件以上必要）")
        sys.exit(1)

    # server セクションのデフォルト値
    srv = cfg.setdefault("server", {})
    srv.setdefault("port", 8080)
    srv.setdefault("fetch_interval_minutes", 5)
    srv.setdefault("cache_dir", "cache")

    # unassigned のデフォルト値
    cfg.setdefault("unassigned", {})
    cfg["unassigned"].setdefault("color", "#888888")

    # members の color バリデーション
    for m in cfg["members"]:
        if not COLOR_RE.match(m.get("color", "")):
            logger.warning(
                f"メンバー '{m['name']}' の color 値が不正です。#888888 を使用します。"
            )
            m["color"] = "#888888"

    return cfg


config = load_config(BASE_DIR / "config.yaml")

CACHE_DIR = BASE_DIR / config["server"]["cache_dir"]
CACHE_FILE = CACHE_DIR / "family.ics"
ICS_URL: str = config["calendar"]["ics_url"]
MEMBER_MAP: dict[str, str] = {m["name"]: m["color"] for m in config["members"]}
UNASSIGNED_COLOR: str = config["unassigned"]["color"]
FETCH_INTERVAL: int = max(1, config["server"]["fetch_interval_minutes"])

last_fetched: datetime | None = None

# ===== .ics 取得 =====

def fetch_ics() -> None:
    global last_fetched
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        req = urllib.request.Request(
            ICS_URL,
            headers={"User-Agent": "FamilyCalendarServer/1.0"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        CACHE_FILE.write_bytes(data)
        last_fetched = datetime.now(timezone.utc)
        logger.info("カレンダーを取得・更新しました")
    except Exception as exc:
        logger.error(f"カレンダーの取得に失敗しました: {exc}")


# ===== メンバー識別 =====

def _match_member(candidate: str) -> tuple[str, str] | None:
    """文字列がいずれかのメンバー名と完全一致すれば (name, color) を返す。"""
    name = candidate.strip()
    if name in MEMBER_MAP:
        return name, MEMBER_MAP[name]
    return None


def identify_member(description: str | None, title: str) -> tuple[str | None, str, str]:
    """
    メンバーを識別し (member_name, color, display_title) を返す。

    優先順位:
      1. DESCRIPTION 先頭行と members[].name の完全一致
      2. SUMMARY（タイトル）の「メンバー名:」プレフィックス
    どちらにも一致しない場合は member_name=None, color=UNASSIGNED_COLOR。
    タイトルを加工する場合のみ display_title が入力と異なる。
    """
    # 1. DESCRIPTION 先頭行で照合
    if description:
        result = _match_member(description.split("\n")[0])
        if result:
            return result[0], result[1], title

    # 2. SUMMARY プレフィックス「メンバー名:」で照合
    for name, color in MEMBER_MAP.items():
        prefix = name + ":"
        if title.startswith(prefix):
            # コロン直後の連続空白を除去
            display_title = title[len(prefix):].lstrip(" ")
            return name, color, display_title

    logger.warning(f"メンバー未識別のイベント (title='{title}')")
    return None, UNASSIGNED_COLOR, title


# ===== イベントパース =====

def parse_events(target_date: date) -> list[dict]:
    """target_date の全イベントをパースして返す（繰り返しイベント対応）。"""
    if not CACHE_FILE.exists():
        logger.warning("キャッシュファイルが存在しません")
        return []

    try:
        cal = Calendar.from_ical(CACHE_FILE.read_bytes())
    except Exception as exc:
        logger.error(f"ICS のパースに失敗しました: {exc}")
        return []

    # recurring_ical_events で繰り返しイベントを展開（終日・時間指定両対応）
    start_dt = datetime.combine(target_date, time.min).replace(tzinfo=JST)
    end_dt = start_dt + timedelta(days=1)
    try:
        components = recurring_ical_events.of(cal).between(start_dt, end_dt)
    except Exception as exc:
        logger.error(f"イベント展開に失敗しました: {exc}")
        return []

    events: list[dict] = []
    for component in components:
        dtstart = component.get("DTSTART")
        dtend = component.get("DTEND")
        if not dtstart:
            continue

        start_val = dtstart.dt
        end_val = dtend.dt if dtend else start_val

        # 終日イベント判定（date 型 かつ datetime でない）
        all_day = isinstance(start_val, date) and not isinstance(start_val, datetime)

        if all_day:
            start_str = start_val.isoformat()
            end_str = end_val.isoformat() if isinstance(end_val, date) else start_str
        else:
            if start_val.tzinfo is None:
                start_val = start_val.replace(tzinfo=JST)
            if isinstance(end_val, datetime):
                if end_val.tzinfo is None:
                    end_val = end_val.replace(tzinfo=JST)
                end_str = end_val.astimezone(JST).isoformat()
            else:
                end_str = start_val.astimezone(JST).isoformat()
            start_str = start_val.astimezone(JST).isoformat()

        # メンバー識別（DESCRIPTION 先頭行 → SUMMARY プレフィックスの順）
        raw_desc = str(component.get("DESCRIPTION") or "").strip()
        raw_title = str(component.get("SUMMARY") or "")
        member, color, display_title = identify_member(raw_desc or None, raw_title)

        # description 本文の組み立て
        if raw_desc:
            lines = raw_desc.split("\n")
            # 方法 A（DESCRIPTION 先頭行）で識別できた場合は先頭行を除く
            if member is not None and lines[0].strip() == member:
                desc_body = "\n".join(lines[1:]).strip() or None
            else:
                # 方法 B（タイトルプレフィックス）または未識別の場合は全行を本文とする
                desc_body = raw_desc
        else:
            desc_body = None

        events.append({
            "id": str(component.get("UID", "")),
            "title": display_title,
            "member": member,
            "color": color,
            "start": start_str,
            "end": end_str,
            "allDay": all_day,
            "location": str(component.get("LOCATION") or "").strip() or None,
            "description": desc_body or None,
        })

    # 終日イベントを先頭に、同種は開始時刻順
    events.sort(key=lambda e: (0 if e["allDay"] else 1, e["start"]))
    return events


# ===== Flask アプリ =====

DIST_DIR = BASE_DIR / "dist"
app = Flask(__name__, static_folder=str(DIST_DIR) if DIST_DIR.exists() else None)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "last_fetched": last_fetched.isoformat() if last_fetched else None,
    })


MEMBERS_LIST = [{"name": m["name"], "color": m["color"]} for m in config["members"]]


@app.route("/api/events/today")
def events_today():
    today = datetime.now(JST).date()
    return jsonify({
        "date": today.isoformat(),
        "last_fetched": last_fetched.isoformat() if last_fetched else None,
        "members": MEMBERS_LIST,
        "events": parse_events(today),
    })


@app.route("/api/events")
def events_by_date():
    date_str = request.args.get("date", "")
    if not date_str:
        return jsonify({"error": "date パラメーターが必要です (例: ?date=2026-04-11)"}), 400
    try:
        target = date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "date は YYYY-MM-DD 形式で指定してください"}), 400
    return jsonify({
        "date": target.isoformat(),
        "last_fetched": last_fetched.isoformat() if last_fetched else None,
        "members": MEMBERS_LIST,
        "events": parse_events(target),
    })


# PWA 静的ファイル配信（dist/ が存在する場合のみ）
if DIST_DIR.exists():
    @app.route("/")
    def index():
        return send_from_directory(str(DIST_DIR), "index.html")

    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Not found"}), 404
        return send_from_directory(str(DIST_DIR), "index.html")


# ===== エントリポイント =====

if __name__ == "__main__":
    fetch_ics()

    scheduler = BackgroundScheduler(timezone=timezone.utc)
    scheduler.add_job(fetch_ics, "interval", minutes=FETCH_INTERVAL)
    scheduler.start()
    logger.info(f".ics を {FETCH_INTERVAL} 分ごとに取得します")

    port = config["server"]["port"]
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    logger.info(f"サーバー起動: http://0.0.0.0:{port}  debug={debug}")

    try:
        app.run(host="0.0.0.0", port=port, debug=debug)
    finally:
        scheduler.shutdown()
