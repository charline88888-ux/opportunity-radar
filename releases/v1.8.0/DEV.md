# v1.8.0 开发文档（DEV）

> 版本：v1.8.0（MINOR）　｜　数据版本：data-v1.8.0　｜　日期：2026-10-24　｜　上一版：v1.7.0

## 用户要求
继续升级，但不推翻旧版；分析不是门禁，单项极强可以成商机；用 LLM 做分析，但不替代系统方法论。

## 数据（1.8.0，纯增量）
- 102/102 候选 `analysis` 新增 `information_value`（novelty/specificity/impact/urgency/actionability + 依据/均分）、`key_facts`（事实/政策/数据/推断 + source_ref）、`evidence_quality`（source_count/independence/authority/recency/score/note）。
- 分析输入加入 source.summary/title_original/evidence/行业/缺口/区域，不再只看标题。
- causal_chain 102/102 五步；禁用词 0；single_axis_strong 41（任一维极强即保留，不做门禁）。
- 本批 DeepSeek usage 253,604 tokens（prompt 96,730 / completion 156,874），wall 约 1,091s；失败 0。
- **每日自动分析**已接入 pipeline：有 key 时对缺 analysis/新候选调用（cache 命中跳过、失败不阻断、无 key 跳过）；GitHub Actions daily workflow 注入可选 `secrets.DEEPSEEK_API_KEY`，未配置不失败。
- validate 20/20；unittest 102/102；cold determinism；--all 幂等。
- 旧字段（标题/评分/ROI/画布/经济/AOV）全部保留；精选 80 无 analysis 不变。

## 前端（1.8.0，纯增量）
- 02A 分析区内新增：信息价值均分 chip、5 维进度条、关键事实/推断（source_ref 外链）、证据质量行；现有 7 区块/图表/布局/9 路由未改。
- 精选无 analysis 仍整块隐藏。
- 版本 1.8.0；i18n 16/16；1600/1024 无溢出；截图 15 张。

## 边界
- LLM 只做分析与假设，不做通过/淘汰；证据引用必须来自候选现有 evidence；理论判断、非收入承诺。
- v1.7.0 旧内容在 releases 保留，可回滚。