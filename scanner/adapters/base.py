"""采集适配器统一基类。

设计目标：
1. 每个适配器只负责「把某个数据源的一份原始响应解析成统一的 raw 记录」；
2. 切换真实数据源时，只需替换 fetch() 里的取数实现（HTTP/RSS/API），
   parse 逻辑与下游 normalize/dedupe/score 完全不用改；
3. 离线 fixture 与真实响应使用同一套解析路径，保证流水线可离线回归。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class Adapter(ABC):
    """所有适配器的父类。"""

    name: str = "base"
    source_id: str = "unknown"
    category: str = "generic"  # 对应 sources.json 的 12 大类
    access: str = "html"  # api / rss / html / manual / paid-api

    def __init__(self, fixture: dict[str, Any], as_of: str):
        self.fixture = fixture or {}
        self.as_of = as_of

    # ------------------------------------------------------------ 取数
    def fetch(self) -> list[dict[str, Any]]:
        """返回原始响应（离线模式下直接返回 fixture 里的该源 section）。"""
        return [self.fixture]

    @abstractmethod
    def parse(self, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """把原始响应解析为统一 raw 记录列表。"""

    # ------------------------------------------------------------ 工具
    def collected_at(self) -> str:
        return f"{self.as_of}T09:00:00+08:00"

    def raw_record(
        self,
        *,
        raw_id: str,
        title: str,
        url: str,
        published: str | None,
        text: str,
        lang: str = "en",
        engagement: dict[str, Any] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "adapter": self.name,
            "source_id": self.source_id,
            "source_category": self.category,
            "access": self.access,
            "collected_at": self.collected_at(),
            "raw_id": raw_id,
            "title": (title or "").strip(),
            "url": (url or "").strip(),
            "published": published,
            "lang": lang,
            "text": (text or "").strip(),
            "engagement": engagement or {},
            "payload": payload or {},
        }

    def run(self) -> list[dict[str, Any]]:
        payloads = self.fetch()
        records = self.parse(payloads)
        return [record for record in records if record.get("title") and record.get("url")]
