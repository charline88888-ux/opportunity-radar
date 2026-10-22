# data/ 数据变更记录

格式：`data_version` + 日期 + 变更内容 + 影响面。契约变更（字段/枚举/公式）必须同步更新 `docs/12-数据契约与字段字典.md` 并通知 Lead、前端、红队。

## data-v0.6.0 · 2026-10-22 · MINOR 增量（机会库 46→80、配额提高、年鉴指标细化）

> 向后兼容：字段不变；数量/覆盖要求与榜单配额提高。机会库 46 → **80 条**（新增 34 条，id 047–080）。

### 机会库扩充（34 条新增，基于 research/cases.md / handoff-to-data.md）
- **覆盖**（80 条合并后）：14 行业各 ≥2（最少 gaming 2、education 3、culture 3）；11 区域全覆盖；12 类信息差全覆盖；目标国家/地区 **53 个**；中国供应链/中文市场角度 **42 条**；`verified:true` **32 条**（2026-10-22 逐条 HTTP 直连核验 URL 后置 true，含原有 5 条）。
- **等级分布**：A 12 / B 66 / C 2；均分 70.8；证据总数 156 条（每条 ≥2）。
- **日期配额**：按 `last_activity` 布置 → day 17 / week 49 / month 57 / year 80（配额 day≥10/week≥20/month≥30/year≥80）。
- 新增 id（供前端核对）：
  `opp-manufacturing-ceramic-pet-memorial-supply-047`、`opp-pet-kr-pet-insurance-claims-048`、`opp-pet-jp-pet-insurance-settlement-049`、`opp-pet-kr-pet-funeral-subscription-050`、`opp-local-jp-inbound-experience-051`、`opp-content-jp-oshi-goods-supply-052`、`opp-content-china-guzi-economy-053`、`opp-silver-china-aging-retrofit-054`、`opp-fintech-china-inbound-payment-guide-055`、`opp-xb-saudi-ecommerce-localization-056`、`opp-content-uae-eid-gifting-057`、`opp-xb-vietnam-tiktok-shop-ops-058`、`opp-xb-sea-halal-beauty-supply-059`、`opp-fintech-brazil-pix-payment-060`、`opp-fintech-mexico-cod-oxxo-ops-061`、`opp-green-kenya-payg-solar-channel-062`、`opp-xb-africa-jumia-ops-063`、`opp-xb-india-wedding-supply-064`、`opp-emotional-india-ayurveda-d2c-065`、`opp-compliance-germany-einvoice-service-066`、`opp-compliance-eu-ppwr-epr-packaging-067`、`opp-local-poland-cee-localization-068`、`opp-xb-turkey-ecommerce-localization-069`、`opp-emotional-grief-memoir-service-070`、`opp-ai-etsy-digital-templates-071`、`opp-ai-shopify-app-niche-072`、`opp-manufacturing-west-africa-shea-processing-073`、`opp-green-africa-solar-accessories-074`、`opp-content-japan-anime-pilgrimage-content-075`、`opp-xb-saudi-salla-zid-build-076`、`opp-pet-kr-pet-food-subscription-077`、`opp-silver-jp-senior-digital-care-078`、`opp-content-china-shortdrama-id-l10n-079`、`opp-xb-china-pet-memorial-b2b-080`。

### 配额与校验（V02/V08 按 v0.6.0 契约收紧）
- **V02**：机会 ≥80、14 行业各 ≥2、11 区域全覆盖、目标国家/地区 ≥50、中国角度 ≥25。
- **V08**：day ≥10 / week ≥20 / month ≥30 / year ≥80（`config.WINDOW_QUOTAS` 同步提高）。
- 物化后 `rankings.json` day 17 / week 49 / month 57 / year 80；`stats.kpi`（total_opps 80 / grade_a_plus 12 / verified_count 32 / evidence_total 156）与实际一致。
- 历史回放重生成：10-20（day13/week23/month31/year54）、10-21（day9/week32/month40/year63）；10-22 真实快照与 rankings 一致。

### 年鉴指标细化（`scanner/yearbook.py`）
- 新增 **月度等级分布**（S/A/B/C/D × 12 个月）、**信息差热度**（每月 Top3）、**窗口衰减统计**（status/decay/months_left 分桶）、**实验漏斗**（有 `--experiments` 时：总样本→已决→成功率）。
- 其余保持：年榜 Top20、月度时间线、行业/区域/信息差分布、A 级清单、窗口收尾、评分分布、3 条规则化建议、免责；`generated_at` 确定性。
- 2026 年鉴实际运行（含样例实验摘要）：80 条机会 / Top20 20 / A 级及以上 12 / 收尾 3 / Brier 0.2338；HTML 27,092 B、MD 12,320 B。

