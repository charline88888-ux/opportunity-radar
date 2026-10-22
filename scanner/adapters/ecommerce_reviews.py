"""电商评论适配器：Amazon / Etsy / Shopee 等 1–3 星评论与 Q&A。

真实接入方式：官方 Product Advertising API、平台开放平台、或人工复制评论；
不得绕过登录/付费墙批量抓取（compliance:red 的源只允许人工浏览）。
输出：每条低星评论 = 一条 raw 记录（需求缺口 / 抱怨信号）。
fixture 结构：{"products": [{"asin", "title", "url", "rating", "reviews": [{...}]}]}
"""
from __future__ import annotations

from typing import Any

from .base import Adapter

LOW_STAR_THRESHOLD = 3  # 只采 1–3 星：抱怨里才有信息差


class EcommerceReviewAdapter(Adapter):
    name = "ecommerce_reviews"
    source_id = "marketplace-reviews"
    category = "marketplace"
    access = "html"

    def parse(self, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for payload in payloads:
            for product in payload.get("products", []):
                product_title = product.get("title", "")
                for review in product.get("reviews", []):
                    rating = float(review.get("rating", 0) or 0)
                    if rating > LOW_STAR_THRESHOLD:
                        continue
                    body = review.get("body", "")
                    records.append(
                        self.raw_record(
                            raw_id=f"review:{product.get('asin', '')}:{review.get('id', '')}",
                            title=f"[{rating}星] {review.get('title') or product_title}",
                            url=product.get("url", ""),
                            published=review.get("date"),
                            text=body,
                            lang=review.get("lang", "en"),
                            engagement={
                                "rating": rating,
                                "verified_purchase": bool(review.get("verified_purchase")),
                                "helpful_votes": review.get("helpful_votes", 0),
                            },
                            payload={
                                "asin": product.get("asin", ""),
                                "product_title": product_title,
                                "product_rating": product.get("rating"),
                                "review_id": review.get("id", ""),
                            },
                        )
                    )
        return records
