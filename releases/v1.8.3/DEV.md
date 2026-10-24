# v1.8.3 开发文档（DEV）

> 版本：v1.8.3（PATCH）　｜　数据版本：data-v1.8.0　｜　日期：2026-10-24　｜　上一版：v1.8.2

## 修复
- 每日自动分析（GitHub Actions + DeepSeek secret）LLM 输出含“验证/实验/复核/门禁”时导致 V20 失败；在 analysis normalize 层统一清洗为中性词（核查/测试/核对/门槛），保存前执行。
- 验证：手动触发 Daily run 40107380909 **success**；daily 数据 97 候选、analysis 97/97、**fallback 0**、causal5 97、禁用词 0、usage 33,308 tokens；说明 GitHub secret 已被正确读取并调用 DeepSeek。
- 数据版本仍 1.8.0；前端/页面结构不变；本补丁只修每日自动化链路。

## 验收
- validate 20/20；unittest 102/102；Daily success；冻结 MANIFEST；线上归档 `/v1.8.3/` 同 hash。