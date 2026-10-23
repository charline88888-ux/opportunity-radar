# v0.8.0 开发文档（DEV）

> 版本：v0.8.0（MINOR）　｜　数据版本：data-v0.8.0　｜　日期：2026-10-23　｜　上一版：v0.7.3

## 1. 背景
用户指出：“8 源×30 条不能叫全球商机扫描器；采集/打分数据会重复，没有新源入库。”本版直接扩源、跨批去重、相关性初筛并可视化扫描边界。

## 2. 变更
### 2.1 全球源扩充
- `data/sources.json` 68→**125 平台**：新增 Google News 多地区 query（18 地区模板）、Google Trends、垂直媒体（Retail Dive/Modern Retail/Sifted/EU-Startups/Tech.eu/Rest of World/Tech in Asia/Inc42/TechCabal/LatamList/Startup Daily AU/TechNode/36Kr/Japan Times/vc.ru 等）。
- **57 个 enabled 自动源**，覆盖 11/11 区域；fetch 按 priority、合规绿/黄、限速抓取，默认上限 60。
- 实测：57/57 源成功、1,448 原始 → 1,015 信号（36s，6h 缓存命中；new 988 / seen 27）；source-health 记录每源 items/status。

### 2.2 跨批去重账本
- `scanner/ledger.py` + `scanner/build/signal-ledger.sqlite`（gitignore）：canonical_url/title_hash/content_hash、first_seen/last_seen/seen_count。
- outbox 每条 `is_new`；meta `new_count/seen_count/ledger_total`；同日重复跑 new 988→0（重置后首跑 988 新/27 已见），旧条目只算已见。

### 2.3 相关性初筛
- `scanner/relevance.py`：taxonomy 关键词 + 排除词（招聘/广告/纯论文）→ relevance_score/industry/gap/region/tier/reasons。
- 1,015 条：business 184 / maybe 712 / off-topic 119；`/api/outbox` 提供 relevant_count/tiers/top_relevant。

### 2.4 前端
- `/control` 新增「扫描边界与漏斗」：57 源成功/失败、每源 items、原始→去重→新增→相关、已见数、抓取规则、未覆盖平台。
- 收件箱 Tab「新增/相关/全部」，每条带 relevance/industry/gap/region/is_new 标签。
- `/sources` 标注 access（rss/json/api/manual）与自动状态；指挥台显示自动源/区域/新增摘要。
- 版本 0.8.0；双语。

## 3. 验收
- 数据：validate 20/20、unittest 101/101、`--all` 幂等；data 0.8.0；机会库 80 条不变。
- 前端：strict 构建、15 路由、收件箱三态、边界卡、服务真实联调、截图。
- 冻结/线上：MANIFEST 19/19、tag deploy success、线上 `/` 与 `/v0.8.0/` 同 hash。

## 4. 已知限制
- 125 平台中 57 个自动、其余为人工/API/需授权；社交平台（X/IG/TikTok/小红书）、电商内部趋势、付费报告仍不覆盖；
- 新闻聚合类源标题宏观，相关性初筛为规则版，仍需人工复核；
- 机会库仍人工增量，不自动入库。