### 版本与复核
- 全部 data meta 升 **0.6.0**；四窗口报告 8 文件、校准报告、年鉴按 0.6.0 重生成；`radar.db` 重建（80/156/468/8 行）。
- `--all` exit 0 且**幂等**（data 下所有 JSON + radar.db 连跑两次 SHA256 全一致）；validate **20/20 PASS**；unittest **58/58 OK**（新增年鉴指标/配额测试）。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`、rankings `DBC3784F4E404AF4`、history-10-20 `32385A95E403A167`、history-10-21 `1CBF6DCD43F6AF89`、history-10-22 `EB54D17C9F6F02F0`、stats `FEDE36584020035F`、source-health `E7DDFDE8DE62E62D`、sources `046E14E942E3AF83`、radar.db `40A02F54FAD02471`、yearbook html `89514DC57EE819EE`、calibration html `701D4CCD9FAFA8A9`。

### 已知不足
- 新增 34 条为研究底稿改写，证据以公开报道/官网为主；`verified:true` 表示核验日 URL 可打开，不保证长期有效。
- 部分目标国家/地区仅作市场参考（未逐国做合规尽调）；跨境/宗教/医疗/金融类机会仍须人工合规核查。
- 榜单 day/week 窗口条数受 `last_activity` 布置影响（当前均超配额），后续每日运行应保持当日新增 6+。

## data-v0.5.1 · 2026-10-22 · PATCH（AI 富化 provider mock / 在线路径可验证）

> PATCH：只扩展 `scanner/enrich.py` 与版本号；机会库/榜单/历史/source-health 口径不变（JSON 内容仅 meta.data_version 变化）。

### `scanner/enrich.py` provider 扩展（docs/12 §1.5）
- **`--provider mock`（新增）**：本地模拟 OpenAI 兼容响应（**不联网**），走与真实在线相同的请求构造/响应解析/合并/回退流程；`meta.generator="mock-llm"`、`meta.provider="mock"`、`meta.model="mock-model"`；产物 schema 与 offline 相同，所有候选 `needs_human:true`。
- **在线模式完善**：`--limit N` 限制处理条数；`meta.usage{input_tokens, output_tokens, estimated_cost_usd, calls, cache_hits, prices}`（价格常量 `config.LLM_PRICE_INPUT_PER_1K_USD` / `LLM_PRICE_OUTPUT_PER_1K_USD`，注释标明示例价格、非真实账单；缓存命中不重复计费）；超时 60s + `config.LLM_MAX_RETRIES` 次指数退避重试；24h 缓存命中在候选 `_llm.cached` 与 `meta.cache_hits` 标注；失败自动回退 offline 并记录 `meta.error`。
- **铁律保留**：key 只从 `LLM_API_KEY` 环境变量读取、绝不落盘；不写 `data/opportunities.json`；`--dry-run` 不落盘；无 key 时 online 清晰报错（exit 2，不崩溃）；outbox 仍 gitignore。
- **测试（新增 5 条，共 55）**：本地 `http.server.ThreadingHTTPServer` 起 OpenAI 兼容 `/chat/completions`，验证请求头（`Authorization: Bearer …`）/请求体（model/messages）/响应解析/token 记录/缓存命中/失败回退；断言 key 不出现在产物中、opportunities 内容不变；不依赖外网/真实 key。
- 实际运行（2026-10-22，`--provider mock --limit 5`）：**5 条候选**（跳过 206）、`generator=mock-llm`、`model=mock-model`、tokens input **1446** / output **869**、成本估算 **$0.000738**、`cache_hits=0`；产物 `scanner/outbox/enriched-2026-10-22.json` + `REVIEW.md`（outbox gitignore）。

### 版本与复核
- 全部 data meta 升 **0.5.1**（taxonomy/rankings/stats/sources/playbooks/calendar/source-health + 3 份 history 快照）；四窗口报告 8 文件、校准报告、年鉴按 0.5.1 重生成；`radar.db` 重建（46/88/211/8 行）。
- `python scanner/pipeline.py --all`：exit 0、**幂等**；`validate.py` **20/20 PASS**；unittest **55/55 OK**；yearbook 双跑字节一致；offline enrich / calibrate / yearbook 回归可用。
- 指纹（SHA256 前 16）：opportunities `52B30E45B356CEA9`（未变）、rankings `69B7F0F8401C4735`、history-10-22 `CA5C8426D8096A42`、stats `90DD20B1889B2E93`、source-health `3972812DDB43D574`、sources `45EB59ACED43626C`、radar.db `692920C029711881`、yearbook-2026.html `056F7EFF17C63B15`、calibration-2026-10-22.html `5EC1CEC0883D9A6C`。

### 已知不足
- 真实 LLM 路径仅用本地 mock server 验证（无真实 provider key，未产生真实调用）；成本常量是示例价格，真实账单以 provider 为准。
- mock 响应为模板化内容（非真实模型输出），仅用于流程测试/演示，不代表 AI 质量。
- 个人数据包/`rec_log` 由前端负责，数据侧不落盘；采集仍只覆盖 RSS/JSON feed。

### 红队复验修正（v0.5.1 PATCH 内，2026-10-22）
- **P1 CLI 相对路径崩溃（已修）**：`enrich.py` / `calibrate.py` / `yearbook.py` 的 `--out-dir` 为相对路径时，打印 `Path(...).relative_to(config.ROOT)` 抛 `ValueError`（文件已写出但进程 exit 1）。修复：新增 `common.display_path()`（`resolve().relative_to(root.resolve())`，越界/相对路径降级原样打印、绝不抛错）；`enrich/calibrate/yearbook.generate()` 入口把 `out_dir` 统一 `resolve()`；打印改用 `display_path`。新增 2 条回归单测（enrich CLI 相对 out-dir、yearbook+calibrate CLI 相对 out-dir），复现命令 `python scanner/enrich.py --signals scanner/outbox/signals-2026-10-22.json --out-dir qa/tmp/enrich-rel --provider mock --limit 2` 现为 **exit 0** 且产物正常。
- **P2 缓存 usage 语义（已说明）**：24h 内二次运行命中缓存时 `meta.usage={input_tokens:0, output_tokens:0, calls:0, cache_hits:N}`（不重复计费，属预期行为）；首次运行记录估算 tokens 与成本。已写入 data/README §7.1 与 scanner/README。
- 回归：unittest **57/57 OK**（新增 2 条），validate **20/20 PASS**，`--all` 幂等；数据 JSON 未变更（仅 scanner 代码 + 文档），指纹不变。

## data-v0.5.0 · 2026-10-22 · MINOR 增量（年度年鉴）

> 向后兼容：不删除、不改名既有字段；机会库/榜单/历史/source-health 数据口径不变，仅版本号升 0.5.0。个人数据包与 `rec_log` 为前端 localStorage 本地数据，**不进入 data/**。

### 新增工具
- **`scanner/yearbook.py`（年度年鉴）**：`--year 2026 [--experiments <export.json>] [--sample]` → `data/reports/yearbook-2026.{html,md}`（HTML 自包含可打印、`generated_at` 用 as_of 固定值 → 双跑字节一致）。
  - 年榜 Top20、月度时间线（按 `activity_dates` 聚合 12 个月，无活动月份显示 0，含行业/信息差 Top2 主题）、行业/区域/信息差/等级/窗口状态分布、A 级清单（≥75）、窗口收尾或 ≤3 个月机会、评分分布（CSS 条形，不依赖外网）、可选实验摘要（复用 `calibrate.py` 的 Brier/成功率/花费口径）、规则化「年度 3 个方向建议」（标注「规则生成，非投资建议」）、免责。
  - 2026 年鉴实际运行（含样例实验摘要，`--sample`）：**46 条机会 / Top20 20 条 / A 级及以上 11 条 / 收尾窗口 0 条 / Brier 0.2338**；HTML 70 行 / 23,068 B（无实验版 22,745 B），MD 同步生成。
  - 容错：无实验、空年份（0 机会）、非法实验 JSON（记录 `experiments_error` 并跳过摘要）均不崩溃；单测覆盖无实验/有实验/空年份/双跑确定性/非法 JSON 5 类。
- 新增单测：unittest **45 → 50 条**（`TestYearbook`）；`TestCalibrate.test_generate_reports_and_invalid_export` 仍回归通过。

### 版本与复核
- 全部 data meta 升 **0.5.0**（taxonomy/rankings/stats/sources/playbooks/calendar/source-health + 3 份 history 快照重生成）；四窗口报告 8 文件、校准报告、年鉴全部按 0.5.0 重生成；`radar.db` 重建（46/88/211/8 行）。
- `python scanner/pipeline.py --all`：exit 0、**幂等**；`validate.py` **20/20 PASS**；calibrate/enrich 回归可用。
- 指纹（SHA256 前 16）：opportunities `52B30E45B356CEA9`（未变）、rankings `F6E91C3350377162`、history-10-22 `675AD8BE774B7478`、stats `89915E415CF435D1`、source-health `122B04353B2BC2E3`、sources `8EE05E408700051D`、radar.db `0C6026699FE3CEDD`、yearbook-2026.html `750DF083C29ADC9A` / .md `E73C905615E9A348`、calibration-2026-10-22.html `E23FACA50DF60302`。

### 已知不足
- 年鉴的「年度 3 个方向建议」是规则生成（非投资建议），仅用于复盘提示。
- 年鉴实验摘要当前使用样例实验数据（fixtures/experiments-sample.json，已标注 sample）；真实结论需前端积累真实实验后重跑 `--yearbook --experiments`。
- 采集仍只覆盖 RSS/JSON feed；`verified:true` 仍 5 条；个人数据包/rec_log 由前端负责，数据侧不落盘。

## data-v0.4.0 · 2026-10-22 · MINOR 增量（AI 富化 outbox + 实验校准报告）

> 向后兼容：不删除、不改名既有字段；机会库/榜单/历史/source-health 数据口径不变，仅版本号升 0.4.0。

### 新增工具（scanner/）
- **`scanner/enrich.py`（AI 富化 outbox，人工复核门禁）**：
  - 读 `scanner/outbox/signals-<date>.json` → 写 `scanner/outbox/enriched-<date>.json` + `REVIEW.md`（outbox gitignore，不入库/不入发布）；
  - 默认 **offline-template**：关键词/taxonomy 候选映射（行业/信息差/人性需求/情绪/神经递质）、七问骨架草稿（标注「待人工补充」）、启发式语言检测、证据 URL 透传；
  - 可选 **在线模式**：`--online` + 环境变量 `LLM_API_KEY`（可选 `LLM_BASE_URL`/`LLM_MODEL`）调用 OpenAI 兼容 `/chat/completions`，记录 model/latency/token 估算，24h 缓存，失败自动回退 offline；
  - **安全**：key 只从环境变量读取、绝不写文件；`--dry-run` 不落盘；所有候选 `needs_human:true`；**永不自动写入 `data/opportunities.json`**（单测断言内容不变）。
  - 2026-10-22 实测（现有 outbox，offline-template）：**211 条候选、0 跳过**；产物 `scanner/outbox/enriched-2026-10-22.json`（434 KB）+ `REVIEW.md`（134 KB）。
- **`scanner/calibrate.py`（实验校准报告）**：读前端导出实验 JSON → `data/reports/calibration-<date>.{html,md}`；含样本数/结果与状态分布、等级×成功率、**Brier**（`p=clamp(total/100,0.01,0.99)`、`o=positive1/negative0`、inconclusive 排除、基线 0.25、样本<3 提示不足）、花费/耗时、校准建议、免责。
  - 2026-10-22 样例运行（`--sample`，样例实验 6 条）：**有效样本 5 条、Brier 0.2338（≤ 基线 0.25）**；产物 `data/reports/calibration-2026-10-22.html/.md`（样例已在报告顶部标注）。
- 新增 fixture `scanner/fixtures/experiments-sample.json`（6 条覆盖 positive/negative/inconclusive 的演示实验）。

### 版本与复核
- 全部 data meta 升 **0.4.0**（taxonomy/rankings/stats/sources/playbooks/calendar/source-health + 3 份 history 快照）；replay 重生成、`--all` 重算，榜单内容口径不变（delta_basis=history / history_as_of=2026-10-21）。
- 报告：四窗口 8 文件 + 校准报告 2 文件全部按 0.4.0 重生成；`radar.db` 重建（46/88/211/8 行）。
- `python scanner/pipeline.py --all`：exit 0、**幂等**（连跑两次 data 下所有 JSON 与 radar.db SHA256 全一致）；`validate.py` **20/20 PASS**；unittest **36 → 45 条全绿**（新增 enrich offline/dry-run/no-key/不写机会库、calibrate Brier 公式/边界/样例报告/非法导出）。
- 指纹（SHA256 前 16）：opportunities `52B30E45B356CEA9`（未变）、rankings `435AAEE6A877DC99`、history-10-22 `D7BBF24D2ECAFCDC`、stats `5247BCD3A65FF96D`、source-health `DECC29B3218888FF`、sources `B7400DD9E5D1AA3F`、radar.db `12AA034D1F7FE5AE`。

### 复现命令
```powershell
python scanner/enrich.py                                                        # offline-template 富化
python scanner/enrich.py --dry-run                                              # 不落盘
python scanner/calibrate.py --experiments scanner/fixtures/experiments-sample.json --sample
python scanner/pipeline.py --all && python scanner/validate.py
```

### 已知不足
- 富化草稿是**模板级**候选（offline），行业/信息差映射基于关键词，可能误判；必须人工复核后才能入库。
- 在线 LLM 模式未在本次交付中实际调用（无 LLM_API_KEY 环境），仅由单测覆盖「无 key 报错/回退」路径；真实调用时 token 成本与内容合规需自行评估。
- 校准报告目前为**样例数据**（fixtures/experiments-sample.json），真实结论需等前端实验台积累 ≥3 条已决实验后重跑。
- 采集仍只覆盖 RSS/JSON feed；`verified:true` 仍 5 条。

## data-v0.3.1 · 2026-10-22 · PATCH（采集失败源修复 + 版本号）

> PATCH：仅修复采集源与升版本号，机会库/评分/榜单排序规则不变（`opportunities.json` 指纹不变）。

### 源修复（`sources.json` 63→…→68，详见条目 notes）
1. **reddit**（原 `https://www.reddit.com/r/Entrepreneur/.rss` 持续超时）：实测 `www.reddit.com` / `old.reddit.com` / `.json` 三种入口在 40s 内全部超时（本机网络对 reddit.com 不可达）；
   - 处理：`reddit` 条目改为 `access="manual"`（保留矩阵与人工浏览说明，`check_result="fetch_timeout"`）；
   - 新增可采集替代源 **`lobsters`**（`https://lobste.rs/rss`，green，实测 25 条技术社区讨论）→ 可采集源数量保持 8。
