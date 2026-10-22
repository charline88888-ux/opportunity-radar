"""全局配置：路径、数据版本、基准日、榜单配额、评分维度顺序。

所有值都来自 docs/12-数据契约与字段字典.md（已冻结）。
如需变更必须升 data_version 并同步更新 data/CHANGELOG.md。
"""
from __future__ import annotations

from pathlib import Path

SCANNER_DIR = Path(__file__).resolve().parent
ROOT = SCANNER_DIR.parent
DATA_DIR = ROOT / "data"
FIXTURES_DIR = SCANNER_DIR / "fixtures"
BUILD_DIR = SCANNER_DIR / "build"
HISTORY_DIR = DATA_DIR / "history"
REPORTS_DIR = DATA_DIR / "reports"
OUTBOX_DIR = SCANNER_DIR / "outbox"
FETCH_CACHE_DIR = BUILD_DIR / "fetch-cache"

TAXONOMY_PATH = DATA_DIR / "taxonomy.json"
OPPORTUNITIES_PATH = DATA_DIR / "opportunities.json"
RANKINGS_PATH = DATA_DIR / "rankings.json"
STATS_PATH = DATA_DIR / "stats.json"
SOURCES_PATH = DATA_DIR / "sources.json"
PLAYBOOKS_PATH = DATA_DIR / "playbooks.json"
CALENDAR_PATH = DATA_DIR / "calendar.json"
SOURCE_HEALTH_PATH = DATA_DIR / "source-health.json"
DB_PATH = DATA_DIR / "radar.db"

DATA_VERSION = "0.2.0"
DEFAULT_AS_OF = "2026-10-22"
CURRENT_WEEK = "2026-W43"
CURRENT_MONTH = "2026-10"
CURRENT_YEAR = "2026"

# v0.2.0：历史快照 / delta / 采集 / 报告
DELTA_BASES = {"history", "adjacent-window"}
SNAPSHOT_TIME_SUFFIX = "T00:00:00+08:00"  # 快照逻辑时间（确定性，保证 --all 幂等）
FETCH_USER_AGENT = "OpportunityRadar/0.2 (local personal research tool; +https://example.local/radar)"
FETCH_TIMEOUT_SEC = 12
FETCH_MAX_RETRIES = 2
FETCH_MIN_INTERVAL_SEC = 1.0  # 同域限速（每域 ≤1 req/s）
FETCH_CACHE_TTL_SEC = 6 * 3600
FETCH_DEFAULT_LIMIT = 8
FETCH_MAX_ITEMS_PER_SOURCE = 30  # 单源单次最多保留的条数（评论流/长列表防爆）
FETCHABLE_ACCESS = {"rss"}  # v0.2.0 只自动采集 RSS/JSON feed；公开 API 端点需单独接线
FETCHABLE_COMPLIANCE = {"green", "yellow"}
SOURCE_HEALTH_STATUSES = {200, 301, 302, 304, 403, 404, 429, 500, 503}

# 榜单配额（契约 5.1）
WINDOW_QUOTAS = {"day": 6, "week": 12, "month": 20, "year": 40}

# 窗口展示标签模板
WINDOW_LABELS = {
    "day": "{month}年{day}日",
    "week": "{year}年第{week}周",
    "month": "{year}年{month}月",
    "year": "{year}年",
}

# 10 个评分维度（顺序固定，权重合计 1.00）
DIMENSION_ORDER = [
    "signal",
    "gap",
    "feasibility",
    "economics",
    "timing",
    "competition",
    "risk",
    "fit",
    "evidence",
    "leverage",
]

DISCLAIMER = "研究假设，非投资建议；示例数据用于演示，使用前请核验原始来源"

# 契约 V13 禁用词（不得出现在 data/*.json 与生成的榜单文案中）
BANNED_WORDS = ["稳赚", "保证收益", "躺赚", "内幕", "100% 成功", "100%成功"]

# 固定枚举数量（契约 3.x，taxonomy 不得增删 id）
TAXONOMY_COUNTS = {
    "industries": 14,
    "human_needs": 12,
    "neuro_drivers": 6,
    "emotions": 24,
    "gap_types": 12,
    "drivers": 7,
    "business_models": 12,
    "regions": 11,
    "score_dimensions": 10,
    "tags": 20,
    "grades": 5,
}

WINDOW_STATUSES = {"open", "peak", "closing", "closed"}
DECAY_LEVELS = {"slow", "medium", "fast"}
EFFORT_LEVELS = {"full", "side", "solo"}
TREND_DIRECTIONS = {"up", "flat", "down"}
EVIDENCE_TIERS = {"primary", "secondary", "marketing"}
ACCESS_MODES = {"api", "rss", "html", "manual", "paid-api"}
FREQUENCIES = {"realtime", "daily", "weekly", "monthly", "quarterly", "yearly", "manual"}
COSTS = {"free", "freemium", "paid"}
COMPLIANCE_LEVELS = {"green", "yellow", "red"}
CALENDAR_TYPES = {"religious", "festival", "tax", "school", "fiscal", "shopping", "national"}
SOURCE_CATEGORY_IDS = [
    "demand",
    "trend",
    "marketplace",
    "social",
    "policy",
    "capital",
    "academic",
    "supply",
    "culture",
    "talent",
    "data",
    "platform",
]
