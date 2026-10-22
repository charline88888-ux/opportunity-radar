"""通用工具：JSON 读写、日期/窗口、数值与文本处理。仅标准库。"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any, Iterable

from . import config

_PUNCT_RE = re.compile(r"[\s\u3000,.;:!?，。；：！？、“”‘’\"'()（）\[\]【】\-_/\\|·…—-]+")


# ---------------------------------------------------------------- IO
def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def dump_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    path.write_text(text + "\n", encoding="utf-8")


def short_hash(*parts: str, length: int = 12) -> str:
    raw = "\u0001".join(parts).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:length]


# ---------------------------------------------------------------- 日期 / 窗口
def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def display_path(path: str | Path, root: Path | None = None) -> str:
    """把路径显示为相对仓库根目录的短路径；相对/越界路径原样返回（不会抛错）。

    v0.5.1 PATCH：修复 `--out-dir` 为相对路径时 `Path(p).relative_to(config.ROOT)` 抛 ValueError。
    """
    target = Path(path)
    base = Path(root or config.ROOT)
    try:
        return str(target.resolve().relative_to(base.resolve()))
    except (ValueError, OSError):
        return str(target)


def iso_week_key(day: date) -> str:
    iso = day.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def month_key(day: date) -> str:
    return f"{day.year}-{day.month:02d}"


def year_key(day: date) -> str:
    return str(day.year)


def window_key(window: str, day: date) -> str:
    if window == "day":
        return day.isoformat()
    if window == "week":
        return iso_week_key(day)
    if window == "month":
        return month_key(day)
    if window == "year":
        return year_key(day)
    raise ValueError(f"未知窗口: {window}")


def window_label(window: str, day: date) -> str:
    iso = day.isocalendar()
    if window == "day":
        return f"{day.year}年{day.month}月{day.day}日"
    if window == "week":
        return f"{iso.year}年第{iso.week}周"
    if window == "month":
        return f"{day.year}年{day.month}月"
    if window == "year":
        return f"{day.year}年"
    raise ValueError(f"未知窗口: {window}")


def recent_dates(as_of: date, days: int) -> list[str]:
    return [(as_of - timedelta(days=offset)).isoformat() for offset in range(days - 1, -1, -1)]


def parse_as_of(taxonomy: dict | None = None) -> date:
    if taxonomy:
        raw = taxonomy.get("meta", {}).get("as_of")
        if raw:
            return parse_date(raw)
    return parse_date(config.DEFAULT_AS_OF)


# ---------------------------------------------------------------- 数值
def round1(value: float) -> float:
    """四舍五入（ROUND_HALF_UP，非银行家舍入），保留 1 位小数。契约 4.5 锁定。"""
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


# ---------------------------------------------------------------- 文本
def norm_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").lower()
    return _PUNCT_RE.sub(" ", value).strip()


def token_set(value: str) -> set[str]:
    tokens: set[str] = set()
    norm = norm_text(value)
    for chunk in norm.split():
        if chunk:
            tokens.add(chunk)
    # 中文按 2-gram 切分，弥补无空格分词
    cjk = "".join(ch for ch in norm if "\u4e00" <= ch <= "\u9fff")
    for i in range(len(cjk) - 1):
        tokens.add(cjk[i : i + 2])
    return tokens


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def iter_strings(value: Any, path: str = "") -> Iterable[tuple[str, str]]:
    """递归产出 (路径, 字符串) —— 用于禁用词扫描与长度检查。"""
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, dict):
        for key, sub in value.items():
            yield from iter_strings(sub, f"{path}.{key}" if path else str(key))
    elif isinstance(value, list):
        for idx, sub in enumerate(value):
            yield from iter_strings(sub, f"{path}[{idx}]")


def trim(value: str, limit: int) -> str:
    value = (value or "").strip()
    return value if len(value) <= limit else value[: limit - 1] + "…"