2. **itunes-reviews**（原 US storefront JSON 返回 200 但 `feed` 无 entry）：实测 US/GB/JP 三个 storefront——
   - US 空 feed（873 B，0 条）、page=2/helpful/旧端点/播客均 0 条；
   - **GB storefront 返回 50 条评论**（`.../gb/rss/customerreviews/...json`），JP 50 条；
   - 处理：URL 改为 GB storefront，解析器（`fetch.py` 的 `_parse_json_feed`，支持 `feed.entry`/`im:name`/多 link 结构）无需改动即可解析 50 条 → 按单源上限保留 30 条。
3. **shopify-changelog**（原 `https://shopify.dev/changelog` 为 HTML）：找到官方 RSS **`https://shopify.dev/changelog/feed.xml`**（`Recent changes to Shopify's platform`，实测 1.89 MB / 778 条），更新 URL 并记录替换；抓取按单源上限保留 30 条。
4. 采集器参数：`FETCH_TIMEOUT_SEC` 12→**20s**（hnrss 实测 17.2s）、UA 升 `OpportunityRadar/0.3.1`；限速/缓存/重试/合规策略不变。

### 真实运行结果（2026-10-22 18:2x，`python scanner/pipeline.py --fetch --no-cache`）
- **8/8 个源成功**，215 条原始 → **211 条信号**（outbox 人工复核，未写机会库）：
  - itunes-reviews ok 200 / 243ms / items 30；shopify-changelog ok 200 / 2102ms / 30；hnrss ok 200 / 17222ms / 20；lobsters ok 200 / 833ms / 25；app-store-rss ok 200 / 1284ms / 30；arxiv-rss ok 200 / 1683ms / 30；techcrunch-rss ok 200 / 2618ms / 20；producthunt-feed ok 200 / 1051ms / 30。
