"""RSS / Atom 适配器：新闻源、Google News RSS、行业媒体 RSS。

真实接入方式：用 urllib.request 拉取 RSS XML → xml.etree.ElementTree 解析，
再把 (title, link, pubDate, description) 映射到 raw_record，与 offline fixture 同构。
"""
from __future__ import annotations

from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any

from .base import Adapter


def parse_date(value: str | None) -> str | None:
    """兼容 RFC822（RSS）与 ISO8601 两种日期格式，统一输出 YYYY-MM-DD。"""
    if not value:
        return None
    value = value.strip()
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date().isoformat()
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError):
        return None


class RSSAdapter(Adapter):
    name = "rss"
    source_id = "google-news-rss"
    category = "demand"
    access = "rss"

    def parse(self, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for payload in payloads:
            for feed in payload.get("feeds", []):
                feed_url = feed.get("url", "")
                for idx, item in enumerate(feed.get("items", [])):
                    records.append(
                        self.raw_record(
                            raw_id=f"{feed_url}#{idx}",
                            title=item.get("title", ""),
                            url=item.get("link", ""),
                            published=parse_date(item.get("pubDate")),
                            text=item.get("description", ""),
                            lang=item.get("language", "en"),
                            engagement={"feed_items": len(feed.get("items", []))},
                            payload={
                                "feed_url": feed_url,
                                "channel": feed.get("channel", ""),
                                "categories": item.get("categories", []),
                            },
                        )
                    )
        return records
