# scanner/ —— 机会雷达扫描流水线（Python 3.11，纯标准库，data-v0.3.0）

> 唯一数据标准：`docs/12-数据契约与字段字典.md`（data-v0.3.0）。扫描器是 `data/rankings.json`、`data/stats.json`、`data/history/*.json`、`data/source-health.json` 与 `scanner/outbox/` 的**唯一生成者**；按契约 4.5/5.x 重算派生字段、按 §9 做 V01–V20 校验。

## 1. 快速开始

```powershell
# 历史回放（v0.3.0）：生成基准日前 2 天（10-20/10-21）的确定性回放，并重算当前榜单为真实 history delta
python scanner/pipeline.py --replay-as-of 2026-10-22 --replay-days 2

# 一键（离线）：采集 → 归一 → 去重 → 评分 → 排榜(+历史快照) → 统计 → SQLite → 校验
python scanner/pipeline.py --all               # 退出码 0 = 20/20 通过；幂等

# 只校验（V01–V20，任一失败退出码 1）
python scanner/validate.py

# 真实在线采集（唯一联网命令；写 outbox + data/source-health.json v2）
python scanner/pipeline.py --fetch
python scanner/pipeline.py --fetch --no-cache --fetch-limit 10

# 四窗口报告（自包含 HTML + Markdown，确定性生成）
python scanner/report.py --all
python scanner/report.py --period day --period year

# SQLite 派生库（gitignore，可随时重建）
python scanner/db.py --rebuild
python scanner/db.py --info

# AI 富化 outbox（v0.4.0）：默认 offline-template，产物仅供人工复核，永不自动入库
python scanner/enrich.py
python scanner/enrich.py --online --limit 5            # 需 LLM_API_KEY（OpenAI 兼容）
python scanner/enrich.py --dry-run                      # 只打印摘要，不写文件

# 实验校准报告（v0.4.0）：读前端 /calibration 导出的实验 JSON
python scanner/calibrate.py --experiments scanner/fixtures/experiments-sample.json --sample

# 年度年鉴（v0.5.0）：年榜/月度时间线/分布/A 级清单/窗口收尾/实验摘要/3 条方向建议
python scanner/yearbook.py --year 2026
python scanner/yearbook.py --year 2026 --experiments scanner/fixtures/experiments-sample.json --sample

# 单元测试（标准库 unittest，50 条）
python -m unittest discover -s scanner/tests -v
```

`--all` 幂等：重复执行不改变 `opportunities.json / rankings.json / history/*.json / stats.json / radar.db / reports/*` 的字节内容（已用 SHA256 验证）。`--fix` 仅为早期兼容别名。

## 2. 数据流

```
scanner/fixtures/raw_signals.json          ← 离线样例（RSS / Reddit / Google Trends / 电商评论）
        │  adapters/*.py（离线 fixtures；真实 RSS 采集见 fetch.py）
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
        ├──▶ data/rankings.json（meta.delta_basis / history_as_of）
        ├──▶ data/history/rankings-<as_of>.json（真实快照，reconstructed=false）
        ├──▶ data/stats.json
        ├──▶ data/radar.db（db.py 全量重建）
        └──▶ data/reports/report-<period>-<date>.{html,md}（report.py，按需）
        │  validate.py（V01–V20）
        ▼
退出码 0 / 1

--replay-as-of/--replay-days：history.build_replay_snapshot()
        → data/history/rankings-<date>.json（reconstructed=true, replay_as_of, 确定性）
        → 之后自动重跑当前榜单（→ delta_basis=history）

--fetch（独立联网阶段）：sources.json 绿/黄 RSS 源
        → fetch.py（限速/缓存/UA/超时/重试；RSS/Atom/JSON feed 解析）
        → scanner/outbox/signals-<date>.json（人工复核，不入机会库）
        → data/source-health.json（v2：mode/http_status/latency_ms/cached/items/error）
```

`scanner/build/`、`scanner/outbox/` 为中间产物（各自带 `.gitignore`）；`data/radar.db` 由 `data/.gitignore` 忽略。

## 3. 模块职责