- `source-health.json` v2：`meta.mode="online-fetch"`、count 8 / ok 8 / failed 0 / cached 0；失败源集合为空（V20 仍校验「失败必须有 error」逻辑）。

### 版本与复核
- 全部 data meta 升 `0.3.1`（taxonomy/rankings/stats/sources/playbooks/calendar/source-health + 3 份 history 快照）；回放快照重生成（reconstructed=true，仍 10-20/10-21），真实快照 10-22 为 `reconstructed=false`。
- `python scanner/pipeline.py --all`：exit 0、**幂等**；`validate.py` **20/20 PASS**；`unittest` **36/36 OK**；`report.py --all` 8 文件按 0.3.1 重生成；`radar.db` 重建（46/88/211/8 行）。
- 指纹（SHA256 前 16）：opportunities `52B30E45B356CEA9`（未变）、sources `8779D97DA6F82150`、rankings `47A1620F0BFC66A0`、history `4B6F7C3B27030504`/`6B4D9EEB75B7D6D5`/`A3F2931B0E08D332`、stats `9C9F0A9404C16F2D`、source-health `CE657264793DE424`、radar.db `0CC30211191AF4D3`。

### 已知不足
- Reddit 在本机网络不可达（非解析问题），已降级 manual + Lobsters 替代；换网络环境后可重试恢复。
- Apple customerreviews 仅部分 storefront 有数据（US 为空），已固定 GB；如 Apple 再调整，可切 JP 或改源。
- 采集仍只覆盖 RSS/JSON feed 类源；`verified:true` 仍 5 条。

