# scanner/ —— 机会雷达扫描流水线（Python 3.11，纯标准库）

> 唯一数据标准：`docs/12-数据契约与字段字典.md`（已冻结）。扫描器是 `data/rankings.json`、`data/stats.json` 的**唯一生成者**，并按契约 4.5/5.x 重算派生字段、按 §9 做 V01–V18 校验。

## 1. 快速开始

```powershell
# 一键：采集 → 归一 → 去重 → 评分 → 排榜 → 统计 → 校验（退出码 0 = 18/18 通过）
python scanner/pipeline.py --all

# 只校验数据（V01–V18，任一失败退出码 1）
python scanner/validate.py

# 单元测试（标准库 unittest）
python -m unittest discover -s scanner/tests -v

# 分阶段执行
python scanner/pipeline.py --collect      # 运行 4 个离线适配器
python scanner/pipeline.py --normalize    # 归一（自动包含 collect）
python scanner/pipeline.py --dedupe       # 去重（自动包含前两步）
python scanner/pipeline.py --score        # 按公式重算评分并回写不一致的派生字段
python scanner/pipeline.py --rank         # 生成 data/rankings.json
python scanner/pipeline.py --stats        # 生成 data/stats.json
```

`--all` 幂等：重复执行不会改变 `opportunities.json / rankings.json / stats.json` 的字节内容（已用文件哈希验证）。
`--fix` 为早期兼容别名：评分回写现在在 `--score/--all` 中总是自动执行（契约 5.2.1「以计算值为准」）。

## 2. 数据流

```
scanner/fixtures/raw_signals.json          ← 离线样例（RSS / Reddit / Google Trends / 电商评论）
        │  adapters/*.py（每个源一个 Adapter，可替换 fetch 接真实网络）
        ▼
scanner/build/raw_signals_collected.json   ← 原始记录 + 适配器健康度 + 条数
        │  normalize.py（统一信号对象、行业/信息差/地区/情绪 hint、痛点短语、趋势方向）
        ▼
scanner/build/normalized_signals.json
        │  dedupe.py（canonical URL + 标题归一 + 同域近似）
        ▼
scanner/build/signals_deduped.json + dedupe_report.json
        │  （机会库由人撰写 / 研究底稿补证，扫描器负责物化与重算）
        ▼
data/opportunities.json  ── score.py/materialize.py 重算 → 回写派生字段
        │  rank.py（窗口归属 + 排序 + delta）        │  stats.py（KPI/分组/直方图/趋势）
        ▼                                            ▼
data/rankings.json                            data/stats.json
        │  validate.py（V01–V18）
        ▼
退出码 0 / 1
```

`scanner/build/` 是中间产物目录，内含 `.gitignore`（`*`）不入库；`fixtures/` 与代码入库。

## 3. 模块职责

| 文件 | 职责 | 契约依据 |
|---|---|---|
| `pipeline.py` | 命令行入口，串联各阶段，最后跑校验并决定退出码 | §5.2 |
| `config.py` | 路径、数据版本、as_of、窗口配额、固定枚举数量、禁词 | §3/§9 |
| `common.py` | JSON 读写、日期/ISO 周/窗口 key、`round1`（ROUND_HALF_UP）、文本工具 | §2 |
| `score.py` | 10 维加权 `total`、`grade`、`rank_score`，Decimal 精确计算 | §4.5 |
| `materialize.py` | 机会对象物化：`evidence_count`、日期链、momentum clip、total/grade/rank_score 回写 | §4.1/§4.5 |
| `rank.py` | 日/周/月/年窗口、排序链（`rank_score`降→`momentum`降→`evidence_count`降→`last_activity`降→`id`升）、`delta/change` | §5.1 |
| `stats.py` | KPI、by_industry/gap/region/need、评分直方图、14 天趋势、开放窗口价值 | §5.2 |
| `validate.py` | V01–V18 校验；附加提示（标题/描述长度等）不影响退出码 | §9 |
| `adapters/` | `rss` / `reddit` / `google_trends` / `ecommerce_reviews` 四个适配器 | §1/§6 |
| `normalize.py` | raw → 统一信号对象（hint 推断、痛点短语、趋势方向、canonical URL） | — |
| `dedupe.py` | 跨源去重与证据合并（URL 精确 + 标题归一 + 同域近似） | — |
| `tests/test_scanner.py` | 18 个单元测试：公式/舍入/等级边界/动量 clip/ISO 周/窗口/榜单/物化抛错/validate 失败路径/归一/去重 | docs/04 §10.4 |

