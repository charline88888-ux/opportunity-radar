# v1.8.1 开发文档（DEV）

> 版本：v1.8.1（PATCH）　｜　数据版本：data-v1.8.0　｜　日期：2026-10-24　｜　上一版：v1.8.0

## 修复（每日自动化健壮性）
1) 无 DeepSeek key / CI 环境下，新候选缺 analysis 时生成**规则兜底**（schema 完整、标记 `fallback=true`、`provider=rule_fallback`），不再让 daily validate 因“缺少 analysis”失败；有 key 时 auto-analysis 会用真实 LLM 覆盖 fallback。
2) auto-analysis 缓存条件改为：`fallback=true` 不视为完整缓存，有 key 时会重新分析。
3) V20 候选数下限从 100 调整为 80，容忍每日抓取波动（仍要求 analysis schema/5步/禁用词0等）。
4) daily workflow 注入可选 `DEEPSEEK_API_KEY/DEEPSEEK_BASE_URL/DEEPSEEK_MODEL` secret env；未配置时跳过、不失败。

## 数据/前端
- 数据仍为 **BDFD1486…**（102 条，v1.8.0）不变；前端 dist **0727DFB1…** 不变。
- 9 路由/i18n/页面结构不变；本次只修自动化链路。

## 验收
- validate 20/20；unittest 102/102；无 key 模拟 `pipeline --all` + validate 20/20；数据/前端未变；冻结 MANIFEST；线上 `/` 与 `/v1.8.1/` 同 hash。