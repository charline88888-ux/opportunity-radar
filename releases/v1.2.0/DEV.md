# v1.2.0 开发文档（DEV）

> 版本：v1.2.0（MINOR）　｜　数据版本：data-v1.2.0　｜　日期：2026-10-23　｜　上一版：v1.0.1

## 1. 方向
用户确认：去掉验证/实验等功能不等于把商机评估做浅；主线只有“发现全球商机”。每条候选必须是一份可解释的商机说明书。

## 2. 数据
- 每条候选新增：`business_canvas` 9 块；`judgment`（10 维 score/rationale/data_used、why_opportunity、not_opportunity_if、primary_industry、event_type）；`competition`；`cross_market`；`timing`；`conditions`；`barriers`；`profit_model`（revenue_streams/revenue_model/毛利/回本/规模化）；`execution_plan`（0-30/30-90/里程碑/首笔收入）；`sources`。
- 生成依据：14 行业知识包 + 12 信息差 + 11 区域规则 + 事件类型；实体清洗与主行业纠偏；200/200 画布唯一、实体/数字引用；禁用词 0。
- 数据 1.2.0；validate 20/20；unittest 98/98；cold determinism；--all 幂等；四窗口 99/200/200/200。

## 3. 前端
- 候选详情升级为“商机评估说明书”：摘要+分区（画布/为什么/竞争/跨市场/时机/条件门槛/利润/执行/来源）；方法论页解释 10 维判断标准与常见误判。
- 9 路由不变；zh/en；i18n 16/16；无验证/实验文案。

## 4. 边界
- 系统评估商机成立度（信号/信息差/可行性/经济性/时机/竞争/风险/匹配/证据/杠杆），不验证个人商业结果、不承诺盈利。
- 执行方案是落地步骤，不是验证清单。