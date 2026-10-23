# v0.8.0 变更明细（CHANGELOG）

> 日期：2026-10-23　｜　应用 0.8.0　｜　数据 data-v0.8.0　｜　类型：MINOR　｜　上一版：v0.7.3

## 新增（Added）
- 全球源扩充：平台目录 68→125；57 个 enabled 自动源（Google News 多地区、Google Trends、垂直媒体、政策/平台源），覆盖 11/11 区域。
- 持久信号账本（SQLite，gitignore）：跨批去重、is_new、new_count/seen_count/ledger_total。
- 信号相关性初筛：relevance_score/industry/gap/region/tier/reasons；business 184 / maybe 712 / off-topic 119。
- 前端扫描边界与漏斗卡、收件箱「新增/相关/全部」Tab、/sources 自动源标记、指挥台采集摘要。

## 修改（Changed）
- fetch 注册表驱动（enabled/priority/kind/limits）、默认 --fetch-limit 60、source-health 57 源。
- 数据版本 0.7.0→0.8.0；前端 0.8.0；报告/年鉴/校准重生成（as_of 2026-10-23）。

## 已知限制
- 57/125 自动；社交/电商站内/付费内容不覆盖；初筛为规则版，仍需人工复核入库。