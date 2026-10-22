"""适配器注册表：新增数据源只需在此登记一个 Adapter 子类。"""
from __future__ import annotations

from typing import Any

from .base import Adapter
from .ecommerce_reviews import EcommerceReviewAdapter
from .google_trends import GoogleTrendsAdapter
from .reddit import RedditAdapter
from .rss import RSSAdapter

ADAPTERS: dict[str, type[Adapter]] = {
    "rss": RSSAdapter,
    "reddit": RedditAdapter,
    "google_trends": GoogleTrendsAdapter,
    "ecommerce_reviews": EcommerceReviewAdapter,
}

# fixture 中每个适配器使用的 section key
FIXTURE_SECTIONS = {
    "rss": "rss",
    "reddit": "reddit",
    "google_trends": "google_trends",
    "ecommerce_reviews": "ecommerce_reviews",
}


def load_all(fixtures: dict[str, Any], as_of: str) -> tuple[list[dict[str, Any]], dict[str, tuple[str, str]]]:
    """运行全部适配器，返回 (raw 记录, {adapter: (status, message)})。"""
    records: list[dict[str, Any]] = []
    health: dict[str, tuple[str, str]] = {}
    for name, adapter_cls in ADAPTERS.items():
        section = fixtures.get(FIXTURE_SECTIONS[name], {})
        try:
            adapter = adapter_cls(section, as_of)
            items = adapter.run()
        except Exception as exc:  # noqa: BLE001 - 单个源失败不能拖垮整条流水线
            health[name] = ("error", f"{type(exc).__name__}: {exc}")
            continue
        records.extend(items)
        health[name] = ("ok", f"{len(items)} 条原始信号")
    return records, health


__all__ = ["ADAPTERS", "Adapter", "load_all"]
