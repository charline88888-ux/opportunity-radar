# v1.0.1 开发文档（DEV）

> 版本：v1.0.1（PATCH）　｜　数据版本：data-v1.0.1　｜　日期：2026-10-23　｜　上一版：v1.0.0

## 1. 修复
- 候选七问文案：删除所有「验证/实验/复核/门禁」措辞（400 处）；`seven_questions` 键改为 需求/人群/竞品/差异/渠道/成本/**跟踪**；one_liner 结尾统一「（自动发现线索，系统已初筛）」；系统评估 notes 去掉“验证个人商业结果”。
- stats 一致性：`today_new_candidates` 与候选 first_seen/日榜对齐（99）。
- 冷缓存 determinism：清空 translation-cache 后 candidates 冷跑字节=冻结、二次一致、`--all` 0 变化。
- 控制台相关文件/测试从产品移除（v1.0.0 已删，v1.0.1 清理残留）。

## 2. 保留
9 路由核心、商机榜（自动 200 + 精选 80）、候选/精选详情、扫描室、方法论、数据源、日历、关于；每日 Actions 扫描→评估→入榜。

## 3. 验收
- validate 20/20、unittest 95/95、`--all` 幂等；候选文案 grep 验证/实验/复核/门禁 = 0。
- 冻结/线上：MANIFEST 19/19、tag deploy+CI success、线上 `/` 与 `/v1.0.1/` 同 hash。