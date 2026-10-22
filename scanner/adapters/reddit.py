"""Reddit 适配器：子版块帖子（抱怨 / 愿望 / 比较的高密度原声）。

真实接入方式：优先使用 Reddit 官方 API（OAuth，需遵守速率与 ToS）；
个人版可退化为 subreddit RSS（https://www.reddit.com/r/<sub>/.rss）。
fixture 结构：{"subreddits": [{"name", "url", "posts": [{...}]}]}
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .base import Adapter


def _date_from_epoch(value: Any) -> str | None:
    try:
        return datetime.fromtimestamp(float(value), tz=timezone.utc).date().isoformat()
    except (TypeError, ValueError, OSError):
        return None


class RedditAdapter(Adapter):
    name = "reddit"
    source_id = "reddit"
    category = "demand"
    access = "api"

    def parse(self, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for payload in payloads:
            for subreddit in payload.get("subreddits", []):
                name = subreddit.get("name", "")
                for post in subreddit.get("posts", []):
                    records.append(
                        self.raw_record(
                            raw_id=f"reddit:{name}:{post.get('id', '')}",
                            title=post.get("title", ""),
                            url=post.get("url") or subreddit.get("url", ""),
                            published=_date_from_epoch(post.get("created_utc"))
                            or post.get("date"),
                            text=post.get("selftext", ""),
                            lang=post.get("lang", "en"),
                            engagement={
                                "score": post.get("score", 0),
                                "num_comments": post.get("num_comments", 0),
                            },
                            payload={
                                "subreddit": name,
                                "subreddit_url": subreddit.get("url", ""),
                                "flair": post.get("flair", ""),
                            },
                        )
                    )
        return records
