# scanner/ —— 机会雷达扫描流水线（Python 3.11，纯标准库）

> 唯一数据标准：`docs/12-数据契约与字段字典.md`（data-v0.2.0）。扫描器是 `data/rankings.json`、`data/stats.json`、`data/history/*.json` 与 `data/source-health.json` 的**唯一生成者**，按契约 4.5/5.x 重算派生字段、按 §9 做 V01–V20 校验。

## 1. 快速开始

```powershell
# 一键（离线）：采集 → 归一 → 去重 → 评分 → 排榜(+历史快照) → 统计 → SQLite → 校验
python scanner/pipeline.py --all               # 退出码 0 = 20/20 通过；幂等

# 只校验（V01–V20，任一失败退出码 1）
python scanner/validate.py

# 真实在线采集（唯一联网命令；写 outbox + data/source-health.json）
python scanner/pipeline.py --fetch
python scanner/pipeline.py --fetch --no-cache --fetch-limit 10

# 四窗口报告（自包含 HTML + Markdown）
python scanner/report.py --all
python scanner/report.py --period day --period year

# SQLite 派生库（gitignore，可随时重建）
python scanner/db.py --rebuild
python scanner/db.py --info

# 单元测试（标准库 unittest，28 条）
python -m unittest discover -s scanner/tests -v
```

`--all` 幂等：重复执行不改变 `opportunities.json / rankings.json / history/*.json / stats.json / radar.db` 的字节内容（已用 SHA256 验证）。`--fix` 仅为早期兼容别名，评分回写现在总是自动执行。

## 2. 数据流

```
scanner/fixtures/raw_signals.json          ← 离线样例（RSS / Reddit / Google Trends / 电商评论）
        │  adapters/*.py（离线 fixtures；接真实网络见 §5）
        ▼
scanner/build/raw_signals_collected.json   ← 原始记录 + 适配器健康度 + 条数
        │  normalize.py（统一信号对象、行业/信息差/地区/情绪 hint、痛点短语、趋势方向）
        ▼
scanner/build/normalized_signals.json
        │  dedupe.py（canonical URL + 标题归一 + 同域近似；同一 URL 不同标题不误并）
        ▼
scanner/build/signals_deduped.json + dedupe_report.json

data/opportunities.json  ── score.py/materialize.py 重算 → 回写派生字段
        │  rank.py（窗口归属 + 排序链 + history/adjacent delta）
        ├──▶ data/rankings.json
        ├──▶ data/history/rankings-<as_of>.json（同日覆盖，内容确定）
        ├──▶ data/stats.json
        ├──▶ data/radar.db（db.py 全量重建）
        └──▶ data/reports/report-<period>-<date>.{html,md}（report.py，按需）
        │  validate.py（V01–V20）
        ▼
退出码 0 / 1

--fetch（独立联网阶段）：sources.json 绿/黄 RSS 源
        → fetch.py（限速/缓存/UA/超时/重试）
        → scanner/outbox/signals-<date>.json（人工复核，不入机会库）
        → data/source-health.json
```

`scanner/build/`、`scanner/outbox/` 为中间产物（各自带 `.gitignore`，不入库）；`data/radar.db` 由 `data/.gitignore` 忽略。

## 3. 模块职责

| 文件 | 职责 | 契约依据 |
|---|---|---|
| `pipeline.py` | CLI 入口：串联各阶段；`--all` 含历史快照 + SQLite + 校验；`--fetch/--report/--db-rebuild` 独立命令 | §5.2 |
| `config.py` | 路径、数据版本（0.2.0）、as_of、窗口配额、采集参数、固定枚举数量、禁词 | §1/§3/§9 |
| `common.py` | JSON 读写、日期/ISO 周/窗口 key、`round1`（ROUND_HALF_UP）、文本工具 | §2 |
| `history.py` | 历史快照写读、上一期查找、快照结构校验（V19 辅助） | §5.1 |
| `score.py` | 10 维加权 `total`、`grade`、`rank_score`，Decimal 精确计算 | §4.5 |
| `materialize.py` | 机会对象物化：`evidence_count`、日期链、momentum clip、评分回写；缺维度抛错 | §4.1/§4.5 |
| `rank.py` | 日/周/月/年窗口、排序链、history/adjacent-window 两套 delta、`meta.delta_basis` | §5.1 |
| `stats.py` | KPI、by_industry/gap/region/need、评分直方图、14 天趋势、开放窗口价值 | §5.2 |
| `db.py` | `data/radar.db`（opportunities/evidence/rankings_history/source_health），原子重建 | §1.1 |
| `fetch.py` | 真实在线采集：RSS/Atom/JSON feed 解析、限速/缓存/UA/重试、outbox、source-health | §1.1/§6 |
| `report.py` | 四窗口报告（自包含 HTML + Markdown），含七问摘要/证据链接/免责 | §1.1 |
| `validate.py` | V01–V20 校验；附加提示（标题长度等）不影响退出码 | §9 |
| `adapters/` | `rss` / `reddit` / `google_trends` / `ecommerce_reviews` 离线适配器 | §1/§6 |
| `tests/test_scanner.py` | 28 条单测：公式/舍入/等级边界/动量 clip/ISO 周/窗口/榜单/tie-breaker/物化抛错/validate 失败路径/归一/去重/history delta/回退/报告/SQLite/RSS-Atom-JSON 解析/红源筛选 | docs/04 §10.4 |

