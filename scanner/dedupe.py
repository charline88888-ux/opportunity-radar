"""去重模块：URL 规范化精确去重 + 标题归一化 + 同域标题近似去重。

合并策略（保守，宁可漏合不可错合）：
1. canonical_url 完全相同 → 同一信号；
2. title_norm 完全相同（长度 > 10）→ 同一信号（跨源转载）；
3. 同域名 + 标题 token Jaccard ≥ 0.9 → 同一信号（同站点改标题重发）。
"""
from __future__ import annotations

from typing import Any

from .common import jaccard

TITLE_MIN_LEN = 10
JACCARD_THRESHOLD = 0.9


class _UnionFind:
    def __init__(self, size: int):
        self.parent = list(range(size))

    def find(self, node: int) -> int:
        while self.parent[node] != node:
            self.parent[node] = self.parent[self.parent[node]]
            node = self.parent[node]
        return node

    def union(self, left: int, right: int) -> None:
        root_left, root_right = self.find(left), self.find(right)
        if root_left != root_right:
            self.parent[root_right] = root_left


def _match_reason(left: dict[str, Any], right: dict[str, Any]) -> str | None:
    if left["canonical_url"] and left["canonical_url"] == right["canonical_url"]:
        return "url"
    title = left["title_norm"]
    if len(title) > TITLE_MIN_LEN and title == right["title_norm"]:
        return "title"
    if (
        left["url_domain"]
        and left["url_domain"] == right["url_domain"]
        and len(title) > TITLE_MIN_LEN
        and jaccard(set(left["tokens"]), set(right["tokens"])) >= JACCARD_THRESHOLD
    ):
        return "title_fuzzy"
    return None


def _merge_group(group: list[dict[str, Any]]) -> dict[str, Any]:
    """组内选信息量最大的一条为主记录，其余作为证据引用合并。"""
    primary = max(
        group,
        key=lambda signal: (
            bool(signal["pain_phrases"]),
            bool(signal["trend"]),
            len(signal["quote"]),
            -len(signal["signal_id"]),
        ),
    )
    merged = dict(primary)
    merged["region_hints"] = sorted({hint for signal in group for hint in signal["region_hints"]})
    merged["industry_hints"] = sorted({hint for signal in group for hint in signal["industry_hints"]})
    merged["gap_hints"] = sorted({hint for signal in group for hint in signal["gap_hints"]})
    merged["emotion_hints"] = sorted({hint for signal in group for hint in signal["emotion_hints"]})
    merged["pain_phrases"] = sorted({phrase for signal in group for phrase in signal["pain_phrases"]})
    merged["merged_from"] = sorted({signal["source_id"] for signal in group})
    merged["evidence_refs"] = sorted({signal["signal_id"] for signal in group})
    merged["duplicate_count"] = len(group) - 1
    if "tokens" in merged:
        merged.pop("tokens")
    return merged


def dedupe(signals: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    size = len(signals)
    union_find = _UnionFind(size)
    reasons: dict[tuple[int, int], str] = {}

    for i in range(size):
        for j in range(i + 1, size):
            reason = _match_reason(signals[i], signals[j])
            if reason:
                union_find.union(i, j)
                reasons[(i, j)] = reason

    groups: dict[int, list[dict[str, Any]]] = {}
    for idx, signal in enumerate(signals):
        groups.setdefault(union_find.find(idx), []).append(signal)

    merged_by_group = {root: _merge_group(group) for root, group in groups.items()}
    deduped = list(merged_by_group.values())
    deduped.sort(key=lambda signal: (signal["published_date"], signal["signal_id"]), reverse=True)

    merges = []
    for root, group in groups.items():
        if len(group) > 1:
            ids = [signal["signal_id"] for signal in group]
            merge_reasons = sorted(
                {
                    reason
                    for (i, j), reason in reasons.items()
                    if signals[i]["signal_id"] in ids and signals[j]["signal_id"] in ids
                }
            )
            merges.append(
                {
                    "kept": merged_by_group[root]["signal_id"],
                    "merged": sorted(ids),
                    "reasons": merge_reasons,
                }
            )

    report = {
        "input": size,
        "output": len(deduped),
        "removed": size - len(deduped),
        "duplicate_rate": round((size - len(deduped)) / size, 3) if size else 0.0,
        "merge_groups": merges,
        "by_adapter": _count_by(deduped, "adapter"),
        "by_source": _count_by(deduped, "source_id"),
    }
    return deduped, report


def _count_by(signals: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for signal in signals:
        value = signal.get(key, "")
        counts[value] = counts.get(value, 0) + 1
    return counts
