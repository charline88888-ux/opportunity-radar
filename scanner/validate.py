"""数据校验器：契约 docs/12 第 9 节 V01–V15。

用法：
    python scanner/validate.py          # 人类可读报告，失败退出码 1
    python scanner/validate.py --json   # 机器可读结果
"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

if __package__ in (None, ""):  # 支持 python scanner/validate.py 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import common, config, history, rank, score, stats  # noqa: E402
else:  # pragma: no cover - 作为包导入时
    from . import common, config, history, rank, score, stats

# ---------------------------------------------------------------- 契约固定枚举（独立硬编码，用于校验 taxonomy 未漂移）
EXPECTED_ENUMS: dict[str, set[str]] = {
    "industries": {
        "pet", "silver", "emotional", "ai", "crossborder", "content", "education",
        "local", "green", "compliance", "culture", "gaming", "fintech", "manufacturing",
    },
    "human_needs": {
        "survival", "health", "belonging", "status", "growth", "novelty",
        "control", "ease", "meaning", "nostalgia", "fairness", "expression",
    },
    "neuro_drivers": {"dopamine", "endorphin", "oxytocin", "serotonin", "cortisol", "adrenaline"},
    "emotions": {
        "complaint", "anxiety", "loneliness", "grief", "nostalgia", "shame", "envy", "fear",
        "hope", "aspiration", "boredom", "ritual", "identity", "control", "curiosity", "laziness",
        "greed", "justice", "devotion", "pride", "guilt", "relief", "love", "awe",
    },
    "gap_types": {
        "language", "culture", "time", "geo", "knowledge", "regulation", "platform",
        "price", "channel", "demographic", "emotion", "infrastructure",
    },
    "drivers": {"capital", "tech", "info", "cross-border", "regulation", "ops", "supply"},
    "business_models": {
        "dtc", "marketplace", "service", "subscription", "infoproduct", "saas",
        "agency", "licensing", "affiliate", "arbitrage", "community", "consulting",
    },
    "regions": {
        "north-america", "europe", "mena", "sea", "east-asia", "south-asia",
        "latam", "africa", "oceania", "cis", "china",
    },
    "score_dimensions": {"signal", "gap", "feasibility", "economics", "timing", "competition", "risk", "fit", "evidence", "leverage"},
    "tags": {
        "low-capital", "side-hustle", "solo", "remote", "cross-border", "content-driven",
        "tech-driven", "needs-license", "needs-supply-chain", "english-ok", "localization-heavy",
        "b2b", "b2c", "recurring", "seasonal", "platform-dependent", "ai-native", "physical",
        "digital", "china-advantage",
    },
    "grades": {"S", "A", "B", "C", "D"},
}

FORBIDDEN_PLACEHOLDERS = ["待补充", "TODO", "TBD", "待定"]


class CheckFailure(Exception):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise CheckFailure(message)


class Report:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []
        self.warnings: list[str] = []

    def check(self, rule: str, name: str, fn: Callable[[], str | None]) -> None:
        try:
            detail = fn() or "通过"
            self.rows.append({"rule": rule, "name": name, "ok": True, "detail": detail})
        except CheckFailure as exc:
            self.rows.append({"rule": rule, "name": name, "ok": False, "detail": str(exc)})
        except FileNotFoundError as exc:
            self.rows.append({"rule": rule, "name": name, "ok": False, "detail": f"文件缺失：{exc}"})
        except Exception as exc:  # noqa: BLE001 - 校验器自身异常也要报出来
            self.rows.append(
                {"rule": rule, "name": name, "ok": False, "detail": f"校验异常：{type(exc).__name__}: {exc}"}
            )

    @property
    def failures(self) -> list[dict[str, Any]]:
        return [row for row in self.rows if not row["ok"]]


# ---------------------------------------------------------------- 载入
def _load_all() -> dict[str, Any]:
    def safe(path: Path) -> Any:
        return common.load_json(path) if path.exists() else None

    return {
        "taxonomy": safe(config.TAXONOMY_PATH),
        "opportunities": safe(config.OPPORTUNITIES_PATH),
        "rankings": safe(config.RANKINGS_PATH),
        "stats": safe(config.STATS_PATH),
        "sources": safe(config.SOURCES_PATH),
        "playbooks": safe(config.PLAYBOOKS_PATH),
        "calendar": safe(config.CALENDAR_PATH),
    }


def _opps(ctx: dict[str, Any]) -> list[dict[str, Any]]:
    data = ctx["opportunities"]
    _require(data is not None, "data/opportunities.json 缺失或不是合法 JSON")
    return data


def _taxonomy(ctx: dict[str, Any]) -> dict[str, Any]:
    data = ctx["taxonomy"]
    _require(data is not None, "data/taxonomy.json 缺失或不是合法 JSON")
    return data


def _as_of(ctx: dict[str, Any]) -> date:
    return common.parse_as_of(_taxonomy(ctx))


# ---------------------------------------------------------------- V01
def _v01(ctx: dict[str, Any]) -> str:
    taxonomy = _taxonomy(ctx)
    _require(
        (taxonomy.get("meta") or {}).get("data_version") == config.DATA_VERSION,
        f"taxonomy.meta.data_version={(taxonomy.get('meta') or {}).get('data_version')} ≠ {config.DATA_VERSION}",
    )
    for collection, expected in EXPECTED_ENUMS.items():
        items = taxonomy.get(collection)
        _require(isinstance(items, list), f"taxonomy.{collection} 缺失")
        actual = {item["id"] for item in items}
        _require(
            actual == expected,
            f"taxonomy.{collection} id 集合与契约不一致：缺 {sorted(expected - actual)}，多 {sorted(actual - expected)}",
        )
        _require(
            len(items) == config.TAXONOMY_COUNTS[collection],
            f"taxonomy.{collection} 数量 {len(items)} ≠ {config.TAXONOMY_COUNTS[collection]}",
        )
        for item in items:
            for field in ("name", "desc"):
                _require(bool(item.get(field)), f"taxonomy.{collection}.{item['id']}.{field} 为空")

    industry_ids = {item["id"] for item in taxonomy["industries"]}
    need_ids = {item["id"] for item in taxonomy["human_needs"]}
    neuro_ids = {item["id"] for item in taxonomy["neuro_drivers"]}
    emotion_ids = {item["id"] for item in taxonomy["emotions"]}
    gap_ids = {item["id"] for item in taxonomy["gap_types"]}
    driver_ids = {item["id"] for item in taxonomy["drivers"]}
    region_ids = {item["id"] for item in taxonomy["regions"]}
    tag_ids = {item["id"] for item in taxonomy["tags"]}
    model_ids = {item["id"] for item in taxonomy["business_models"]}

    errors: list[str] = []
    for opp in _opps(ctx):
        opp_id = opp.get("id", "<no-id>")
        if opp.get("industry_id") not in industry_ids:
            errors.append(f"{opp_id}.industry_id={opp.get('industry_id')}")
        for field, allowed in (
            ("gap_type_ids", gap_ids),
            ("region_ids", region_ids),
            ("human_need_ids", need_ids),
            ("neuro_drivers", neuro_ids),
            ("emotion_tags", emotion_ids),
            ("tags", tag_ids),
        ):
            values = opp.get(field)
            if not isinstance(values, list):
                errors.append(f"{opp_id}.{field} 不是数组")
                continue
            bad = [value for value in values if value not in allowed]
            if bad:
                errors.append(f"{opp_id}.{field} 非法值 {bad}")
        drivers = (opp.get("seven_questions") or {}).get("drivers")
        if isinstance(drivers, list):
            bad = [value for value in drivers if value not in driver_ids]
            if bad:
                errors.append(f"{opp_id}.seven_questions.drivers 非法值 {bad}")
    _ = model_ids
    _require(not errors, "枚举引用问题：" + "；".join(errors[:12]) + (f" 等 {len(errors)} 处" if len(errors) > 12 else ""))
    return f"11 组枚举与 {len(_opps(ctx))} 条机会引用完整"


# ---------------------------------------------------------------- V02
def _v02(ctx: dict[str, Any]) -> str:
    opportunities = _opps(ctx)
    taxonomy = _taxonomy(ctx)
    _require(len(opportunities) >= 40, f"机会数 {len(opportunities)} < 40")
    industries = {opp["industry_id"] for opp in opportunities}
    expected = {item["id"] for item in taxonomy["industries"]}
    missing = expected - industries
    _require(not missing, f"行业覆盖缺失：{sorted(missing)}")
    regions = {region for opp in opportunities for region in opp.get("region_ids", [])}
    _require(len(regions) >= 10, f"区域覆盖 {len(regions)} < 10")
    return f"{len(opportunities)} 条机会 / 14 行业 / {len(regions)} 区域"


# ---------------------------------------------------------------- V03
def _v03(ctx: dict[str, Any]) -> str:
    errors: list[str] = []
    total_evidence = 0
    for opp in _opps(ctx):
        opp_id = opp.get("id", "<no-id>")
        signal = opp.get("signal") or {}
        evidence = signal.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            errors.append(f"{opp_id}: evidence 为空")
            continue
        total_evidence += len(evidence)
        for idx, item in enumerate(evidence):
            url = item.get("url", "")
            if not isinstance(url, str) or not url.startswith("http"):
                errors.append(f"{opp_id}.evidence[{idx}].url 非 http")
            if item.get("tier") not in config.EVIDENCE_TIERS:
                errors.append(f"{opp_id}.evidence[{idx}].tier={item.get('tier')}")
            for field in ("title", "publisher", "date", "quote", "lang"):
                if not item.get(field):
                    errors.append(f"{opp_id}.evidence[{idx}].{field} 为空")
            try:
                common.parse_date(item.get("date", ""))
            except ValueError:
                errors.append(f"{opp_id}.evidence[{idx}].date 非法")
        if opp.get("evidence_count") != len(evidence):
            errors.append(f"{opp_id}: evidence_count={opp.get('evidence_count')} ≠ {len(evidence)}")
        if signal.get("signal_strength") is None:
            errors.append(f"{opp_id}: signal.signal_strength 缺失")
        if signal.get("trend_direction") not in config.TREND_DIRECTIONS:
            errors.append(f"{opp_id}: trend_direction 非法")
        for field in ("summary", "volume_estimate"):
            if not signal.get(field):
                errors.append(f"{opp_id}: signal.{field} 为空")
    _require(not errors, "；".join(errors[:12]) + (f" 等 {len(errors)} 处" if len(errors) > 12 else ""))
    return f"{len(_opps(ctx))} 条机会 / {total_evidence} 条证据"


# ---------------------------------------------------------------- V04
def _v04(ctx: dict[str, Any]) -> str:
    required = ["traffic", "money", "model", "roi", "audience", "drivers", "moat"]
    errors: list[str] = []
    for opp in _opps(ctx):
        opp_id = opp.get("id", "<no-id>")
        seven = opp.get("seven_questions") or {}
        for field in required:
            value = seven.get(field)
            if field == "drivers":
                if not isinstance(value, list) or not value:
                    errors.append(f"{opp_id}.drivers 为空")
                continue
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{opp_id}.{field} 为空")
                continue
            for placeholder in FORBIDDEN_PLACEHOLDERS:
                if placeholder.lower() in value.lower():
                    errors.append(f"{opp_id}.{field} 含占位符 {placeholder}")
    _require(not errors, "；".join(errors[:12]) + (f" 等 {len(errors)} 处" if len(errors) > 12 else ""))
    return f"{len(_opps(ctx))} 条机会七问齐全"


# ---------------------------------------------------------------- V05
def _v05(ctx: dict[str, Any]) -> str:
    taxonomy = _taxonomy(ctx)
    weights = score.weights_from_taxonomy(taxonomy)
    _require(abs(sum(weights.values()) - 1.0) < 1e-6, f"评权重合计 {sum(weights.values())} ≠ 1.00")
    errors: list[str] = []
    for opp in _opps(ctx):
        opp_id = opp.get("id", "<no-id>")
        dims = (opp.get("scores") or {}).get("dimensions") or {}
        if set(dims) != set(config.DIMENSION_ORDER):
            errors.append(f"{opp_id}: dimensions 键集合不符")
            continue
        for dim_id, value in dims.items():
            if not isinstance(value, (int, float)) or not (0 <= float(value) <= 10):
                errors.append(f"{opp_id}.{dim_id}={value} 越界")
        issues = score.score_diff(opp, taxonomy)
        if issues:
            errors.append(f"{opp_id}: " + "；".join(issues))
        window = opp.get("window") or {}
        if window.get("status") not in config.WINDOW_STATUSES:
            errors.append(f"{opp_id}: window.status 非法")
        months = window.get("months_left")
        if not isinstance(months, int) or months <= 0:
            errors.append(f"{opp_id}: window.months_left 非正整数")
        if window.get("decay") not in config.DECAY_LEVELS:
            errors.append(f"{opp_id}: window.decay 非法")
        grade = (opp.get("scores") or {}).get("grade")
        if grade not in EXPECTED_ENUMS["grades"]:
            errors.append(f"{opp_id}: grade={grade} 非法")
    _require(not errors, "；".join(errors[:12]) + (f" 等 {len(errors)} 处" if len(errors) > 12 else ""))
    return f"{len(_opps(ctx))} 条机会评分与公式一致（权重合计 1.00）"


# ---------------------------------------------------------------- V06 / V07
def _v06(ctx: dict[str, Any]) -> str:
    errors: list[str] = []
    for opp in _opps(ctx):
        window = opp.get("window") or {}
        if window.get("status") not in config.WINDOW_STATUSES:
            errors.append(f"{opp.get('id')}: window.status")
        if window.get("decay") not in config.DECAY_LEVELS:
            errors.append(f"{opp.get('id')}: window.decay")
        if not isinstance(window.get("months_left"), int) or window.get("months_left") <= 0:
            errors.append(f"{opp.get('id')}: months_left")
    _require(not errors, "；".join(errors[:12]))
    return f"{len(_opps(ctx))} 条窗口字段合法"


def _v07(ctx: dict[str, Any]) -> str:
    as_of = _as_of(ctx)
    errors: list[str] = []
    for opp in _opps(ctx):
        opp_id = opp.get("id", "<no-id>")
        dates = opp.get("activity_dates")
        if not isinstance(dates, list) or not dates:
            errors.append(f"{opp_id}: activity_dates 为空")
            continue
        try:
            parsed = [common.parse_date(item) for item in dates]
        except ValueError:
            errors.append(f"{opp_id}: activity_dates 含非法日期")
            continue
        if parsed != sorted(parsed):
            errors.append(f"{opp_id}: activity_dates 未升序")
        last = common.parse_date(opp.get("last_activity", "1970-01-01"))
        first = common.parse_date(opp.get("first_seen", "1970-01-01"))
        if first > last:
            errors.append(f"{opp_id}: first_seen > last_activity")
        if last != max(parsed):
            errors.append(f"{opp_id}: last_activity ≠ max(activity_dates)")
        if last > as_of:
            errors.append(f"{opp_id}: last_activity 晚于 as_of")
    _require(not errors, "；".join(errors[:12]))
    return f"{len(_opps(ctx))} 条日期链自洽（as_of={as_of.isoformat()}）"


# ---------------------------------------------------------------- V08 / V09
def _rankings(ctx: dict[str, Any]) -> dict[str, Any]:
    data = ctx["rankings"]
    _require(data is not None, "data/rankings.json 缺失，请先运行 python scanner/pipeline.py --all")
    return data


def _v08(ctx: dict[str, Any]) -> str:
    rankings = _rankings(ctx)
    opp_ids = {opp["id"] for opp in _opps(ctx)}
    windows = rankings.get("windows") or {}
    counts = {}
    for window, quota in config.WINDOW_QUOTAS.items():
        data = windows.get(window)
        _require(isinstance(data, dict), f"rankings.windows.{window} 缺失")
        items = data.get("items") or []
        counts[window] = len(items)
        _require(len(items) >= quota, f"{window} 榜单 {len(items)} 条 < 配额 {quota}")
        ranks = [item.get("rank") for item in items]
        _require(ranks == list(range(1, len(items) + 1)), f"{window} rank 未从 1 连续")
        scores = [float(item.get("rank_score", 0)) for item in items]
        _require(scores == sorted(scores, reverse=True), f"{window} 未按 rank_score 降序")
        for item in items:
            _require(item.get("opp_id") in opp_ids, f"{window} 引用不存在的 opp_id {item.get('opp_id')}")
            _require(item.get("change") in {"new", "up", "down", "flat"}, f"{window} change 非法")
    return " / ".join(f"{window}={count}" for window, count in counts.items())


def _v09(ctx: dict[str, Any]) -> str:
    as_of = _as_of(ctx)
    previous = history.find_previous_snapshot(as_of)
    expected = rank.build_rankings(
        _opps(ctx), as_of, previous_snapshot=previous[1] if previous else None
    )
    actual = _rankings(ctx)
    _require(actual.get("windows") == expected.get("windows"), "rankings 与按规则重算结果不一致")
    actual_meta = actual.get("meta") or {}
    _require(
        actual_meta.get("delta_basis") == expected["meta"]["delta_basis"],
        f"rankings.meta.delta_basis={actual_meta.get('delta_basis')} ≠ 重算 {expected['meta']['delta_basis']}",
    )
    _require(
        actual_meta.get("history_as_of") == expected["meta"]["history_as_of"],
        "rankings.meta.history_as_of 与重算不一致",
    )
    return "榜单与重算结果完全一致（含 delta_basis）"


# ---------------------------------------------------------------- V10
def _v10(ctx: dict[str, Any]) -> str:
    data = ctx["sources"]
    _require(data is not None, "data/sources.json 缺失")
    categories = data.get("categories") or []
    _require(len(categories) >= 12, f"分类数 {len(categories)} < 12")
    category_ids = [category.get("id") for category in categories]
    _require(set(category_ids) == set(config.SOURCE_CATEGORY_IDS), f"12 大类 id 不符：{category_ids}")
    total = 0
    ids: list[str] = []
    errors: list[str] = []
    for category in categories:
        for source in category.get("sources") or []:
            total += 1
            source_id = source.get("id", "")
            ids.append(source_id)
            if source.get("access") not in config.ACCESS_MODES:
                errors.append(f"{source_id}.access={source.get('access')}")
            if source.get("frequency") not in config.FREQUENCIES:
                errors.append(f"{source_id}.frequency={source.get('frequency')}")
            if source.get("cost") not in config.COSTS:
                errors.append(f"{source_id}.cost={source.get('cost')}")
            if source.get("compliance") not in config.COMPLIANCE_LEVELS:
                errors.append(f"{source_id}.compliance={source.get('compliance')}")
            value_score = source.get("value_score")
            if not isinstance(value_score, (int, float)) or not (0 <= float(value_score) <= 10):
                errors.append(f"{source_id}.value_score")
            if not str(source.get("url", "")).startswith("http"):
                errors.append(f"{source_id}.url")
            for field in ("name", "notes"):
                if not source.get(field):
                    errors.append(f"{source_id}.{field} 为空")
            if not isinstance(source.get("regions"), list) or not source.get("regions"):
                errors.append(f"{source_id}.regions 为空")
            if not isinstance(source.get("signal_types"), list) or not source.get("signal_types"):
                errors.append(f"{source_id}.signal_types 为空")
    _require(total >= 60, f"数据源 {total} 个 < 60")
    _require(len(ids) == len(set(ids)), "数据源 id 重复")
    _require(not errors, "；".join(errors[:12]) + (f" 等 {len(errors)} 处" if len(errors) > 12 else ""))
    _require(data.get("meta", {}).get("count") == total, f"sources.meta.count={data.get('meta', {}).get('count')} ≠ {total}")
    return f"{total} 个数据源 / 12 大类"


# ---------------------------------------------------------------- V11
def _v11(ctx: dict[str, Any]) -> str:
    data = ctx["playbooks"]
    _require(data is not None, "data/playbooks.json 缺失")
    playbooks = data.get("playbooks") or []
    _require(len(playbooks) >= 12, f"剧本 {len(playbooks)} 个 < 12")
    taxonomy = _taxonomy(ctx)
    need_ids = {item["id"] for item in taxonomy["human_needs"]}
    emotion_ids = {item["id"] for item in taxonomy["emotions"]}
    errors: list[str] = []
    for playbook in playbooks:
        playbook_id = playbook.get("id", "")
        if len(playbook.get("steps") or []) < 4:
            errors.append(f"{playbook_id}: steps < 4")
        if len(playbook.get("platforms") or []) < 2:
            errors.append(f"{playbook_id}: platforms < 2")
        for field in ("name", "purpose", "output"):
            if not playbook.get(field):
                errors.append(f"{playbook_id}.{field} 为空")
        if not isinstance(playbook.get("time_box_min"), int) or playbook.get("time_box_min") <= 0:
            errors.append(f"{playbook_id}.time_box_min")
        for need in playbook.get("human_need_ids") or []:
            if need not in need_ids:
                errors.append(f"{playbook_id}.human_need_ids={need}")
        for emotion in playbook.get("emotion_ids") or []:
            if emotion not in emotion_ids:
                errors.append(f"{playbook_id}.emotion_ids={emotion}")
        if not playbook.get("keywords"):
            errors.append(f"{playbook_id}.keywords 为空")
        if not playbook.get("quality_checks"):
            errors.append(f"{playbook_id}.quality_checks 为空")
    _require(not errors, "；".join(errors[:12]))
    _require(data.get("meta", {}).get("count") == len(playbooks), "playbooks.meta.count 与实际不一致")
    return f"{len(playbooks)} 个剧本"


# ---------------------------------------------------------------- V12
def _v12(ctx: dict[str, Any]) -> str:
    data = ctx["calendar"]
    _require(data is not None, "data/calendar.json 缺失")
    events = data.get("events") or []
    _require(len(events) >= 24, f"日历节点 {len(events)} 个 < 24")
    taxonomy = _taxonomy(ctx)
    region_ids = {item["id"] for item in taxonomy["regions"]}
    errors: list[str] = []
    for event in events:
        name = event.get("name", "")
        if event.get("type") not in config.CALENDAR_TYPES:
            errors.append(f"{name}: type={event.get('type')}")
        for field in ("date", "name", "notes"):
            if not event.get(field):
                errors.append(f"{name}.{field} 为空")
        try:
            start = common.parse_date(event.get("date", "1970-01-01"))
            end = common.parse_date(event["end_date"]) if event.get("end_date") else start
        except ValueError:
            errors.append(f"{name}: date/end_date 非法")
            continue
        if not (date(2026, 1, 1) <= start <= date(2028, 12, 31)):
            errors.append(f"{name}: date 不在 2026-2028")
        if end < start:
            errors.append(f"{name}: end_date < date")
        for region in event.get("region_ids") or []:
            if region not in region_ids:
                errors.append(f"{name}: region_ids={region}")
        if not isinstance(event.get("lead_time_days"), int) or event.get("lead_time_days") < 0:
            errors.append(f"{name}: lead_time_days")
        if not event.get("themes"):
            errors.append(f"{name}: themes 为空")
    _require(not errors, "；".join(errors[:12]))
    _require(data.get("meta", {}).get("count") == len(events), "calendar.meta.count 与实际不一致")
    return f"{len(events)} 个日历节点"


# ---------------------------------------------------------------- V13
def _v13(ctx: dict[str, Any]) -> str:
    hits: list[str] = []
    for name in ("taxonomy", "opportunities", "rankings", "stats", "sources", "playbooks", "calendar"):
        document = ctx.get(name)
        if document is None:
            continue
        for path, text in common.iter_strings(document, name):
            for word in config.BANNED_WORDS:
                if word in text:
                    hits.append(f"{path}: {word}")
    _require(not hits, "禁用词命中：" + "；".join(hits[:10]))
    return "无 V13 禁用词"


# ---------------------------------------------------------------- V14
def _v14(ctx: dict[str, Any]) -> str:
    data = ctx["stats"]
    _require(data is not None, "data/stats.json 缺失，请先运行 python scanner/pipeline.py --all")
    opportunities = _opps(ctx)
    expected = stats.build_stats(opportunities, _taxonomy(ctx), _as_of(ctx))
    errors: list[str] = []
    for key in ("kpi", "by_grade", "by_industry", "by_gap_type", "by_region", "by_need",
                "score_histogram", "trend_14d", "open_window_value_cny"):
        if data.get(key) != expected.get(key):
            errors.append(key)
    _require(not errors, f"stats.json 聚合与实际不一致：{errors}")
    return f"KPI 与实际聚合一致（{len(opportunities)} 条机会）"


# ---------------------------------------------------------------- V15
def _v15(ctx: dict[str, Any]) -> str:
    opportunities = _opps(ctx)
    ids = [opp.get("id") for opp in opportunities]
    slugs = [opp.get("slug") for opp in opportunities]
    dup_ids = sorted({item for item in ids if ids.count(item) > 1}) if len(ids) != len(set(ids)) else []
    dup_slugs = sorted({item for item in slugs if slugs.count(item) > 1}) if len(slugs) != len(set(slugs)) else []
    _require(not dup_ids, f"id 重复：{dup_ids}")
    _require(not dup_slugs, f"slug 重复：{dup_slugs}")
    for opp in opportunities:
        if not str(opp.get("id", "")).startswith("opp-"):
            raise CheckFailure(f"id 命名不规范：{opp.get('id')}")
        if not str(opp.get("slug", "")):
            raise CheckFailure(f"slug 为空：{opp.get('id')}")
    return f"{len(ids)} 条机会 id / slug 唯一"


# ---------------------------------------------------------------- V16
def _v16(ctx: dict[str, Any]) -> str:
    errors: list[str] = []
    for opp in _opps(ctx):
        opp_id = opp.get("id", "<no-id>")
        if not opp.get("disclaimer"):
            errors.append(f"{opp_id}: disclaimer 缺失")
        roi = opp.get("roi") or {}
        capital = roi.get("capital_cny")
        if not isinstance(capital, dict):
            errors.append(f"{opp_id}: roi.capital_cny 缺失")
        else:
            for key in ("min", "max"):
                if not isinstance(capital.get(key), int) or capital.get(key) < 0:
                    errors.append(f"{opp_id}: roi.capital_cny.{key} 非非负整数")
            if isinstance(capital.get("min"), int) and isinstance(capital.get("max"), int):
                if capital["min"] > capital["max"]:
                    errors.append(f"{opp_id}: capital_cny.min > max")
        for key in ("time_to_revenue_months", "payback_months", "team_size"):
            if not isinstance(roi.get(key), int) or roi.get(key) < 0:
                errors.append(f"{opp_id}: roi.{key} 非非负整数")
        if isinstance(roi.get("team_size"), int) and roi["team_size"] < 1:
            errors.append(f"{opp_id}: roi.team_size < 1")
        margin = roi.get("gross_margin_pct")
        if not isinstance(margin, (int, float)) or not (0 <= float(margin) <= 100):
            errors.append(f"{opp_id}: roi.gross_margin_pct 越界")
        if roi.get("effort_level") not in config.EFFORT_LEVELS:
            errors.append(f"{opp_id}: roi.effort_level={roi.get('effort_level')}")
        risks = opp.get("risks")
        if not isinstance(risks, list) or not (2 <= len(risks) <= 5):
            errors.append(f"{opp_id}: risks 需 2–5 条")
        kill = opp.get("kill_criteria")
        if not isinstance(kill, list) or not (2 <= len(kill) <= 4):
            errors.append(f"{opp_id}: kill_criteria 需 2–4 条")
        steps = opp.get("first_steps_7d")
        if not isinstance(steps, list) or not (3 <= len(steps) <= 6):
            errors.append(f"{opp_id}: first_steps_7d 需 3–6 条")
        window = opp.get("window") or {}
        status = window.get("status")
        months = window.get("months_left")
        if isinstance(months, int):
            if status == "open" and months < 9:
                errors.append(f"{opp_id}: status=open 需 months_left ≥ 9")
            elif status == "peak" and not (3 <= months <= 8):
                errors.append(f"{opp_id}: status=peak 需 months_left 3–8")
            elif status == "closing" and not (1 <= months <= 2):
                errors.append(f"{opp_id}: status=closing 需 months_left 1–2")
            elif status == "closed" and months != 0:
                errors.append(f"{opp_id}: status=closed 需 months_left=0")
    _require(not errors, "；".join(errors[:12]) + (f" 等 {len(errors)} 处" if len(errors) > 12 else ""))
    return f"{len(_opps(ctx))} 条必填字段与窗口映射完整"


# ---------------------------------------------------------------- V17
def _v17(ctx: dict[str, Any]) -> str:
    as_of = _as_of(ctx)
    errors: list[str] = []
    total = 0
    for opp in _opps(ctx):
        opp_id = opp.get("id", "<no-id>")
        for idx, item in enumerate((opp.get("signal") or {}).get("evidence") or []):
            total += 1
            try:
                item_date = common.parse_date(item.get("date", ""))
            except ValueError:
                errors.append(f"{opp_id}.evidence[{idx}].date 非法")
                item_date = None
            if item_date and item_date > as_of:
                errors.append(f"{opp_id}.evidence[{idx}].date 晚于 as_of")
            if item.get("tier") not in config.EVIDENCE_TIERS:
                errors.append(f"{opp_id}.evidence[{idx}].tier={item.get('tier')}")
            parsed = urlparse(str(item.get("url", "")))
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                errors.append(f"{opp_id}.evidence[{idx}].url 不可解析")
    _require(not errors, "；".join(errors[:12]) + (f" 等 {len(errors)} 处" if len(errors) > 12 else ""))
    return f"{total} 条证据日期/tier/URL 合法"


# ---------------------------------------------------------------- V18
def _v18(ctx: dict[str, Any]) -> str:
    rankings = _rankings(ctx)
    meta = rankings.get("meta") or {}
    windows = rankings.get("windows") or {}
    errors: list[str] = []
    basis = meta.get("delta_basis")
    if basis not in config.DELTA_BASES:
        errors.append(f"meta.delta_basis={basis} 非法")
    if "history_as_of" not in meta:
        errors.append("meta.history_as_of 缺失")
    if not meta.get("tie_breaker"):
        errors.append("meta.tie_breaker 缺失")
    for window in ("day", "week", "month", "year"):
        for item in (windows.get(window) or {}).get("items") or []:
            change = item.get("change")
            delta = item.get("delta")
            if change not in {"new", "up", "down", "flat"}:
                errors.append(f"{window}:{item.get('opp_id')} change={change}")
                continue
            # adjacent-window 口径下 year 无参照：delta 必须 null；
            # history 口径下 year 有上一快照名次时允许 int。
            if basis == "adjacent-window" and window == "year" and delta is not None:
                errors.append(f"year:{item.get('opp_id')} adjacent-window 口径下 delta 应为 null")
            if change == "new" and delta is not None:
                errors.append(f"{window}:{item.get('opp_id')} change=new 但 delta 非 null")
            if change == "up" and not (isinstance(delta, int) and delta > 0):
                errors.append(f"{window}:{item.get('opp_id')} change=up 但 delta≤0")
            if change == "down" and not (isinstance(delta, int) and delta < 0):
                errors.append(f"{window}:{item.get('opp_id')} change=down 但 delta≥0")
            if change == "flat" and delta != 0:
                errors.append(f"{window}:{item.get('opp_id')} change=flat 但 delta≠0")
    _require(not errors, "；".join(errors[:12]))
    return f"榜单 change/delta 语义一致（delta_basis={basis}）"


# ---------------------------------------------------------------- V19
def _v19(ctx: dict[str, Any]) -> str:
    rankings = _rankings(ctx)
    as_of = _as_of(ctx)
    as_of_iso = as_of.isoformat()
    snapshot_file = history.snapshot_path(as_of)
    _require(snapshot_file.exists(), f"缺少当天历史快照 {snapshot_file.relative_to(config.ROOT)}")
    snapshot = common.load_json(snapshot_file)
    issues = history.validate_snapshot_shape(snapshot, as_of)
    # 与同日 rankings.json 的窗口 items 顺序/分数一致
    if snapshot.get("windows") != rankings.get("windows"):
        issues.append("快照 windows 与 rankings.json 不一致")
    _require(not issues, "；".join(issues[:8]))
    snapshots = history.list_snapshots()
    for day, _path in snapshots:
        if day > as_of:
            raise CheckFailure(f"历史快照日期 {day} 晚于 as_of {as_of_iso}")
    return f"{len(snapshots)} 份历史快照合法，最新快照与 rankings 一致"


# ---------------------------------------------------------------- V20
def _v20(ctx: dict[str, Any]) -> str:
    path = config.SOURCE_HEALTH_PATH
    if not path.exists():
        return "source-health.json 不存在（可选文件，跳过）"
    data = common.load_json(path)
    sources_doc = ctx.get("sources")
    _require(sources_doc is not None, "校验 source-health 需要 sources.json")
    valid_ids = {
        source["id"]
        for category in sources_doc.get("categories") or []
        for source in category.get("sources") or []
    }
    rows = data.get("sources") or []
    _require(isinstance(rows, list), "source-health.sources 不是数组")
    errors: list[str] = []
    for row in rows:
        source_id = row.get("id")
        if source_id not in valid_ids:
            errors.append(f"{source_id}: id 不在 sources.json")
        if not isinstance(row.get("ok"), bool):
            errors.append(f"{source_id}: ok 非 bool")
        latency = row.get("latency_ms")
        if not isinstance(latency, int) or latency < 0:
            errors.append(f"{source_id}: latency_ms 非非负整数")
        checked_at = row.get("checked_at")
        try:
            datetime.fromisoformat(str(checked_at))
        except (TypeError, ValueError):
            errors.append(f"{source_id}: checked_at 非法")
        status = row.get("status")
        if status is not None and (not isinstance(status, int) or status < 0):
            errors.append(f"{source_id}: status 非法")
        items = row.get("items")
        if items is not None and (not isinstance(items, int) or items < 0):
            errors.append(f"{source_id}: items 非法")
    _require(not errors, "；".join(errors[:12]))
    ok_count = sum(1 for row in rows if row.get("ok"))
    return f"{len(rows)} 个源健康度合法（ok={ok_count}）"


# ---------------------------------------------------------------- 附加（非 V 规则，仅提示）
def _advisories(ctx: dict[str, Any], report: Report) -> None:
    opportunities = ctx["opportunities"] or []
    taxonomy = ctx["taxonomy"] or {}
    for opp in opportunities:
        opp_id = opp.get("id", "<no-id>")
        title = opp.get("title") or ""
        one_liner = opp.get("one_liner") or ""
        if len(title) > 28:
            report.warnings.append(f"{opp_id}: title 长度 {len(title)} > 28 字")
        if len(one_liner) > 60:
            report.warnings.append(f"{opp_id}: one_liner 长度 {len(one_liner)} > 60 字")
        if len(opp.get("risks") or []) < 2:
            report.warnings.append(f"{opp_id}: risks < 2 条")
        if len(opp.get("first_steps_7d") or []) < 3:
            report.warnings.append(f"{opp_id}: first_steps_7d < 3 条")
        if len(opp.get("kill_criteria") or []) < 2:
            report.warnings.append(f"{opp_id}: kill_criteria < 2 条")
        if not opp.get("compliance_notes"):
            report.warnings.append(f"{opp_id}: compliance_notes 为空")
        if opp.get("verified") is False and "未" not in (opp.get("compliance_notes") or ""):
            report.warnings.append(f"{opp_id}: verified=false 但 compliance_notes 未说明核验状态")
        if opp.get("verified") is True:
            report.warnings.append(f"{opp_id}: verified=true，请确认所有证据 URL 实际可访问")
        seven = opp.get("seven_questions") or {}
        for field in ("traffic", "money", "model", "roi", "audience", "moat"):
            value = seven.get(field)
            if isinstance(value, str) and 0 < len(value) < 12:
                report.warnings.append(f"{opp_id}: seven_questions.{field} 过短（{len(value)} 字）")
        try:
            first_activity = min(common.parse_date(day) for day in opp.get("activity_dates") or [])
            if common.parse_date(opp["first_seen"]) < first_activity:
                report.warnings.append(f"{opp_id}: first_seen 早于 activity_dates 最小值（允许，仅提示）")
        except (ValueError, KeyError):
            pass
    for name in ("README", "CHANGELOG"):
        if not (config.DATA_DIR / f"{name}.md").exists():
            report.warnings.append(f"data/{name}.md 缺失")
    region_ids = {region for opp in opportunities for region in opp.get("region_ids", [])}
    countries = {country for opp in opportunities for country in (opp.get("target_countries") or [])}
    if len(region_ids) < 11:
        report.warnings.append(f"区域覆盖 {len(region_ids)}/11")
    if len(countries) < 30:
        report.warnings.append(f"目标国家/地区 {len(countries)} < 30")
    china_angle = [opp for opp in opportunities if "china-advantage" in (opp.get("tags") or [])]
    if len(china_angle) < 12:
        report.warnings.append(f"中国供应链/中文市场角度 {len(china_angle)} < 12")
    _ = taxonomy


# ---------------------------------------------------------------- 入口
def run_validation() -> Report:
    ctx = _load_all()
    report = Report()
    report.check("V01", "枚举引用完整性", lambda: _v01(ctx))
    report.check("V02", "机会数量与行业/区域覆盖", lambda: _v02(ctx))
    report.check("V03", "证据链与 evidence_count", lambda: _v03(ctx))
    report.check("V04", "七问齐全且无占位符", lambda: _v04(ctx))
    report.check("V05", "10 维评分与公式一致", lambda: _v05(ctx))
    report.check("V06", "窗口字段合法", lambda: _v06(ctx))
    report.check("V07", "日期链自洽", lambda: _v07(ctx))
    report.check("V08", "榜单配额与 rank 连续性", lambda: _v08(ctx))
    report.check("V09", "榜单与重算一致", lambda: _v09(ctx))
    report.check("V10", "数据源矩阵完整", lambda: _v10(ctx))
    report.check("V11", "扫描剧本完整", lambda: _v11(ctx))
    report.check("V12", "商业日历完整", lambda: _v12(ctx))
    report.check("V13", "无禁用词", lambda: _v13(ctx))
    report.check("V14", "stats.json 与实际聚合一致", lambda: _v14(ctx))
    report.check("V15", "id / slug 唯一", lambda: _v15(ctx))
    report.check("V16", "必填字段完整性与窗口映射", lambda: _v16(ctx))
    report.check("V17", "证据日期/tier/URL 合法", lambda: _v17(ctx))
    report.check("V18", "榜单 change/delta 语义", lambda: _v18(ctx))
    report.check("V19", "历史快照与 rankings 一致", lambda: _v19(ctx))
    report.check("V20", "source-health 字段合法（可选）", lambda: _v20(ctx))
    _advisories(ctx, report)
    return report


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    as_json = "--json" in argv
    report = run_validation()
    if as_json:
        print(json.dumps(
            {
                "ok": not report.failures,
                "results": report.rows,
                "warnings": report.warnings,
            },
            ensure_ascii=False,
            indent=2,
        ))
    else:
        print("=" * 78)
        print("机会雷达 · 数据契约校验（docs/12 V01–V15）")
        print("=" * 78)
        for row in report.rows:
            status = "PASS" if row["ok"] else "FAIL"
            print(f"[{status}] {row['rule']}  {row['name']}  |  {row['detail']}")
        if report.warnings:
            print("-" * 78)
            print(f"附加提示（{len(report.warnings)} 条，不影响退出码）：")
            for warning in report.warnings[:30]:
                print(f"  · {warning}")
        print("-" * 78)
        passed = sum(1 for row in report.rows if row["ok"])
        print(f"结果：{passed}/{len(report.rows)} 条规则通过，{len(report.failures)} 条失败")
        print("=" * 78)
    return 0 if not report.failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
