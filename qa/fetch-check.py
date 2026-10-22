"""qa/fetch-check.py —— v0.3.1 采集修复红队独立实测（不依赖 scanner/fetch.py 的运行结果）。

对 source-health 中记录的全部在线源，用标准库 urllib 独立发起一次真实 GET（短超时/UA），
验证：HTTP 可达、内容可解析（RSS/Atom/JSON 条目数）、失败源 error 非空、修复源 URL 已更换且可用。
用法：python qa/fetch-check.py [--timeout 15]
"""
from __future__ import annotations

import argparse
import json
import re
import ssl
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
UA = "OpportunityRadar-QA/0.3.1 (+local research; contact: lead@local)"
BROKEN_V030 = {
    "reddit": "https://www.reddit.com/r/Entrepreneur/.rss",
    "itunes-reviews": "https://itunes.apple.com/us/rss/customerreviews/page=1/id=389801252/sortby=mostrecent/json",
    "shopify-changelog": "https://shopify.dev/changelog",
}
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []


def fetch(url: str, timeout: float):
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        body = resp.read(1_500_000)
        return resp.status, resp.headers.get("Content-Type", ""), body


def parse_count(content_type: str, body: bytes, url: str) -> int:
    low = (content_type or "").lower()
    text = body.decode("utf-8", errors="ignore")
    stripped = text.lstrip()
    if "json" in low or "javascript" in low or url.lower().rstrip("/").endswith("json") or stripped[:1] in ("{", "["):
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return 0
        if isinstance(data, dict):
            feed = data.get("feed")
            if isinstance(feed, dict) and isinstance(feed.get("entry"), list):
                return len(feed["entry"])
            for key in ("entries", "items", "data", "stories", "results"):
                if isinstance(data.get(key), list):
                    return len(data[key])
        if isinstance(data, list):
            return len(data)
        return 0
    items = len(re.findall(r"<item[\s>]", text, flags=re.I))
    entries = len(re.findall(r"<entry[\s>]", text, flags=re.I))
    return items or entries


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeout", type=float, default=15.0)
    args = ap.parse_args()
    sources = json.loads((DATA / "sources.json").read_text(encoding="utf-8"))
    health = json.loads((DATA / "source-health.json").read_text(encoding="utf-8"))
    all_sources = {}
    for cat in sources.get("categories", []):
        for s in cat.get("sources", []):
            all_sources[s.get("id")] = s
    rows = health.get("sources", [])
    print(f"== 独立采集实测：{len(rows)} 个在线源（timeout={args.timeout}s）==")
    ok = 0
    failed = 0
    for row in rows:
        sid = row.get("id")
        url = row.get("url") or all_sources.get(sid, {}).get("url", "")
        repaired = "（v0.3.0 URL）" if BROKEN_V030.get(sid) == url else ""
        try:
            status, ctype, body = fetch(url, args.timeout)
            n = parse_count(ctype, body, url)
            if row.get("ok") is True and status == 200 and n == 0 and not row.get("cached"):
                P1.append(f"{sid}: source-health 标记成功，但独立抓取解析 0 条（{url}）")
            if row.get("ok") is True:
                ok += 1
            print(f"  {sid:<18} health_ok={str(row.get('ok')):<5} status={status} bytes={len(body):<8} parsed={n:<4}{repaired} {url[:70]}")
            if row.get("ok") is False:
                failed += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  {sid:<18} health_ok={str(row.get('ok')):<5} FETCH-FAIL {exc.__class__.__name__}: {exc} {url[:70]}")
            if row.get("ok") is True:
                P2.append(f"{sid}: source-health 成功但红队独立抓取失败（可能网络波动）：{exc}")
        if row.get("ok") is False and not str(row.get("error") or "").strip():
            P0.append(f"{sid}: ok=false 但 error 为空（V20）")
    print(f"\n独立抓取统计：health_ok={ok}/{len(rows)}  health_failed={failed}")
    if ok < 7:
        P1.append(f"source-health 在线成功 {ok}/{len(rows)} < 7（v0.3.1 目标 ≥7/8）")
    for sid, old in BROKEN_V030.items():
        row = next((r for r in rows if r.get("id") == sid), None)
        if row is None:
            P2.append(f"{sid}: source-health 中已不存在（可能换源/换 id，需 data/CHANGELOG 说明）")
            continue
        new = row.get("url") or all_sources.get(sid, {}).get("url", "")
        if new == old:
            P2.append(f"{sid}: URL 仍是 v0.3.0 的旧地址（未修复或已确认可用）")
        print(f"修复源 {sid}: {old[:60]} -> {new[:80]}")
    # 失败源 error 必须非空
    for row in rows:
        if row.get("ok") is False and not str(row.get("error") or "").strip():
            P0.append(f"{row.get('id')}: ok=false 但 error 为空")
    print("\nP0 =", len(P0), " P1 =", len(P1), " P2 =", len(P2))
    for item in P0:
        print("  [P0]", item)
    for item in P1:
        print("  [P1]", item)
    for item in P2:
        print("  [P2]", item)
    print("RESULT:", "PASS" if not P0 and not P1 else "FAIL")
    return 0 if not P0 and not P1 else 1


if __name__ == "__main__":
    raise SystemExit(main())
