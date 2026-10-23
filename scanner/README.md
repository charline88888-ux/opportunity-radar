# scanner/ —— 机会雷达扫描流水线（Python 3.11，纯标准库，data-v0.8.0）

> 唯一数据标准：`docs/12-数据契约与字段字典.md`（data-v0.8.0）。扫描器是 `data/rankings.json`、`data/stats.json`、`data/history/*.json`、`data/source-health.json` 与 `scanner/outbox/` 的**唯一生成者**；按契约 4.5/5.x 重算派生字段、按 §9 做 V01–V20 校验；`scanner/serve.py` 提供本地控制台（v0.7.0）。

## 1. 快速开始

```powershell
# 历史回放（v0.3.0）：生成基准日前 2 天（10-20/10-21）的确定性回放，并重算当前榜单为真实 history delta
python scanner/pipeline.py --replay-as-of 2026-10-22 --replay-days 2

# 一键（离线）：采集 → 归一 → 去重 → 评分 → 排榜(+历史快照) → 统计 → SQLite → 校验
python scanner/pipeline.py --all               # 退出码 0 = 20/20 通过；幂等

# 真实每日运行（v0.6.1）：所有日期派生按 --as-of（窗口/快照/meta/报告）
python scanner/pipeline.py --all --as-of 2026-10-23   # day 归零是正确结果（当天无新信号）
python scanner/report.py --period day --as-of 2026-10-23

# 只校验（V01–V20，任一失败退出码 1）
python scanner/validate.py

# 真实在线采集（唯一联网命令；写 outbox + data/source-health.json v2）
python scanner/pipeline.py --fetch
python scanner/pipeline.py --fetch --no-cache --fetch-limit 10
python scanner/pipeline.py --fetch --as-of 2026-10-23   # v0.7.3：按该日写 signals-2026-10-23.json（默认仍用 taxonomy as_of）

# 四窗口报告（自包含 HTML + Markdown，确定性生成）
python scanner/report.py --all
python scanner/report.py --period day --period year

# SQLite 派生库（gitignore，可随时重建）
python scanner/db.py --rebuild
python scanner/db.py --info

# AI 富化 outbox（v0.5.1：offline 默认 / mock 本地模拟 / online 真实 LLM；产物仅供人工复核，永不自动入库）
python scanner/enrich.py
python scanner/enrich.py --provider mock --limit 5       # 本地模拟在线响应（不联网，用于测试/演示）
python scanner/enrich.py --provider online --limit 5     # 需 LLM_API_KEY（OpenAI 兼容）
python scanner/enrich.py --dry-run                        # 只打印摘要，不写文件

# 实验校准报告（v0.4.0）：读前端 /calibration 导出的实验 JSON
python scanner/calibrate.py --experiments scanner/fixtures/experiments-sample.json --sample

# 年度年鉴（v0.5.0）：年榜/月度时间线/分布/A 级清单/窗口收尾/实验摘要/3 条方向建议
python scanner/yearbook.py --year 2026
python scanner/yearbook.py --year 2026 --experiments scanner/fixtures/experiments-sample.json --sample

# 本地控制台后端（v0.7.0）：网页一键更新/采集/构建/定时任务；仅 127.0.0.1
python scanner/serve.py                      # http://127.0.0.1:8787，token 写 .radar-console-token
python scanner/serve.py --port 8788 --open   # 自定义端口并自动打开 #/control?token=...

# 单元测试（标准库 unittest，101 条）
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
| `config.py` | 路径、数据版本（0.8.0）、as_of、窗口配额、采集参数（v0.8.0：默认 60 源、账本/相关性常量）、枚举、禁词 | §1/§3/§9 |
| `common.py` | JSON 读写、日期/ISO 周/窗口 key、`round1`（ROUND_HALF_UP）、文本工具 | §2 |
| `history.py` | 快照写读、上一期查找、回放生成（`build_replay_snapshot`）、快照结构校验；v0.3 回放 `reconstructed=true`/`replay_as_of` | §1.2/§5.1 |
| `score.py` | 10 维加权 `total`、`grade`、`rank_score`，Decimal 精确计算 | §4.5 |
| `materialize.py` | 机会对象物化：`evidence_count`、日期链、momentum clip、评分回写；缺维度抛错 | §4.1/§4.5 |
| `rank.py` | 窗口、排序链、真实 delta（day 用上一日快照；week/month/year 同 key；两期都有才计算，新增 null/new；无历史回退 adjacent-window） | §5.1 |
| `stats.py` | KPI、分组分布、评分直方图、14 天趋势、开放窗口价值 | §5.2 |
| `db.py` | `data/radar.db`（opportunities/evidence/rankings_history/source_health），原子重建 | §1.1 |
| `fetch.py` | 真实采集：RSS/Atom/JSON feed、enabled/priority 源选择、限速/缓存/UA/重试、账本去重、相关性初筛、outbox、source-health v2 | §1.2/§6/§1.12 |
| `ledger.py` | 持久信号账本（SQLite `scanner/build/signal-ledger.sqlite`）：canonical_url/title_hash/content_hash、first_seen/last_seen/seen_count；跨批去重 | §1.12 |
| `relevance.py` | 信号相关性初筛：relevance_score 0-100、industry/gap/region ids、tier（business/maybe/off-topic）、reasons；仅线索、不自动入库 | §1.12 |
| `report.py` | 四窗口报告（自包含 HTML + Markdown），`generated_at` 确定性 | §1.1 |
| `enrich.py` | AI 富化 outbox：`--provider offline/mock/online`（mock 本地模拟走同一请求/解析流程，不联网）；输出 `enriched-<date>.json` + `REVIEW.md`；token/成本估算、`--limit`、超时重试、缓存标注；`needs_human=true`、永不自动入库、key 不落盘、`--dry-run` | §1.3/§1.5 |
| `calibrate.py` | 实验校准报告：Brier（docs/04 §12.9.5）、等级×成功率、花费/耗时、建议；输出 `data/reports/calibration-<date>.{html,md}` | §1.3 |
| `yearbook.py` | 年度年鉴：Top20/月度时间线/月度等级分布/信息差热度/窗口衰减统计/分布/A 级清单/窗口收尾/评分分布/可选实验漏斗+摘要/规则化 3 条方向建议；输出 `data/reports/yearbook-<year>.{html,md}`，`generated_at` 确定性 | §1.4/§1.6 |
| `validate.py` | V01–V20；**v0.8.0 V10** 校验源注册表字段（enabled/priority/kind/lang/limits）且 enabled 自动源 ≥20；**v0.6.0 配额收紧**：V02（≥80 条/14 行业各≥2/11 区域/≥50 国家/中国角度≥25）、V08（完整配额只在基准日强制，其他 as_of 仅结构校验，v0.6.1）；V19 快照、V20 source-health v2 | §9 |
| `serve.py` | **v0.7.0 本地控制台后端**：仅 127.0.0.1、token 认证、静态服务（current→app/dist→releases）+ token 注入 index、`/api/health|status|run|job|logs|log|schedule`、单任务 409、路径穿越防护、`scanner/logs/console.log` | §1.8 |
| `adapters/` | `rss` / `reddit` / `google_trends` / `ecommerce_reviews` 离线适配器 | §1/§6 |
| `tests/test_scanner.py` | 73 条单测：公式/舍入/边界/窗口/榜单/tie-breaker/物化/validate/归一/去重/history delta/回退/回放链与幂等/source-health/报告/SQLite/feed 解析/红源筛选/enrich/calibrate/yearbook/as-of/fetch --as-of/ledger/relevance/fetch-ledger 集成 | docs/04 §10.4 |
| `tests/test_serve.py` | 28 条单测：health（含 Origin）/401/403/status（含 outbox 摘要）/静态与 SPA 回退/token 注入/无构建 503/run 409/job/logs 与路径穿越/schedule 校验与 disable 幂等/schtasks CSV 中英文解析/enable 后状态同步/locale 解码/fetch 命令 as-of/outbox 端点/token 不落日志 | §1.8 |

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

- `validate.py` 实现 V01–V20：**v0.6.0 配额收紧**——V02（机会 ≥80、14 行业各 ≥2、11 区域全覆盖、目标国家/地区 ≥50、中国供应链/中文市场角度 ≥25）、V08（day ≥10 / week ≥20 / month ≥30 / year ≥80）；**V19**（所有历史快照结构合法、`snapshot_at` 日期对齐、回放必须有 `replay_as_of`、最新快照=当日真实快照且与 rankings 一致）；**V20**（source-health：`mode` 枚举、`cached=true → mode=cache 且 latency=0`、`http_status` int/null、`ok=false` 必须有非空 `error`、`meta.mode` 合法）。
- 任一失败 → 退出码 1；附加提示（标题长度、verified 复查提醒）不影响退出码。
- 评分容差 ±0.05；`total/rank_score` 用 Decimal `ROUND_HALF_UP`。

## 7. AI 富化与实验校准（v0.4.0）

### 7.1 `enrich.py` —— AI 富化 outbox（人工复核门禁）

- 输入 `scanner/outbox/signals-<date>.json`（`--fetch` 产物）→ 输出 `scanner/outbox/enriched-<date>.json` + `scanner/outbox/REVIEW.md`（outbox 已 gitignore）。
- **provider 三态**（v0.5.1）：
  - `offline`（默认）：关键词/taxonomy 候选映射、七问骨架草稿、启发式语言检测、证据 URL 透传；`meta.generator="offline-template"`；
  - `mock`：本地模拟 OpenAI 兼容响应（**不联网**），走同一请求构造/响应解析/回退流程；`meta.generator="mock-llm"`、`meta.model="mock-model"`；
  - `online`：`LLM_API_KEY` → 真实 `/chat/completions`（60s 超时、`config.LLM_MAX_RETRIES` 次指数退避重试、24h 缓存）；失败自动回退 offline 并在 `meta.error` 记录。
- **用量与缓存**：`meta.usage{input_tokens, output_tokens, estimated_cost_usd, calls, cache_hits, prices}`（价格常量 `config.LLM_PRICE_*`，示例值、非真实账单；缓存命中不重复计费）；`--limit N` 限制处理条数；候选内 `_llm` 记录 provider/model/latency/tokens/cost/cached。**缓存语义**：24h 内二次运行命中缓存 → `cache_hits>0` 且 `input_tokens/output_tokens=0`、`calls=0`，`_llm.cached=true`、`_mode` 含 `cache`。
- **安全红线**：key 只从环境变量读取、绝不写文件/日志；`--dry-run` 不写任何文件；所有候选 `needs_human:true`；**永不自动写 `data/opportunities.json`**（单测断言内容不变）；无 key 时 `provider=online` 返回清晰错误（exit 2，不崩溃）。
- 测试：v0.5.1 用 Python 标准库本地 HTTP server（OpenAI 兼容 `/chat/completions`）验证请求头/体、解析、token、失败回退与缓存，不依赖外网/key。
- schema（docs/12 §1.3）：`{meta:{generator, model, generated_at, dry_run, provider, usage, ...}, candidates:[{source_id,url,title,lang,signal_type,gap_type_ids,human_need_ids,seven_questions_draft,notes,needs_human:true,...}]}`。

### 7.2 `calibrate.py` —— 实验校准报告

- `python scanner/calibrate.py --experiments <export.json> [--sample] [--date] [--out-dir]`，读前端 `/calibration` 导出 JSON（schema_version 0.4.0）。
- 与 `opportunities.json` 按 `opp_id` join 评分；生成 `data/reports/calibration-<date>.{html,md}`（自包含 HTML）。
- **Brier**：`p = clamp(total/100, 0.01, 0.99)`；`o = positive→1 / negative→0`；`inconclusive`/未匹配/无评分排除；`Brier = mean((p−o)²)`；基线 0.25；样本 <3 显示「样本不足」。
- 报告含样本数/结果分布/等级×成功率/花费/耗时/建议/免责；`--sample` 在报告顶部标注「样例数据（sample）」。

## 8. 年度年鉴（v0.5.0，v0.6.0 指标细化）

- `python scanner/yearbook.py --year 2026 [--experiments <export.json>] [--sample] [--out-dir]` → `data/reports/yearbook-<year>.html/.md`（HTML 自包含可打印）。
- 内容：年榜 Top20（等级/行业/区域/窗口）、月度时间线（按 `activity_dates` 聚合，无活动月份显示 0，含行业/信息差 Top2 主题）、**v0.6.0 新增：月度等级分布（S/A/B/C/D）、信息差热度（每月 Top3）、窗口衰减统计（status/decay/months_left 分桶）、实验漏斗（总样本→已决→成功率）**、行业/区域/信息差/等级/窗口状态分布、A 级清单（≥75）、窗口收尾或 ≤3 个月机会、评分分布（CSS 条形）、可选实验摘要（复用 `calibrate.py` 的 `load_export/build_records/compute_brier/spend_hours`）、规则化「年度 3 个方向建议」（标注「规则生成，非投资建议」）、免责。
- `generated_at` 固定为 `as_of + T00:00:00+08:00`，双跑字节一致（幂等）；无实验/有实验/空年份/非法实验 JSON/指标一致性均有单测覆盖。2026 年鉴关键统计：80 条机会 / Top20 20 / A 级 12 / 收尾 3 / Brier 0.2338（样例实验，sample 标注）；窗口衰减 open 63 / peak 14 / closing 3。

## 9. 本地控制台后端（v0.7.0，`serve.py`）

> 用户要的「网页一键更新」：本地起一个只监听 127.0.0.1 的小服务，控制台页面通过 token 调本地任务。

- 启动：`python scanner/serve.py`（默认 `127.0.0.1:8787`；`--port 8788`、`--open`、`--token-file` 可选）。
  - 启动生成随机 token（`secrets.token_urlsafe`），**绑定成功后再写**仓库根 `.radar-console-token`（建议加入 `.gitignore`，本目录不保存 token）；`--open` 打开 `#/control?token=...`。
  - 只允许 loopback 绑定；拒绝非 127.0.0.1/localhost 的 Origin（403）；不打印 token。