## data-v0.3.0 · 2026-10-22 · MINOR 增量（source-health v2 / 历史回放 / 真实 delta）

> 向后兼容：不删除、不改名既有字段。v0.1.0/v0.2.0 快照见 `releases/`。

### 增量
- **source-health v2**：每源 `mode ∈ {online-fetch,cache,offline}`、`http_status`(int/null)、`latency_ms`（真实测量；缓存命中 0 且 `cached=true`）、`cached`、`items`、`error`（`ok=false` 必填非空原因）、`checked_at`；`meta.mode/cached_count/online_count`。
- **历史回放快照**：`--replay-as-of <date> --replay-days N` 生成基准日前 N 天的确定性回放（`meta.reconstructed=true`、`meta.replay_as_of`、`snapshot_at` 确定性、只纳入 `last_activity ≤ 回放日` 的机会）。当前 `data/history/` 3 份：`rankings-2026-10-20.json`（回放，day3/week5/month13/year36，adjacent-window）、`rankings-2026-10-21.json`（回放，day2/week7/month15/year38，history）、`rankings-2026-10-22.json`（真实，day8/week15/month23/year46，history）。
- **真实 delta**：`rankings.json.meta.delta_basis="history"`、`history_as_of="2026-10-21"`；窗口对比 day 用上一日快照、week/month/year 用同 key 上期；仅两期都出现的机会有 delta，新增 `null/new`；回退口径保留（回放 10-20 即 adjacent-window 示例）。当前 week/month/year 分别 7/15/38 条有 delta，8 条 10-22 新机会为 new。
- **V19/V20 收紧**：V19 校验全部快照结构、`snapshot_at` 日期对齐、回放必须 `replay_as_of`、最新快照=当日真实快照且与 rankings 一致；V20 校验 source-health v2 全部字段与一致性（缓存 latency=0、失败必须有 error、`meta.mode` 合法）。
- 数据版本：taxonomy/rankings/stats/sources/playbooks/calendar `meta.data_version` → `0.3.0`；报告改为确定性 `generated_at`（同日重跑字节一致）；单测 28 → **36 条**（新增回放链/幂等、source-health 合法/非法、history 新增不回退）。

