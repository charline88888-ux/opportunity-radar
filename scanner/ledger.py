"""持久信号账本（v0.8.0）：SQLite 跨批次去重，防止每天/每次 fetch 重复刷同一批信号。

文件：`scanner/build/signal-ledger.sqlite`（`scanner/build/` 已 gitignore，不入库、不入发布）。

表 `signals`：`fingerprint`（唯一）、`canonical_url`、`title_hash`、`content_hash`、
`first_seen`、`last_seen`、`seen_count`、`source_id`。

用法：
    ledger = SignalLedger()
    stats = ledger.classify(signals, as_of="2026-10-23")   # 原地写 is_new/first_seen/last_seen/seen_count
    # stats = {new_count, seen_count, ledger_total}
    ledger.close()
"""
from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # pragma: no cover
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import config  # noqa: E402
else:
    from . import config


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def text_hash(value: str | None) -> str:
    return _sha256((value or "").strip().lower())


def content_hash(signal: dict[str, Any]) -> str:
    """内容哈希：标题 + 引文/摘要（去空白），用于同一内容不同 URL 的兜底去重。"""
    title = str(signal.get("title_norm") or signal.get("title") or "").strip().lower()
    quote = str(signal.get("quote") or "")[:400].strip().lower()
    return _sha256(f"{title}|{quote}")


class SignalLedger:
    def __init__(self, path: Path | None = None) -> None:
        self.path = Path(path) if path is not None else config.LEDGER_PATH
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(str(self.path))
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fingerprint TEXT NOT NULL UNIQUE,
                canonical_url TEXT,
                title_hash TEXT,
                content_hash TEXT,
                first_seen TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                seen_count INTEGER NOT NULL DEFAULT 1,
                source_id TEXT
            )
            """
        )
        self._connection.execute("CREATE INDEX IF NOT EXISTS idx_signals_canonical ON signals(canonical_url)")
        self._connection.execute("CREATE INDEX IF NOT EXISTS idx_signals_title ON signals(title_hash)")
        self._connection.execute("CREATE INDEX IF NOT EXISTS idx_signals_last_seen ON signals(last_seen)")
        self._connection.commit()

    def classify(self, signals: list[dict[str, Any]], as_of: str) -> dict[str, int]:
        """标注每条信号 is_new/first_seen/last_seen/seen_count；返回新/旧/账本总数。"""
        new_count = 0
        seen_count = 0
        for signal in signals:
            fingerprint = str(signal.get("fingerprint") or "") or _sha256(
                f"{signal.get('canonical_url') or signal.get('url') or ''}|{text_hash(signal.get('title_norm') or signal.get('title'))}"
            )
            canonical = str(signal.get("canonical_url") or signal.get("url") or "")
            title_digest = text_hash(signal.get("title_norm") or signal.get("title"))
            content_digest = content_hash(signal)
            row = self._connection.execute(
                """
                SELECT id FROM signals
                WHERE fingerprint = ?
                   OR (canonical_url <> '' AND canonical_url = ?)
                   OR (title_hash = ? AND content_hash = ?)
                """,
                (fingerprint, canonical, title_digest, content_digest),
            ).fetchone()
            if row is not None:
                self._connection.execute(
                    "UPDATE signals SET last_seen = ?, seen_count = seen_count + 1 WHERE id = ?",
                    (as_of, row[0]),
                )
                signal["is_new"] = False
                signal["first_seen"] = as_of
                signal["last_seen"] = as_of
                seen_count += 1
            else:
                self._connection.execute(
                    """
                    INSERT INTO signals
                        (fingerprint, canonical_url, title_hash, content_hash,
                         first_seen, last_seen, seen_count, source_id)
                    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                    """,
                    (fingerprint, canonical, title_digest, content_digest, as_of, as_of, signal.get("source_id")),
                )
                signal["is_new"] = True
                signal["first_seen"] = as_of
                signal["last_seen"] = as_of
                new_count += 1
            signal["fingerprint"] = fingerprint
            signal["seen_count"] = 1 if signal["is_new"] else signal.get("seen_count", 1) + 1
        self._connection.commit()
        total = int(self._connection.execute("SELECT COUNT(*) FROM signals").fetchone()[0])
        return {"new_count": new_count, "seen_count": seen_count, "ledger_total": total}

    def close(self) -> None:
        try:
            self._connection.close()
        except sqlite3.Error:
            pass

    def __enter__(self) -> "SignalLedger":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()
