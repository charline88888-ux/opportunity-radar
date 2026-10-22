"""扫描流水线命令行入口（Python 3.11，纯标准库）。

用法：
    python scanner/pipeline.py --all            # 一键：采集→归一→去重→评分→排榜→统计→校验
    python scanner/pipeline.py --all --fix      # 同时把派生字段写回 data/opportunities.json
    python scanner/pipeline.py --collect        # 仅运行离线适配器
    python scanner/pipeline.py --rank           # 仅重算榜单
    python scanner/pipeline.py --validate       # 仅运行 V01–V15 校验
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 支持 python scanner/pipeline.py 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import common, config, materialize, normalize, rank, score, stats, validate  # noqa: E402
    from scanner import dedupe as dedupe_mod  # noqa: E402
    from scanner.adapters import load_all  # noqa: E402
else:  # pragma: no cover
    from . import common, config, materialize, normalize, rank, score, stats, validate
    from . import dedupe as dedupe_mod
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
    deduped, report = dedupe_mod.dedupe(signals)
    common.dump_json(
        config.BUILD_DIR / "dedupe_report.json",
        {"meta": {"as_of": report.get("as_of", "")}, **report},
    )
    common.dump_json(
        config.BUILD_DIR / "signals_deduped.json",
        {"meta": {"count": len(deduped)}, "signals": deduped},
    )
    log(f"去重完成：{report['input']} → {report['output']} 条（合并 {report['removed']} 条，重复率 {report['duplicate_rate']:.1%}）")
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
    # 契约 5.2.1：不一致时以计算值为准；这里统一回写，保证 --all 幂等且 validate 15/15。
    if opportunities != materialized:
        common.dump_json(config.OPPORTUNITIES_PATH, materialized)
        log("已按契约公式回写 data/opportunities.json（派生字段以扫描器计算值为准）")
    return materialized


def stage_rank(opportunities: list[dict[str, Any]], as_of: date) -> dict[str, Any]:
    rankings = rank.build_rankings(opportunities, as_of)
    common.dump_json(config.RANKINGS_PATH, rankings)
    counts = rankings["meta"]["counts"]
    log(
        "榜单已生成："
        + " / ".join(f"{window}={counts[window]}" for window in ("day", "week", "month", "year"))
        + " → data/rankings.json"
    )
    return rankings


def stage_stats(opportunities: list[dict[str, Any]], taxonomy: dict[str, Any], as_of: date) -> dict[str, Any]:
    payload = stats.build_stats(opportunities, taxonomy, as_of)
    common.dump_json(config.STATS_PATH, payload)
    kpi = payload["kpi"]
    log(
        f"统计已生成：{kpi['total_opps']} 条机会 / A 级以上 {kpi['grade_a_plus']} 条 / "
        f"平均分 {kpi['avg_total']} / 开放窗口价值 {payload['open_window_value_cny']} 元 → data/stats.json"
    )
    return payload


def stage_validate() -> int:
    report = validate.run_validation()
    passed = sum(1 for row in report.rows if row["ok"])
    for row in report.failures:
        log(f"  ✗ {row['rule']} {row['name']}：{row['detail']}")
    for warning in report.warnings[:15]:
        log(f"  · 提示 {warning}")
    log(f"校验完成：{passed}/{len(report.rows)} 条规则通过")
    return 0 if not report.failures else 1


# ---------------------------------------------------------------- 入口
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="机会雷达扫描流水线")
    parser.add_argument("--all", action="store_true", help="运行完整流水线并校验")
    parser.add_argument("--collect", action="store_true", help="运行采集适配器（离线 fixtures）")
    parser.add_argument("--normalize", action="store_true", help="归一化原始信号")
    parser.add_argument("--dedupe", action="store_true", help="去重并合并跨源信号")
    parser.add_argument("--score", action="store_true", help="按公式重算评分并检查一致性")
    parser.add_argument("--rank", action="store_true", help="重算日/周/月/年榜单")
    parser.add_argument("--stats", action="store_true", help="重算聚合统计")
    parser.add_argument("--validate", action="store_true", help="运行 V01–V15 数据校验")
    parser.add_argument("--fix", action="store_true", help="把派生字段写回 data/opportunities.json")
    args = parser.parse_args(argv)

    if not any(
        [args.all, args.collect, args.normalize, args.dedupe, args.score, args.rank, args.stats, args.validate]
    ):
        parser.print_help()
        return 0

    taxonomy = _load_taxonomy()
    as_of = _as_of(taxonomy)
    log(f"数据版本 {config.DATA_VERSION} / 基准日 {as_of.isoformat()}")

    full = args.all
    signals: list[dict[str, Any]] | None = None

    if args.collect or full or args.normalize or args.dedupe:
        records, _health = stage_collect(as_of)
        signals = stage_normalize(records, as_of)
        signals = stage_dedupe(signals)

    if args.score or full or args.rank or args.stats:
        opportunities = stage_score(_load_opportunities(), taxonomy, as_of, fix=args.fix)
    else:
        opportunities = _load_opportunities()

    if args.rank or full:
        stage_rank(opportunities, as_of)
    if args.stats or full:
        stage_stats(opportunities, taxonomy, as_of)
    if args.validate or full:
        return stage_validate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