| 文件 | 职责 | 契约依据 |
|---|---|---|
| `pipeline.py` | CLI：`--all` 离线全链路、`--replay-as-of/--replay-days` 历史回放、`--fetch`、`--report`、`--db-rebuild` | §5.2 / §1.2 |
| `config.py` | 路径、数据版本（0.4.0）、as_of、窗口配额、采集参数、source-health 枚举、固定枚举数量、禁词 | §1/§3/§9 |
| `common.py` | JSON 读写、日期/ISO 周/窗口 key、`round1`（ROUND_HALF_UP）、文本工具 | §2 |
| `history.py` | 快照写读、上一期查找、回放生成（`build_replay_snapshot`）、快照结构校验；v0.3 回放 `reconstructed=true`/`replay_as_of` | §1.2/§5.1 |
| `score.py` | 10 维加权 `total`、`grade`、`rank_score`，Decimal 精确计算 | §4.5 |
| `materialize.py` | 机会对象物化：`evidence_count`、日期链、momentum clip、评分回写；缺维度抛错 | §4.1/§4.5 |
| `rank.py` | 窗口、排序链、真实 delta（day 用上一日快照；week/month/year 同 key；两期都有才计算，新增 null/new；无历史回退 adjacent-window） | §5.1 |
| `stats.py` | KPI、分组分布、评分直方图、14 天趋势、开放窗口价值 | §5.2 |
| `db.py` | `data/radar.db`（opportunities/evidence/rankings_history/source_health），原子重建 | §1.1 |
| `fetch.py` | 真实采集：RSS/Atom/JSON feed、限速/缓存/UA/重试、outbox、source-health v2 | §1.2/§6 |
| `report.py` | 四窗口报告（自包含 HTML + Markdown），`generated_at` 确定性 | §1.1 |
| `enrich.py` | AI 富化 outbox：offline-template / 可选 LLM（OpenAI 兼容）；输出 `enriched-<date>.json` + `REVIEW.md`；`needs_human=true`、永不自动入库、key 不落盘、`--dry-run` | §1.3 |
| `calibrate.py` | 实验校准报告：Brier（docs/04 §12.9.5）、等级×成功率、花费/耗时、建议；输出 `data/reports/calibration-<date>.{html,md}` | §1.3 |
| `yearbook.py` | 年度年鉴：Top20/月度时间线/分布/A 级清单/窗口收尾/评分分布/可选实验摘要/规则化 3 条方向建议；输出 `data/reports/yearbook-<year>.{html,md}`，`generated_at` 确定性 | §1.4 |
| `validate.py` | V01–V20；V19 快照/回放规则、V20 source-health v2 收紧 | §9 |
| `adapters/` | `rss` / `reddit` / `google_trends` / `ecommerce_reviews` 离线适配器 | §1/§6 |
| `tests/test_scanner.py` | 45 条单测：公式/舍入/边界/窗口/榜单/tie-breaker/物化/validate/归一/去重/history delta/回退/回放链与幂等/source-health 合法-非法/报告/SQLite/feed 解析/红源筛选/enrich offline+dry-run+no-key/calibrate Brier+边界 | docs/04 §10.4 |

## 4. 历史快照、回放与真实 delta（v0.3.0）

1. `--all` 先 `history.find_previous_snapshot(as_of)`：取**严格早于** as_of 的最近一份快照（真实或回放）。
2. `rank.build_rankings(..., previous_snapshot=...)`：
   - 上一快照该窗口**非空** → 用「同窗口上期名次」计算 `delta = 上期名次 − 本期名次`；两期都出现才有 delta，新增 `null/new`（不再回退相邻窗口）；
   - 上一快照缺失或该窗口上期为空 → 回退 `adjacent-window`（day←week、week←month、month←year，year 无参照）；
   - 整文件 `meta.delta_basis = history | adjacent-window`、`meta.history_as_of`，每窗口 `windows[].delta_basis`。
3. `--replay-as-of 2026-10-22 --replay-days 2`：
   - 生成 2026-10-20、2026-10-21 两份回放（`meta.reconstructed=true`、`meta.replay_as_of`、`snapshot_at` 确定性、只纳入 `last_activity ≤ 回放日` 的机会）；
   - 按日期链式：10-20 adjacent-window（无上期）→ 10-21 history（上期 10-20）；
   - 随后自动重跑当前榜单：10-22 以 10-21 为上一期 → `delta_basis="history"`、`history_as_of="2026-10-21"`。
4. 同日重复生成字节一致（幂等）；回放仅用于 delta 演示/历史对照，UI 用 `reconstructed` 区分并明示「历史回放」。

## 5. 如何接真实数据源

- **离线 fixtures（默认可跑）**：`adapters/` 四个适配器 + `fixtures/raw_signals.json`，`--all` 不联网。
- **RSS/JSON feed（已实装）**：`fetch.py` 选 `sources.json` 中 `access="rss"` 且合规绿/黄的源；新增源只需登记真实 feed URL（RSS 2.0 / Atom / Apple JSON feed 已支持）。
- **公开 API（需单独接线）**：`access="api"` 的源不自动采集（多为文档页/需鉴权）；接入方式为新增 adapter 或在 `fetch.py` 增加 JSON API 分支，并遵守 ToS 与限速。
- **新适配器步骤**：实现 `Adapter` 子类（`name/source_id/category/access` + `fetch()/parse()`），在 `adapters/__init__.py` 登记；`normalize.py` 关键词按需补充。
- **合规红线**：每域 ≤1 req/s、缓存、只取公开字段、不绕过登录/付费墙/验证码；红区源只人工浏览。