## 4. 如何接真实数据源

1. 在 `scanner/adapters/` 新建（或改造）一个 `Adapter` 子类：
   - `name / source_id / category / access` 类属性与 `data/sources.json` 对齐；
   - `fetch()` 返回原始响应（真实模式下用 `urllib.request` 拉 RSS/API，注意 `data/sources.json` 的合规等级：`red` 只人工浏览、不得绕过登录/验证码）；
   - `parse(payloads)` 把原始响应解析成 `raw_record(...)`，与离线 fixture 同构。
2. 在 `adapters/__init__.py` 的 `ADAPTERS` 与 `FIXTURE_SECTIONS` 登记。
3. `normalize.py` 的 `INDUSTRY_KEYWORDS / GAP_KEYWORDS / REGION_KEYWORDS` 可按新信号补充关键词。
4. 真实采集建议：每域限速 ≤1 req/s、缓存 24h、只取公开字段、按 `sources.json` 的 `frequency` 调度；黄区源降级为人工导出 CSV 再喂 fixture 格式。

## 5. 如何新增/修改数据

- **新增机会**：在 `data/opportunities.json` 追加对象（字段见 docs/12 §4.1），`python scanner/pipeline.py --all` 会自动补算 `evidence_count / last_activity / momentum / total / grade / rank_score` 并校验。
- **不能手写派生字段**：`scores.total`、`rank_score` 等以扫描器计算值为准；手写值不一致时 `--score` 会回写（并打印告警）。
- **改结构/枚举/公式**：属于**数据契约变更**，必须按 docs/12 §10 升 `data_version` → 更新契约文档 → 更新 `data/CHANGELOG.md` → 通知 Lead/前端/红队。扫描器不得静默支持新枚举（`validate.py` 的 `EXPECTED_ENUMS` 硬编码了契约枚举）。
- **缺失评分维度**：`materialize.py` 直接抛 `ValueError`（不默认补 0），与 docs/04「维度缺失→抛错」一致。

## 6. 校验规则与退出码

- `validate.py` 实现 V01–V18，全部来自 docs/12 §9（V16 必填字段/窗口映射、V17 证据日期/tier/URL、V18 榜单 change/delta 语义为冻结前新增）。
- 任一规则失败 → 退出码 1；仅「附加提示」（标题长度、区域覆盖、verified=true 复查提醒等）不影响退出码。
- 评分容差 ±0.05；`total/rank_score` 使用 Decimal `ROUND_HALF_UP`，与前端 JS 严格自检交叉验证 0 差异（数据中的评分已避开 `.x5` 四舍五入歧义边界）。

## 7. 已知限制

1. 四个适配器默认跑 `fixtures/` 离线样例，**不联网**；真实源接入是替换 `fetch()`，归一/去重/评分逻辑无需改动。
2. Google Trends 无官方 API、Reddit/Amazon 等有 ToS 限制，真实采集须按 `sources.json` 合规等级与频率执行，优先官方 API/RSS。
3. 榜单 `delta` 为「相邻更大窗口」对比（day←week、week←month、month←year，year 无参照），v0.1.0 无每日历史快照；v0.2 引入 `rankings_history` 后改为同窗口上期对比。
4. 中间产物在 `scanner/build/`（已自我忽略）；发布前可删除该目录，`--all` 会重新生成。