### 真实验证结果（2026-10-22 实际运行）
- `pipeline.py --replay-as-of 2026-10-22 --replay-days 2`：生成 10-20/10-21 回放并重算当前榜单 → 10-22 `delta_basis=history`、`history_as_of=2026-10-21`。
- `pipeline.py --all`：exit 0，**幂等**（连跑两次 opportunities/rankings/3 份 history/stats/radar.db/reports SHA256 全一致）；validate **20/20 PASS**。
- `pipeline.py --fetch --no-cache`：真实网络，8 源 **5 成功 / 3 失败**（129 条信号）；失败原因如实写入 source-health：reddit `URLError: timed out`、itunes-reviews 与 shopify-changelog「返回内容不是可解析的 feed（http_status=200，有效条目 0 条）」。成功源真实 latency 848–9218ms。
- `report.py --all`：4 窗口 × HTML/MD，确定性生成、重跑一致。
- `db.py --rebuild`：46 opportunities / 88 evidence / 211 rankings_history / 8 source_health。
- `python -m unittest discover -s scanner/tests`：**36/36 OK**。

### 指纹（SHA256 前 16）
`opportunities.json` `52B30E45B356CEA9`（未变）｜`rankings.json` `DBF852C62C9B7DDE`｜`history/rankings-2026-10-20.json` `4C48B00AEA36F74E`｜`rankings-2026-10-21.json` `DE8D5A63223EC52C`｜`rankings-2026-10-22.json` `B74E31E950CC39AA`｜`stats.json` `C8C0B24735B933D1`｜`source-health.json` `C3021C8973860B90`｜`radar.db` `424F46DE30F9E368`

### 已知不足
- 回放快照是「按当日窗口规则重排现有机会」的演示口径（非真实历史存档），UI/文档需明示 `reconstructed=true`。
- 采集仍只覆盖 RSS/JSON feed；reddit 本次网络超时、itunes/shopify 返回非 feed，属真实网络/源变化，已如实记录，可重跑 `--fetch` 刷新。
- `verified:true` 仍 5 条；公开 API 源未接线。

## data-v0.2.0 · 2026-10-22 · MINOR 增量（历史快照 / SQLite / 真实采集 / 报告）

> 向后兼容：不删除、不改名 v0.1.0 的任何必填字段；只新增可选文件/字段与历史快照机制。v0.1.0 快照见 `releases/v0.1.0/`。

### 新增文件与增量
- `data/history/rankings-<date>.json`：每日榜单历史快照，`meta.snapshot_at`（确定性逻辑时间）+ `meta.reconstructed=false`；每次 `--all` 按 as_of 写入、同日覆盖。当前 1 份（2026-10-22）。
- `rankings.json.meta` 新增 `delta_basis`（`history` / `adjacent-window`）、`history_as_of`（上一快照日期或 null）；`windows[].delta_basis` 标明该窗口实际口径；`tie_breaker` 落盘排序链。
- `delta` 机制升级：有更早快照时按「上一快照同窗口名次」计算（delta=上期名次−本期名次）；否则回退相邻窗口口径。当前数据无更早快照 → `adjacent-window`，history 路径由单测临时快照覆盖。
- `data/source-health.json`：在线采集源健康度（`--fetch` 生成，8 个源：7 成功 / 1 失败）。
- `data/reports/`：四窗口自包含 HTML + Markdown 报告（8 个文件），含七问摘要、证据链接、风险与免责声明。
- `data/radar.db`（gitignore）：SQLite 派生库，表 opportunities/evidence/rankings_history/source_health，当前 46/88/92/8 行，可由 JSON 全量重建。
- `scanner/` 新增 `history.py` / `db.py` / `fetch.py` / `report.py`；`rank.py` 支持双 delta 口径；`validate.py` 新增 V19（历史快照一致性）/V20（source-health 合法性）→ **20/20 PASS**。
- `data/sources.json` 从 63 → **67 个平台**：新增 4 个可采集公开 RSS 源（hnrss / techcrunch-rss / producthunt-feed / arxiv-rss）。
- `scanner/outbox/`（gitignore）：`--fetch` 输出的人工复核队列，不自动写入机会库。