## 6. 校验规则与退出码

- `validate.py` 实现 V01–V20：**V19**（所有历史快照结构合法、`snapshot_at` 日期对齐、回放必须有 `replay_as_of`、最新快照=当日真实快照且与 rankings 一致）；**V20**（source-health：`mode` 枚举、`cached=true → mode=cache 且 latency=0`、`http_status` int/null、`ok=false` 必须有非空 `error`、`meta.mode` 合法）。
- 任一失败 → 退出码 1；附加提示（标题长度、verified 复查提醒）不影响退出码。
- 评分容差 ±0.05；`total/rank_score` 用 Decimal `ROUND_HALF_UP`。

## 7. AI 富化与实验校准（v0.4.0）

### 7.1 `enrich.py` —— AI 富化 outbox（人工复核门禁）

- 输入 `scanner/outbox/signals-<date>.json`（`--fetch` 产物）→ 输出 `scanner/outbox/enriched-<date>.json` + `scanner/outbox/REVIEW.md`（outbox 已 gitignore）。
- 默认 **offline-template**：关键词/taxonomy 候选映射（行业/信息差/人性需求/情绪/神经递质）、七问骨架草稿（标注「待人工补充」）、启发式语言检测、证据 URL 透传；`meta.generator="offline-template"`。
- 可选 **在线模式**：`--online` 且 `LLM_API_KEY` 存在 → OpenAI 兼容 `/chat/completions`；`LLM_BASE_URL`/`LLM_MODEL` 可配；记录 model/latency/token 估算；有 24h 缓存（`scanner/build/enrich-cache/`）；失败自动回退 offline 并在 `meta.error` 记录。
- **安全红线**：key 只从环境变量读取、绝不写文件/日志；`--dry-run` 不写任何文件；所有候选 `needs_human:true`；**永不自动写 `data/opportunities.json`**（单测断言内容不变）；无 key 时 `--online` 返回清晰错误（exit 2，不崩溃）。
- schema（docs/12 §1.3）：`{meta:{generator, model, generated_at, dry_run, ...}, candidates:[{source_id,url,title,lang,signal_type,gap_type_ids,human_need_ids,seven_questions_draft,notes,needs_human:true,...}]}`。

### 7.2 `calibrate.py` —— 实验校准报告

- `python scanner/calibrate.py --experiments <export.json> [--sample] [--date] [--out-dir]`，读前端 `/calibration` 导出 JSON（schema_version 0.4.0）。
- 与 `opportunities.json` 按 `opp_id` join 评分；生成 `data/reports/calibration-<date>.{html,md}`（自包含 HTML）。
- **Brier**：`p = clamp(total/100, 0.01, 0.99)`；`o = positive→1 / negative→0`；`inconclusive`/未匹配/无评分排除；`Brier = mean((p−o)²)`；基线 0.25；样本 <3 显示「样本不足」。
- 报告含样本数/结果分布/等级×成功率/花费/耗时/建议/免责；`--sample` 在报告顶部标注「样例数据（sample）」。

## 8. 年度年鉴（v0.5.0）

- `python scanner/yearbook.py --year 2026 [--experiments <export.json>] [--sample] [--out-dir]` → `data/reports/yearbook-<year>.html/.md`（HTML 自包含可打印）。
- 内容：年榜 Top20（等级/行业/区域/窗口）、月度时间线（按 `activity_dates` 聚合，无活动月份显示 0，含行业/信息差 Top2 主题）、行业/区域/信息差/等级/窗口状态分布、A 级清单（≥75）、窗口收尾或 ≤3 个月机会、评分分布（CSS 条形）、可选实验摘要（复用 `calibrate.py` 的 `load_export/build_records/compute_brier/spend_hours`）、规则化「年度 3 个方向建议」（标注「规则生成，非投资建议」）、免责。
- `generated_at` 固定为 `as_of + T00:00:00+08:00`，双跑字节一致（幂等）；无实验/有实验/空年份/非法实验 JSON 均有单测覆盖。2026 年鉴关键统计：46 条机会 / Top20 20 / A 级 11 / 收尾 0；带样例实验摘要 Brier 0.2338（sample 标注）。

## 9. 已知限制

1. 回放快照是「按当日窗口规则重排现有机会」的演示口径，非真实历史存档；UI 需用 `reconstructed=true` 明示。
2. `--all` 不联网；`--fetch` 当前只覆盖 RSS/JSON feed，公开 API 未接线。
3. 真实网络下部分源会超时/返回非 feed（2026-10-22 实测 3/8 失败），已如实记录在 source-health，可重跑 `--fetch` 刷新。
4. 当前仓库只有 10-20/10-21 两份回放 + 10-22 一份真实快照；真实每日运行会在次日自动使用真实上期快照。
5. 宗教节日/外部平台规则随时变化，采集与报告仅作研究辅助。
