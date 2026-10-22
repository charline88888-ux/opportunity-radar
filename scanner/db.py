"""SQLite 派生库（data/radar.db）：由 JSON 全量重建，不手工维护、不入库。

表：
- meta            数据版本 / 基准日 / 重建时间 / 来源
- opportunities   机会主表（含评分与窗口字段）
- evidence        证据表（opportunities × evidence）
- rankings_history 历史快照名次（data/history/*.json 全量）
- source_health   在线采集源健康度（data/source-health.json，若存在）

用法：
    python scanner/db.py --rebuild      # 从 data/*.json 重建 data/radar.db
    python scanner/db.py --info         # 打印行数与文件路径
"""
from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 支持 python scanner/db.py 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import common, config, history  # noqa: E402
else:  # pragma: no cover
    from . import common, config, history

SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE opportunities (
    id TEXT PRIMARY KEY,
    slug TEXT, title TEXT, one_liner TEXT,
    industry_id TEXT, origin_country TEXT,
    grade TEXT, total REAL, rank_score REAL, momentum REAL, evidence_count INTEGER,
    first_seen TEXT, last_activity TEXT,
    window_status TEXT, months_left INTEGER, decay TEXT,
    verified INTEGER,
    region_ids TEXT, tag_ids TEXT
);
CREATE TABLE evidence (
    opp_id TEXT NOT NULL, idx INTEGER NOT NULL,
    title TEXT, publisher TEXT, url TEXT, date TEXT, tier TEXT, lang TEXT,
    PRIMARY KEY (opp_id, idx)
);
CREATE TABLE rankings_history (
    snapshot_date TEXT NOT NULL, window TEXT NOT NULL, rank INTEGER NOT NULL,
    opp_id TEXT NOT NULL, rank_score REAL, total REAL,
    delta INTEGER, change TEXT, delta_basis TEXT,
    PRIMARY KEY (snapshot_date, window, rank)
);
CREATE TABLE source_health (
    source_id TEXT PRIMARY KEY, name TEXT, url TEXT, access TEXT, compliance TEXT,
    ok INTEGER, http_status INTEGER, latency_ms INTEGER, items INTEGER,
    checked_at TEXT, error TEXT
);
CREATE INDEX idx_evidence_opp ON evidence(opp_id);
CREATE INDEX idx_history_opp ON rankings_history(opp_id);
"""


def _connect(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(str(db_path))
    connection.executescript(SCHEMA)
    return connection


def rebuild(db_path: Path | None = None, data_dir: Path | None = None) -> dict[str, Any]:
    """从 JSON 全量重建 SQLite；先写临时文件再原子替换，避免半成品。"""
    db_path = db_path or config.DB_PATH
    data_dir = data_dir or config.DATA_DIR
    db_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = db_path.with_suffix(".db.tmp")
    if temp_path.exists():
        temp_path.unlink()

    opportunities = common.load_json(data_dir / "opportunities.json")
    rankings = common.load_json(data_dir / "rankings.json")
    history_dir = data_dir / "history"
    source_health_path = data_dir / "source-health.json"

    connection = _connect(temp_path)
    counts = {"opportunities": 0, "evidence": 0, "rankings_history": 0, "source_health": 0}
    try:
        with connection:
            connection.executemany(
                "INSERT INTO meta(key, value) VALUES (?, ?)",
                [
                    ("data_version", config.DATA_VERSION),
                    ("as_of", str((rankings.get("meta") or {}).get("as_of", ""))),
                    ("generator", "scanner/db.py"),
                    # 不写真实重建时间：保证同一份 JSON 重建出的 db 内容稳定（便于复验）
                    ("rebuilt_from", "data/*.json + data/history/*.json"),
                ],
            )
            for opp in sorted(opportunities, key=lambda item: item["id"]):
                connection.execute(
                    "INSERT INTO opportunities VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        opp["id"],
                        opp.get("slug"),
                        opp.get("title"),
                        opp.get("one_liner"),
                        opp.get("industry_id"),
                        opp.get("origin_country"),
                        (opp.get("scores") or {}).get("grade"),
                        (opp.get("scores") or {}).get("total"),
                        opp.get("rank_score"),
                        opp.get("momentum"),
                        opp.get("evidence_count"),
                        opp.get("first_seen"),
                        opp.get("last_activity"),
                        (opp.get("window") or {}).get("status"),
                        (opp.get("window") or {}).get("months_left"),
                        (opp.get("window") or {}).get("decay"),
                        1 if opp.get("verified") else 0,
                        json.dumps(opp.get("region_ids") or [], ensure_ascii=False),
                        json.dumps(opp.get("tags") or [], ensure_ascii=False),
                    ),
                )
                counts["opportunities"] += 1
                for idx, evidence in enumerate((opp.get("signal") or {}).get("evidence") or []):
                    connection.execute(
                        "INSERT INTO evidence VALUES (?,?,?,?,?,?,?,?)",
                        (
                            opp["id"],
                            idx,
                            evidence.get("title"),
                            evidence.get("publisher"),
                            evidence.get("url"),
                            evidence.get("date"),
                            evidence.get("tier"),
                            evidence.get("lang"),
                        ),
                    )
                    counts["evidence"] += 1

            for snapshot_day, snapshot_path in history.list_snapshots(history_dir):
                snapshot = common.load_json(snapshot_path)
                for window, data in (snapshot.get("windows") or {}).items():
                    for item in data.get("items") or []:
                        connection.execute(
                            "INSERT OR REPLACE INTO rankings_history VALUES (?,?,?,?,?,?,?,?,?)",
                            (
                                snapshot_day.isoformat(),
                                window,
                                int(item["rank"]),
                                item["opp_id"],
                                float(item.get("rank_score", 0)),
                                float(item.get("total", 0)),
                                item.get("delta"),
                                item.get("change"),
                                data.get("delta_basis"),
                            ),
                        )
                        counts["rankings_history"] += 1

            if source_health_path.exists():
                health = common.load_json(source_health_path)
                for source in sorted(health.get("sources") or [], key=lambda item: item.get("id", "")):
                    connection.execute(
                        "INSERT OR REPLACE INTO source_health VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                        (
                            source.get("id"),
                            source.get("name"),
                            source.get("url"),
                            source.get("access"),
                            source.get("compliance"),
                            1 if source.get("ok") else 0,
                            source.get("status"),
                            int(source.get("latency_ms") or 0),
                            int(source.get("items") or 0),
                            source.get("checked_at"),
                            source.get("error"),
                        ),
                    )
                    counts["source_health"] += 1
    finally:
        connection.close()

    temp_path.replace(db_path)
    return {
        "db_path": str(db_path),
        "size_bytes": db_path.stat().st_size,
        "counts": counts,
    }


def info(db_path: Path | None = None) -> dict[str, Any]:
    db_path = db_path or config.DB_PATH
    if not db_path.exists():
        return {"db_path": str(db_path), "exists": False}
    connection = sqlite3.connect(str(db_path))
    try:
        rows = {}
        for table in ("meta", "opportunities", "evidence", "rankings_history", "source_health"):
            rows[table] = connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    finally:
        connection.close()
    return {"db_path": str(db_path), "exists": True, "size_bytes": db_path.stat().st_size, "rows": rows}


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--rebuild" in argv or not argv:
        result = rebuild()
        print(
            f"[db] 已重建 {result['db_path']}（{result['size_bytes']} bytes）："
            + " / ".join(f"{key}={value}" for key, value in result["counts"].items())
        )
        return 0
    if "--info" in argv:
        print(json.dumps(info(), ensure_ascii=False, indent=2))
        return 0
    print(__doc__)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
