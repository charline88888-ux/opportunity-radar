# v1.5.0 数据独立复验（2026-10-23 23:30）

> 数据：candidates 6EBF4411…/63；opportunities 0E8EE6A4…/80；economy.py 8341FE34、candidates.py 7A8652FF。复验人：redteam。
> 结论：**字段/结构完整，但经济测算存在 P1 一致性问题，建议修复后再冻结。**

## PASS
- 自动候选 63/63 与精选 80/80 均含 investment_breakdown（9 项）/unit_economics/profit_model；精选 80 均含 business_canvas/judgment/analyst_narrative/competition/cross_market/timing/conditions/barriers/execution_plan。
- investment_breakdown 分项合计 == total_min/total_max（全部通过）；候选 IB total 与 roi.capital/conditions 对齐（0 mismatch）；unit economics 价格-成本=毛利/月收入/月利润 min 公式通过；sensitivity 3–5 点；无结构缺失。
- 精选 80 的 id/title/one_liner/seven_questions/evidence_count/verified 与 v1.4.1 完全一致（内容保留通过）。

## P1（阻塞）
1) **毛利率 min/max 全部倒置（143/143）**：candidates 63/63、opportunities 80/80 `gross_margin_pct.min > max`（例 cand-5c555f56997d 70/40、opp-pet-memorial-glass-001 60/35；按“最低价/最低成本”与“最高价/最高成本”场景计算分别为 70%/40%、60%/35%）。`min/max` 语义错误，UI 若显示“毛利率 70–40%”不可读；应重算为真实区间（或改名 margin_at_low/high）并满足 min≤max。
2) **精选 80 投资/回本与 roi 不一致**：`investment_breakdown.total` 与 `roi.capital_cny` **79/80 不一致**（例 opp-pet-memorial-glass-001：IB 50k–150k vs roi 3k–8k；conditions 30k–150k）；`unit_economics.payback_months` 与 `roi.payback_months` **80/80 不一致**（例 roi 5 个月 vs UE 1.0–68.5 个月）；data-engineer 声称“合计对齐 roi capital”不成立。
3) **候选回本范围与 roi 不一致 63/63**（例 cand-5c555f56997d roi 12 vs UE 0.1–242）；`unit_economics.payback` 的 min/max 由投资极值/利润极值组合产生，范围极端（0.1–277 个月），与 roi 单值相差大，需明确 UI 展示口径。
4) **3 条候选月利润 max 公式不一致**：cand-d6e36d9268b7 / 9695c369a9e6 / fa2f0eaa7f67，`monthly_profit.max=628200`，但 revenue max−variable max−fixed max=0；疑似固定成本重复扣减/公式写错。
5) **1 条候选 JSON 含 "None" 字面量**（cand-d9fa657bbd1e），需定位字段/清除。

## P2
- opportunities 文本仍有「验证」11 处/「复核」8 处（精选历史文案/verified 字段；candidate 0）；若 v1.5 要求全站无验证类词，需清洗并改指纹。
- 投资分项 note/basis 是否为最小/最大口径需在字段字典说明；月度单量/收入为理论推算（未实盘）需 UI 明确标注。

## 建议
- 修 margin 字段语义/数值、精选 IB→roi/conditions 映射、payback 口径、3 条 profit 公式、None；补 unittest 断言（min≤max、IB==roi、payback==roi、profit 公式）。
- 修复后提供最终指纹，我再跑 unittest/validate/cold/--all 与前端 9 路由/i18n/冻结线上终验。
