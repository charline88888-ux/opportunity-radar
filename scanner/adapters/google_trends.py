"""Google Trends 适配器：搜索热度时序（趋势时差与需求增速）。

真实接入方式：pytrends 已不稳定，个人版建议手动导出 CSV 或使用
Trends 网页（manual，遵守 ToS），把 CSV 转成 fixture 同构 JSON。
fixture 结构：{"queries": [{"term", "geo", "url", "interest_over_time": [{"date", "value"}]}]}
"""
from __future__ import annotations

from typing import Any

from .base import Adapter


def trend_direction(values: list[float], window: int = 4) -> str:
    if len(values) < window * 2:
        return "flat"
    recent = sum(values[-window:]) / window
    previous = sum(values[-window * 2 : -window]) / window
    if previous <= 0:
        return "up" if recent > 0 else "flat"
    delta = (recent - previous) / previous
    if delta >= 0.08:
        return "up"
    if delta <= -0.08:
        return "down"
    return "flat"


class GoogleTrendsAdapter(Adapter):
    name = "google_trends"
    source_id = "google-trends"
    category = "trend"
    access = "manual"

    def parse(self, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for payload in payloads:
            for query in payload.get("queries", []):
                term = query.get("term", "")
                geo = query.get("geo", "world")
                points = query.get("interest_over_time", [])
                values = [float(point.get("value", 0)) for point in points]
                if not points:
                    continue
                latest = points[-1]
                records.append(
                    self.raw_record(
                        raw_id=f"trends:{term}:{geo}",
                        title=f"Google Trends 热度：{term}（{geo}）",
                        url=query.get("url", "https://trends.google.com/trends/explore"),
                        published=latest.get("date"),
                        text=f"{term} 在 {geo} 的搜索热度：最近值 {latest.get('value')}，"
                        f"趋势 {trend_direction(values)}。",
                        lang="en",
                        engagement={"latest_value": latest.get("value"), "points": len(points)},
                        payload={
                            "term": term,
                            "geo": geo,
                            "interest_over_time": points,
                            "trend_direction": trend_direction(values),
                        },
                    )
                )
        return records