- 静态服务：`/` 与非 `/api/*` 路径依次取 `current/index.html` → `app/dist/index.html` → 最新 `releases/*/dist/index.html`；无构建返回 503 + 引导文案。返回 `index.html` 时**在 `</head>` 前注入 `<script>window.__RADAR_CONSOLE_TOKEN__="…"</script>`**（仅内存响应、不写日志），因此自启动后直接访问 `http://127.0.0.1:8787/` 也能用控制台；前端优先读该变量，其次 URL token。
- API（除 `/api/health` 外都要 header `X-Radar-Token`；`/api/health` 免 token，但**同样校验 Origin**）：
  - `GET /api/health` → `{ok,version,port}`；`GET /api/status` → 数据基准日/机会数/四窗口/build/冻结版/定时任务/**采集 outbox 摘要**/告警/最近任务/日志列表；
  - `GET /api/outbox?limit=N`（v0.7.3）→ `{ok,outbox,<采集摘要>,signals:[最近 N 条安全字段]}`，供控制台显示「最近采集 X 条原始信号（待复核）」；
  - `POST /api/run {task:update|fetch|build}` → 后台线程执行（update=`scripts/daily-run.ps1`、fetch=`pipeline.py --fetch --as-of <当前数据基准日>`、build=`pnpm build`+复制 `current/index.html`）；忙时 **409**，返回 `{ok,job_id}`；
  - `GET /api/job?id=` → `{state,started_at,finished_at,exit_code,log_tail≤200}`；`GET /api/logs`、`GET /api/log?name=`（限 `scanner/logs/`，防穿越，tail ≤200KB）；
  - `POST /api/schedule {action:enable|disable, fetch?}` → 调 `scripts/install-daily-task.ps1 [-Fetch|-Uninstall]`，**动作后 sleep 重查 `schtasks /Query /V /FO CSV /NH` 并携带最新状态**（`enabled/status:"ready"|"disabled"|"not_installed"/next_run/last_result`；中英文系统通用）；**disable 幂等**（任务未安装/找不到时按已停用成功返回 `already:true`，不返回 500）；子进程输出按本地编码（mbcs/GBK，UTF-8 优先）解码，中文不乱码。