### 真实验证结果（2026-10-22 实际运行）
- `python scanner/pipeline.py --all`：exit 0，**幂等**（连跑两次：opportunities/rankings/history/stats/radar.db SHA256 全部一致），validate **20/20 PASS**。
- `python scanner/pipeline.py --fetch`：**7/8 个源成功**，185 条原始信号：
  - 成功：reddit（25）、itunes-reviews（30）、hnrss（20）、app-store-rss（30）、arxiv-rss（30）、techcrunch-rss（20）、producthunt-feed（30）；缓存命中后二次运行 0ms。
  - 失败：shopify-changelog（返回 HTML 而非 feed，items=0）——已如实记录在 source-health。
  - 合规：每域 ≤1 req/s、6h 缓存、明确 UA、12s 超时、失败重试 2 次；红区源不抓取；outbox 仅人工复核。
- `python scanner/report.py --all`：4 窗口 × HTML/MD 共 8 个文件（day 8 条、week 15、month 23、year 46）。
- `python -m unittest discover -s scanner/tests`：**28 条全绿**（新增 history delta/回退、报告生成、SQLite 重建、RSS/Atom/JSON feed 解析、红源筛选）。

### 数据指纹（SHA256 前 16 位）
- `opportunities.json` `52B30E45B356CEA9`（内容未变）
- `rankings.json` `AD79B0AA1B8CFFF8`
- `history/rankings-2026-10-22.json` `170F44478DC20A5D`
- `stats.json` `4F58F249566C5627`
- `radar.db` `D8F67AD20FE11CA0`（派生库，不入库）

### 已知不足
- 当前仓库只有 1 份历史快照 → 真实数据使用 adjacent-window；history 口径待次日运行自然生效（单测已覆盖）。
- `--fetch` 只覆盖 RSS/JSON feed 类源；公开 API 源（YouTube/SEC/openFDA 等）尚未接线，openFDA 在部分网络有证书链问题。
- `verified:true` 仍为 5 条（025/029/030/031 单证据待补第二独立来源）。
- 4 个离线适配器继续保留用于可复现回归；真实采集与离线 fixtures 互不影响。

## data-v0.1.0 · 2026-10-22 · 首个冻结数据版本

### 最终交付规模
- `taxonomy.json`：11 组固定枚举全量（14 行业含 color/icon、12 需求、6 神经递质、24 情绪、12 信息差含半衰期、7 驱动、12 商业模式、11 区域、10 评分维度权重、20 标签、5 等级），id 与 `docs/12` §3 完全一致。
- `opportunities.json`：**46 条**高质量机会；14 行业各 ≥1、11 区域全覆盖、12 类信息差全覆盖、38 个目标国家/地区、18 条中国供应链/中文市场角度；混合实物跨境/服务/信息产品/SaaS/合规专业/文化宗教/内容 IP/本地生活/银发/宠物/情绪疗愈；七问全答、88 条证据、10 维评分齐全。
- `rankings.json`：day 8 / week 15 / month 23 / year 46（配额 day ≥6 / week ≥12 / month ≥20 / year ≥40）。
- `stats.json`：KPI + 分布 + 直方图 + 14 天趋势 + 开放窗口价值。
- `sources.json`：12 大类 **63 个平台**（含访问方式/频率/成本/合规等级/价值分/坑，引用 `research/platform-matrix-validation.md`）。
- `playbooks.json`：**12 个**可照做剧本（steps ≥5、platforms ≥2、关键词与质检点）。
- `calendar.json`：**33 个** 2026-11～2028 全球商业日历节点（宗教/节日/税季/开学/财政年/购物节）。
- `scanner/`：纯标准库流水线（adapters / normalize / dedupe / materialize / score / rank / stats / validate / pipeline），`python scanner/pipeline.py --all` 退出码 0，`validate.py` **18/18 PASS**，`python -m unittest discover -s scanner/tests` 18 个测试全绿。

### 阶段 A（12 条机会里程碑）
- 新增 taxonomy、12 条机会（宠物/银发/情绪/AI）、rankings/stats、扫描器骨架（4 个离线适配器 + fixtures）。
- 修正阶段 A 非法枚举引用（`gap_type_ids` 误用 `tech`、`tags` 误用 `subscription/local/service`）与超长标题。

