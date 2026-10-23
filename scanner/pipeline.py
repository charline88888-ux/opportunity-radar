"""扫描流水线命令行入口（Python 3.11，纯标准库）— data-v0.9.0。

用法：
    python scanner/pipeline.py --all            # 离线：采集→归一→去重→评分→候选→排榜(+历史快照)→统计→SQLite→校验
    python scanner/pipeline.py --all --as-of 2026-10-23   # 真实每日运行：所有日期派生按该日（窗口/快照/meta）
    python scanner/pipeline.py --db-rebuild     # 仅从 data/*.json 重建 data/radar.db
    python scanner/pipeline.py --fetch          # 真实在线采集（唯一联网命令；写 outbox + source-health）
    python scanner/pipeline.py --candidates     # 从 outbox 自动生成候选 + 四窗口发现榜（v0.9.0）
    python scanner/pipeline.py --report         # 生成四窗口 HTML/MD 报告
    python scanner/pipeline.py --report --period day --period year
    python scanner/pipeline.py --collect        # 仅运行离线 fixtures 适配器
    python scanner/pipeline.py --rank           # 仅重算榜单 + 写历史快照
    python scanner/pipeline.py --validate       # 仅运行 V01–V20 校验
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 支持 python scanner/pipeline.py 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import common, config, db, history, materialize, normalize, rank, report, score, stats, validate  # noqa: E402
    from scanner import candidates  # noqa: E402
    from scanner import translate as translate_mod  # noqa: E402
    from scanner import dedupe as dedupe_mod  # noqa: E402
    from scanner import fetch as fetch_mod  # noqa: E402
    from scanner.adapters import load_all  # noqa: E402
else:  # pragma: no cover
    from . import common, config, db, history, materialize, normalize, rank, report, score, stats, validate
    from . import candidates
    from . import translate as translate_mod
    from . import dedupe as dedupe_mod
    from . import fetch as fetch_mod
    from .adapters import load_all

FIXTURE_PATH = config.FIXTURES_DIR / "raw_signals.json"


def log(message: str) -> None:
    print(f"[pipeline] {message}")


def _ensure_build_dir() -> None:
    config.BUILD_DIR.mkdir(parents=True, exist_ok=True)
    ignore = config.BUILD_DIR / ".gitignore"
    if not ignore.exists():
        ignore.write_text("# 扫描器中间产物不入库\n*\n", encoding="utf-8")


def _load_taxonomy() -> dict[str, Any]:
    return common.load_json(config.TAXONOMY_PATH)


def _load_opportunities() -> list[dict[str, Any]]:
    data = common.load_json(config.OPPORTUNITIES_PATH)
    if not isinstance(data, list):
        raise SystemExit("data/opportunities.json 必须是机会对象数组")
    return data


def _as_of(taxonomy: dict[str, Any]) -> date:
    return common.parse_as_of(taxonomy)


def resolve_as_of(value: str | None) -> date:
    """v0.6.1：解析 `--as-of`；默认 config.DEFAULT_AS_OF（基准发布日）。

    非法日期抛 ValueError（由 main 统一转成 exit 2）。
    """
    if not value:
        return common.parse_date(config.DEFAULT_AS_OF)
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"--as-of 非法日期（需 YYYY-MM-DD）：{value}") from exc


# ---------------------------------------------------------------- 各阶段
def stage_collect(as_of: date) -> tuple[list[dict[str, Any]], dict[str, tuple[str, str]]]:
    _ensure_build_dir()
    fixtures = common.load_json(FIXTURE_PATH)
    records, health = load_all(fixtures, as_of.isoformat())
    payload = {
        "meta": {
            "as_of": as_of.isoformat(),
            "fixture": str(FIXTURE_PATH.relative_to(config.ROOT)),
            "adapter_health": {name: {"status": status, "detail": detail} for name, (status, detail) in health.items()},
            "count": len(records),
        },
        "records": records,
    }
    common.dump_json(config.BUILD_DIR / "raw_signals_collected.json", payload)
    ok_sources = sum(1 for status, _ in health.values() if status == "ok")
    log(f"采集完成：{len(records)} 条原始信号，{ok_sources}/{len(health)} 个适配器正常")
    for name, (status, detail) in health.items():
        log(f"  · {name:<18} {status:<5} {detail}")
    return records, health


def stage_normalize(records: list[dict[str, Any]], as_of: date) -> list[dict[str, Any]]:
    signals, summary = normalize.normalize_all(records, as_of.isoformat())
    common.dump_json(
        config.BUILD_DIR / "normalized_signals.json",
        {"meta": {"as_of": as_of.isoformat(), **summary}, "signals": signals},
    )
    log(
        f"归一完成：{summary['input']} → {summary['output']} 条信号"
        f"（有痛点短语 {summary['with_pain_phrases']} 条，有趋势序列 {summary['with_trend']} 条）"
    )
    return signals


def stage_dedupe(signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped, report_data = dedupe_mod.dedupe(signals)
    common.dump_json(config.BUILD_DIR / "dedupe_report.json", report_data)
    common.dump_json(
        config.BUILD_DIR / "signals_deduped.json",
        {"meta": {"count": len(deduped)}, "signals": deduped},
    )
    log(
        f"去重完成：{report_data['input']} → {report_data['output']} 条"
        f"（合并 {report_data['removed']} 条，重复率 {report_data['duplicate_rate']:.1%}）"
    )
    return deduped


def stage_score(
    opportunities: list[dict[str, Any]], taxonomy: dict[str, Any], as_of: date, fix: bool
) -> list[dict[str, Any]]:
    materialized, issues = materialize.materialize_all(opportunities, taxonomy, as_of)
    if issues:
        for issue in issues:
            log(f"  ! 物化失败 {issue}")
        raise SystemExit(1)
    mismatched: list[str] = []
    for original, fixed in zip(opportunities, materialized):
        if (
            original.get("scores") != fixed.get("scores")
            or original.get("rank_score") != fixed.get("rank_score")
            or original.get("evidence_count") != fixed.get("evidence_count")
            or original.get("last_activity") != fixed.get("last_activity")
            or original.get("momentum") != fixed.get("momentum")
        ):
            mismatched.append(original.get("id", "<no-id>"))
    if mismatched:
        log(f"评分检查：{len(mismatched)} 条机会的派生字段与公式不一致（如 {mismatched[:3]}）")
    else:
        log(f"评分检查：{len(opportunities)} 条机会总分/等级/rank_score 与公式一致")
    # 契约 5.2.1：不一致时以计算值为准；统一回写，保证 --all 幂等。
    if opportunities != materialized:
        common.dump_json(config.OPPORTUNITIES_PATH, materialized)
        log("已按契约公式回写 data/opportunities.json（派生字段以扫描器计算值为准）")
    return materialized


def stage_rank(opportunities: list[dict[str, Any]], as_of: date) -> dict[str, Any]:
    previous = history.find_previous_snapshot(as_of)
    previous_snapshot = previous[1] if previous else None
    rankings = rank.build_rankings(opportunities, as_of, previous_snapshot=previous_snapshot)
    common.dump_json(config.RANKINGS_PATH, rankings)
    snapshot_path = history.write_snapshot(rankings, as_of)
    counts = rankings["meta"]["counts"]
    basis = rankings["meta"]["delta_basis"]
    history_as_of = rankings["meta"].get("history_as_of")
    log(
        "榜单已生成："
        + " / ".join(f"{window}={counts[window]}" for window in ("day", "week", "month", "year"))
        + f" → data/rankings.json（delta_basis={basis}, history_as_of={history_as_of}）"
    )
    log(f"历史快照已写入：{snapshot_path.relative_to(config.ROOT)}")
    return rankings


def stage_stats(opportunities: list[dict[str, Any]], taxonomy: dict[str, Any], as_of: date) -> dict[str, Any]:
    candidate_payload = common.load_json(config.CANDIDATES_PATH) or {}
    candidate_rows = candidate_payload.get("candidates") if isinstance(candidate_payload, dict) else []
    payload = stats.build_stats(opportunities, taxonomy, as_of, candidates=candidate_rows or [])
    common.dump_json(config.STATS_PATH, payload)
    kpi = payload["kpi"]
    log(
        f"统计已生成：{kpi['total_opps']} 条机会 / A 级以上 {kpi['grade_a_plus']} 条 / "
        f"平均分 {kpi['avg_total']} / 开放窗口价值 {payload['open_window_value_cny']} 元 / "
        f"候选 {kpi.get('candidates_total', 0)} 条（今日新增 {kpi.get('today_new_candidates', 0)}）→ data/stats.json"
    )
    return payload


def stage_candidates(
    as_of: date,
    limit: int | None = None,
    translate_provider: str | None = None,
    translate_cache: bool = True,
) -> dict[str, Any]:
    """v0.9.0-0.9.3：从 outbox business 信号自动生成候选 + 四窗口发现榜（自动翻译、不写 opportunities.json）。"""
    result = candidates.generate(
        as_of=as_of,
        limit=limit,
        translate_provider=translate_provider,
        translate_cache=translate_cache,
    )
    counts = result["counts"]
    log(
        f"自动候选已生成：{result['total']} 条（business {result['business_signals']} / "
        f"maybe {result['maybe_signals']}，去重 {result['dropped_duplicates']}）→ data/candidates.json"
    )
    translation = result.get("translation_summary") or {}
    if translation:
        log(
            f"系统翻译：provider {translation.get('provider')} / cached {translation.get('cached')} / "
            f"quality high {translation.get('quality_high', 0)} medium {translation.get('quality_medium', 0)} "
            f"low {translation.get('quality_low', 0)} source-zh {translation.get('quality_source_zh', 0)} "
            f"（中文覆盖 {translation.get('coverage')}，词典 {translation.get('glossary_entries')} 条）"
        )
    gap_cov = result.get("gap_inference_coverage") or {}
    region_cov = result.get("region_coverage") or {}
    log(
        f"候选质量：gap 推断覆盖 {gap_cov.get('inferred', 0)}/{result['total']} "
        f"(missing {gap_cov.get('missing', 0)}, ratio {gap_cov.get('ratio', 0)})；"
        f"region 覆盖 {region_cov.get('covered', 0)}/{region_cov.get('total', 0)}"
    )
    log(
        "候选发现榜："
        + " / ".join(f"{window}={counts[window]}" for window in ("day", "week", "month", "year"))
        + " → data/candidate-rankings.json（verification_status 不参与收录/排序）"
    )
    return result


def stage_db() -> dict[str, Any]:
    result = db.rebuild()
    log(
        f"SQLite 已同步：{Path(result['db_path']).relative_to(config.ROOT)}（{result['size_bytes']} bytes）"
        + " / " + " ".join(f"{key}={value}" for key, value in result["counts"].items())
    )
    return result


def stage_fetch(as_of: date, limit: int, cache_enabled: bool) -> dict[str, Any]:
    fetch_mod.ensure_outbox_ignore()
    result = fetch_mod.run_fetch(as_of.isoformat(), limit=limit, cache_enabled=cache_enabled)
    for row in result["health"]:
        status = "OK" if row["ok"] else "FAIL"
        log(
            f"  · [{status}] {row['id']:<16} status={row['status']:<4} {row['latency_ms']:>5}ms "
            f"items={row['items']:<3} cached={row['cached']}"
            + (f" error={row['error']}" if row["error"] else "")
        )
    log(
        f"真实采集完成：{result['ok_count']}/{len(result['health'])} 个源成功，"
        f"{result['raw_count']} 条原始 → {result['signal_count']} 条信号"
    )
    log(
        f"跨批去重：新增 {result.get('new_count', 0)} 条 / 已见 {result.get('seen_count', 0)} 条 "
        f"（账本累计 {result.get('ledger_total', 0)} 条）"
    )
    tiers = result.get("tiers") or {}
    log(
        f"相关性初筛：business {tiers.get('business', 0)} / maybe {tiers.get('maybe', 0)} / "
        f"off-topic {tiers.get('off-topic', 0)}（relevant_count={result.get('relevant_count', 0)}）"
    )
    log(f"outbox（人工复核，不入机会库）：{Path(result['outbox_path']).relative_to(config.ROOT)}")
    log(f"源健康度：{Path(result['source_health_path']).relative_to(config.ROOT)}")
    return result


def stage_report(periods: list[str], as_of: date) -> list[dict[str, str]]:
    written = report.generate(periods, as_of=as_of.isoformat())
    for row in written:
        log(
            f"报告已生成：{row['period']:<5} {row['count']:>3} 条 → "
            f"{Path(row['html']).relative_to(config.ROOT)} / {Path(row['md']).relative_to(config.ROOT)}"
        )
    return written


def stage_replay(base_date: date, days: int) -> list[dict[str, Any]]:
    """生成确定性历史回放快照（v0.3.0）：base_date 之前的 N 天各一份。"""
    if days < 1:
        raise SystemExit("--replay-days 必须 ≥ 1")
    opportunities = _load_opportunities()
    results: list[dict[str, Any]] = []
    for offset in range(days, 0, -1):
        replay_date = base_date - timedelta(days=offset)
        path, rankings = history.build_replay_snapshot(opportunities, replay_date)
        counts = rankings["meta"]["counts"]
        results.append(
            {
                "date": replay_date.isoformat(),
                "path": str(path),
                "delta_basis": rankings["meta"]["delta_basis"],
                "counts": counts,
            }
        )
        log(
            f"回放快照：{replay_date.isoformat()}（reconstructed=true, "
            f"delta_basis={rankings['meta']['delta_basis']}, "
            + " / ".join(f"{window}={counts[window]}" for window in ("day", "week", "month", "year"))
            + f"）→ {path.relative_to(config.ROOT)}"
        )
    return results


def stage_validate() -> int:
    report_data = validate.run_validation()
    passed = sum(1 for row in report_data.rows if row["ok"])
    for row in report_data.failures:
        log(f"  ✗ {row['rule']} {row['name']}：{row['detail']}")
    for warning in report_data.warnings[:15]:
        log(f"  · 提示 {warning}")
    log(f"校验完成：{passed}/{len(report_data.rows)} 条规则通过")
    return 0 if not report_data.failures else 1


# ---------------------------------------------------------------- 入口
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="机会雷达扫描流水线（data-v0.3.0）")
    parser.add_argument("--all", action="store_true", help="离线完整流水线（含历史快照/SQLite/校验）")
    parser.add_argument("--collect", action="store_true", help="运行采集适配器（离线 fixtures）")
    parser.add_argument("--normalize", action="store_true", help="归一化原始信号")
    parser.add_argument("--dedupe", action="store_true", help="去重并合并跨源信号")
    parser.add_argument("--score", action="store_true", help="按公式重算评分并检查一致性")
    parser.add_argument("--rank", action="store_true", help="重算日/周/月/年榜单并写历史快照")
    parser.add_argument("--stats", action="store_true", help="重算聚合统计")
    parser.add_argument("--candidates", action="store_true", help="从 outbox 自动生成候选商机 + 四窗口发现榜（v0.9.0）")
    parser.add_argument("--candidates-limit", type=int, default=config.CANDIDATE_LIMIT, help=f"候选上限（默认 {config.CANDIDATE_LIMIT}，v0.9.1 可配置）")
    parser.add_argument("--translate-provider", choices=sorted(translate_mod.PROVIDERS), default=None, help="候选翻译引擎（v0.9.3，默认 auto）")
    parser.add_argument("--no-translate-cache", action="store_true", help="禁用翻译缓存（v0.9.3）")
    parser.add_argument("--db-rebuild", action="store_true", help="从 JSON 重建 data/radar.db")
    parser.add_argument("--fetch", action="store_true", help="真实在线采集（唯一联网命令，写出 outbox + source-health）")
    parser.add_argument("--fetch-limit", type=int, default=config.FETCH_DEFAULT_LIMIT, help="真实采集最多尝试的源数")
    parser.add_argument("--no-cache", action="store_true", help="真实采集时禁用 6 小时文件缓存")
    parser.add_argument("--report", action="store_true", help="生成四窗口 HTML/MD 报告")
    parser.add_argument("--period", action="append", choices=["day", "week", "month", "year"], help="报告窗口（可重复）")
    parser.add_argument(
        "--replay-as-of",
        type=str,
        default=None,
        help="历史回放基准日 YYYY-MM-DD（生成该日之前 N 天的重建快照，默认当前 as_of）",
    )
    parser.add_argument(
        "--replay-days",
        type=int,
        default=config.REPLAY_DEFAULT_DAYS,
        help="回放天数（默认 2：生成基准日前 2 天的快照，reconstructed=true）",
    )
    parser.add_argument("--validate", action="store_true", help="运行 V01–V20 数据校验")
    parser.add_argument("--fix", action="store_true", help="兼容别名：评分回写现在总是自动执行")
    parser.add_argument(
        "--as-of",
        type=str,
        default=None,
        help=f"数据基准日 YYYY-MM-DD（v0.6.1；默认 {config.DEFAULT_AS_OF}；影响窗口/快照/统计/报告日期）",
    )
    args = parser.parse_args(argv)

    flags = [
        args.all, args.collect, args.normalize, args.dedupe, args.score, args.rank, args.stats,
        args.db_rebuild, args.fetch, args.report, args.validate, args.candidates,
        args.replay_as_of is not None, args.as_of is not None,
    ]
    if not any(flags):
        parser.print_help()
        return 0

    taxonomy = _load_taxonomy()
    try:
        as_of = resolve_as_of(args.as_of)
    except ValueError as exc:
        log(str(exc))
        return 2
    # v0.7.3：仅 --fetch（不带其他流水线动作）且未显式 --as-of 时，沿用旧行为用 taxonomy.meta.as_of，
    # 保证 `--fetch --as-of YYYY-MM-DD` 可写 signals-<date>.json，而默认命令行为不变。
    fetch_only = args.fetch and not any(
        [args.all, args.collect, args.normalize, args.dedupe, args.score, args.rank, args.stats, args.report, args.validate, args.candidates]
    )
    if fetch_only and not args.as_of:
        as_of = common.parse_as_of(taxonomy)
    log(f"数据版本 {config.DATA_VERSION} / 基准日 {as_of.isoformat()}")

    # 仅数据库重建 / 仅真实采集 / 仅报告：互不阻塞
    if args.db_rebuild and not any([args.all, args.collect, args.normalize, args.score, args.rank, args.stats, args.fetch, args.report, args.validate, args.candidates]):
        stage_db()
        return 0
    if fetch_only:
        stage_fetch(as_of, args.fetch_limit, cache_enabled=not args.no_cache)
        return 0
    if args.report and not any([args.all, args.collect, args.rank, args.stats, args.validate, args.candidates]):
        periods = args.period or ["day", "week", "month", "year"]
        stage_report(periods, as_of)
        return 0

    full = args.all
    if args.replay_as_of is not None:
        try:
            replay_base = date.fromisoformat(args.replay_as_of)
        except ValueError:
            log(f"--replay-as-of 非法日期：{args.replay_as_of}")
            return 2
        if replay_base > as_of:
            log(f"--replay-as-of {replay_base} 晚于当前 as_of {as_of}，拒绝生成未来回放")
            return 2
        stage_replay(replay_base, args.replay_days)
        full = True  # 回放后自动重算当前榜单（带 history delta）/统计/SQLite/校验
    if args.collect or full or args.normalize or args.dedupe:
        records, _health = stage_collect(as_of)
        signals = stage_normalize(records, as_of)
        stage_dedupe(signals)

    if args.score or full or args.rank or args.stats:
        opportunities = stage_score(_load_opportunities(), taxonomy, as_of, fix=args.fix)
    else:
        opportunities = _load_opportunities()

    if args.candidates or full:
        stage_candidates(
            as_of,
            args.candidates_limit,
            translate_provider=args.translate_provider,
            translate_cache=not args.no_translate_cache,
        )
    if args.rank or full:
        stage_rank(opportunities, as_of)
    if args.stats or full:
        stage_stats(opportunities, taxonomy, as_of)
    if full or args.db_rebuild:
        stage_db()
    if args.fetch:
        stage_fetch(as_of, args.fetch_limit, cache_enabled=not args.no_cache)
    if args.report or (full and args.period):
        stage_report(args.period or ["day", "week", "month", "year"], as_of)
    if args.validate or full:
        return stage_validate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