## 4. 历史快照与 delta 机制（v0.2.0）

1. `--all` 先 `history.find_previous_snapshot(as_of)`：只取**严格早于** as_of 的最近一份 `data/history/rankings-<date>.json`。
2. 传给 `rank.build_rankings(..., previous_snapshot=...)`：有快照 → 按「上一快照同窗口名次」算 `delta/change`，`meta.delta_basis="history"`、`meta.history_as_of=<date>`；该窗口上期为空则回退 adjacent-window。
3. 无更早快照 → 整体回退 v0.1.0 相邻窗口口径，`meta.delta_basis="adjacent-window"`、`meta.history_as_of=null`。
4. 写 `data/rankings.json` 后再写当天快照（`meta.snapshot_at` 为确定性逻辑时间，`meta.reconstructed=false`），同日覆盖 → 重复运行字节一致。
5. 单测 `TestHistoryDelta` 用临时目录构造上一期快照覆盖 history 路径、回退路径与「同日快照不作自身参照」。

## 5. 如何接真实数据源

- **离线 fixtures（默认可跑）**：`adapters/` 四个适配器 + `fixtures/raw_signals.json`，`--all` 不联网。
- **RSS/JSON feed（已实装）**：`fetch.py` 从 `sources.json` 选 `access="rss"` 且合规绿/黄的源；新增源只需在 `sources.json` 登记真实 feed URL（RSS 2.0 / Atom / Apple JSON feed 三种解析已支持）。`--fetch` 实测 7/8 源成功（reddit、itunes-reviews、hnrss、app-store-rss、arxiv-rss、techcrunch-rss、producthunt-feed）。
- **公开 API（需单独接线）**：目前 `access="api"` 的源不自动采集（sources.json 中 URL 多为文档页/需鉴权）；接入方式为新增 `adapters/xxx.py` 或在 `fetch.py` 增加 JSON API 分支，并遵守其 ToS 与限速。
- **新适配器步骤**：实现 `Adapter` 子类（`name/source_id/category/access` + `fetch()/parse()`），在 `adapters/__init__.py` 的 `ADAPTERS`/`FIXTURE_SECTIONS` 登记；`normalize.py` 关键词可按需补充。
- **合规红线**：每域 ≤1 req/s、缓存 24h（fetch 默认 6h）、只取公开字段、不绕过登录/付费墙/验证码、不采集个人画像；红区源只人工浏览。

## 6. 校验规则与退出码

- `validate.py` 实现 V01–V20（V19 历史快照一致性、V20 source-health 合法性为 v0.2.0 新增）；任一失败 → 退出码 1；附加提示不影响退出码。
- 评分容差 ±0.05；`total/rank_score` 用 Decimal `ROUND_HALF_UP`，数据已避开 `.x5` 歧义边界，前端 JS 严格自检 0 差异。
- V09 会用与 pipeline 相同的上一期快照重算榜单，避免 history/adjacent 口径不一致。

## 7. 已知限制

1. 默认离线：`--all` 不联网；真实采集仅 `--fetch` 显式触发，且当前只覆盖 RSS/JSON feed 类源。
2. 公开 API 源（YouTube/SEC/openFDA 等）尚未接线；其中 openFDA 在部分网络环境有证书链问题，已如实记录为失败。
3. 当前仓库只有 2026-10-22 一份历史快照 → 真实数据为 adjacent-window；history 口径由单测覆盖，次日运行自动生效。
4. 报告 `generated_at` 随生成时间变化（内容为派生视图，不影响数据指纹）。
5. 宗教节日/外部平台规则随时变化，采集与报告仅作研究辅助。