### 阶段 B 关键变更
- 机会库扩到 46 条，按四窗口配额布置 `last_activity`（当天 8 / 本周 15 / 本月 23 / 全年 46）。
- 新增 sources / playbooks / calendar 三件套。
- 引用 `research/handoff-to-data.md` 的 12 个高价值案例（故乡纳税、Umrah、宗教译审、K-beauty、短剧本地化、MercadoLibre、乳木果、EAA 无障碍、回忆录、印尼清真、Etsy 数字产品等）。
- 证据核验：5 条机会 `verified:true`（024/025/029/030/031，全部证据 URL 实测 HTTP 200）；其余 `verified:false` 并在 `compliance_notes` 说明。
- 诚实性修正：`opp-compliance-eaa-accessibility-034` 原引 France Num 页面实测 404 → 改用 EUR-Lex 官方指令（2019/882）并置 `verified:false`；DEHSt CBAM 抓取时处于维护页，相关机会保持 `verified:false`。

### 契约澄清同步（docs/12 更新后）
- 评分公式改为 `round_half_up`（Decimal），`score.py` 同步；数据评分向量避开 `.xx05` 歧义边界。
- `window.status` 与 `months_left` 按 §4.7 映射；`decay` 由主信息差半衰期推导。
- 榜单 `delta` 明确为相邻更大窗口对比（day←week、week←month、month←year，year 无参照）。
- 新增校验 V16（必填字段完整性 + 窗口映射）、V17（证据日期/tier/URL）、V18（榜单 change/delta 语义），validate 已实现并全部通过。
- `sources.frequency` 新增 `yearly` 枚举（GEM/Pew/Hofstede/WVS 使用）。
- 移除 `validate.py` 中两处比契约更严的检查（七问 ≥12 字、first_seen ≥ activity 最小值），降级为附加提示。

### 已知不足
- 4 个采集适配器默认仅跑离线 fixtures（不联网），真实源接入需替换 `fetch()` 并按合规等级限速。
- `verified:true` 仅 5 条（全部证据 URL 200）；其余 41 条为 `verified:false`，使用前需复核原始来源。
- 宗教节日日期（斋月/开斋节/朝觐/排灯节等）为预计值，以当地观月/官方公告为准。

### 红队终验修正（2026-10-22 10:20）
- 证据引文可回溯性（P1）：001 的 Etsy 两店铺页引文降级为 listing 标题级事实描述；028 的 r/islam 与 quran.com 引文降级为社区讨论主题/产品功能描述；043 的 r/gamedev 引文降级为讨论主题描述。均保持 `verified:false` 并在 `compliance_notes` 说明，未编造新 URL。
- 证据日期（P2）：cnstock 763132 三处日期由检索日修正为原文发布日 2026-08-19。
- 七问 moat（P2）：8 条 22–29 字的 moat 扩写为「壁垒 + 前置条件 + 被复制周期」完整表述（019 / 025 / 026 / 030 / 031 / 035 / 045 / 046）。
- 复验回归修补（P1，2026-10-22 10:25）：043 在上一轮修补中把 Reddit 描述误写到 `evidence[0]`（MarketResearch 报告 URL）造成字段错配；已恢复 evidence[0] 为报告本身（Global Video Game Translation Services Market 2026-2032），Reddit 讨论描述放回 evidence[1]；并对全部 88 条证据做 publisher/URL/title 语义一致性扫描（0 处告警）。
- 复核：`pipeline.py --all` exit 0 且幂等；`validate.py` 18/18 PASS；unittest 18/18 OK；`rankings.json` / `stats.json` SHA256 未变（评分未受影响），`opportunities.json` SHA256 已变化。
- 已知缺口：`verified:true` 中 025/029/030/031 为单一权威一手来源，第二独立来源待补（契约 §2「优先 2–4 条」非强制）。

### 冻结前 tie-breaker 对齐（2026-10-22 10:40）
- 按 docs/12 §5.1 排序链修正 `scanner/rank.py`：`rank_score` 降序 → `momentum` 降序 → `evidence_count` 降序 → `last_activity` 降序 → `opp_id` 升序（此前实现为 `rank_score`→`total`→`id`），并在 `rankings.json.meta.tie_breaker` 落盘口径。
- 受影响仅 month / year 窗口的并列组：81.4 组 025 升 3、024 降 4；78.2 组（year）002 升 8、036 降 9；69.9 组 008 升 18(y)/36(y)、009 降 19(y)/37(y)。day / week 窗口无变化；`delta/change` 随名次同步更新（V18 通过）。
- `data/opportunities.json` 未改动（SHA256 不变 52B30E45…4B96F4A42）；`rankings.json` SHA256 变为 60F06FE8…528D27；`stats.json` 内容不变。
- 新增 1 条 tie-breaker 单元测试（unittest 19/19 OK）；`validate.py` 18/18 PASS；`pipeline.py --all` exit 0 且幂等。