- 安全：路径白名单/防目录遍历、不返回绝对路径、token 不落日志；每次 API 调用写 `scanner/logs/console.log`。
- 测试：`python -m unittest scanner.tests.test_serve -v`（28 条：401/403/health（含 Origin）/status（含 outbox 摘要）/静态回退/token 注入/无构建 503/run 409/job/日志穿越/schedule 校验与幂等/schtasks CSV 中英文/enable 后状态同步/locale 解码/fetch 命令 as-of/outbox 端点/不落 token）。

## 10. v0.8.0 采集增强（源注册表 / 持久去重 / 相关性初筛）

- **源注册表**：`data/sources.json` 增加 `access/regions/lang/enabled/priority/limits/kind`；`fetch.select_sources` 只取 `enabled != false`、合规绿/黄、`access ∈ {rss,json}`，按 priority/value_score 排序；默认 `--fetch-limit 60`。不可用源 `enabled=false` 并在 notes 记录实测原因。
- **持久账本**：`scanner/build/signal-ledger.sqlite`（gitignore）表 `signals(fingerprint UNIQUE, canonical_url, title_hash, content_hash, first_seen, last_seen, seen_count, source_id)`；`ledger.SignalLedger.classify()` 标注 `is_new/first_seen/last_seen/seen_count` 并返回 `new_count/seen_count/ledger_total`。
- **相关性初筛**：`relevance.assess()` 基于 taxonomy hints + 商业词 + 排除词（招聘/广告/纯论文）+ 来源类别权重，输出 `relevance_score/industry_ids/gap_type_ids/region_ids/tier/reasons`；`relevance.analyze()` 汇总 `relevant_count/tiers/top_relevant` 写入 outbox meta 与 `/api/outbox`。
- 实测（2026-10-23）：首跑 57/57 源成功、1448 原始 → 1015 信号、new 983；二跑 new 68/seen 947；三跑 **new 0/seen 1015**（账本累计 1051）；tiers business 184 / maybe 712 / off-topic 119。仅线索排序，不改机会库。

## 11. 已知限制

1. 回放快照是「按当日窗口规则重排现有机会」的演示口径，非真实历史存档；UI 需用 `reconstructed=true` 明示。
2. `--all` 不联网；`--fetch` 当前只覆盖 RSS/JSON feed，公开 API 未接线。
3. 真实网络下部分源会超时/返回非 feed（2026-10-22 实测 3/8 失败），已如实记录在 source-health，可重跑 `--fetch` 刷新。
4. 当前仓库只有 10-20/10-21 两份回放 + 10-22 一份真实快照；真实每日运行会在次日自动使用真实上期快照。
5. 宗教节日/外部平台规则随时变化，采集与报告仅作研究辅助。
