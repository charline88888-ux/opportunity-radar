# v1.7.0 开发文档（DEV）

> 版本：v1.7.0（MINOR）　｜　数据版本：data-v1.7.0　｜　日期：2026-10-24　｜　上一版：v1.6.0

## 用户要求
分析不是门禁；单项极强也可以成为商机；不要把“多源数量”当门槛；用 LLM 做深层商机判断；只做底层升级，不推翻 v1.6.0。

## 数据（1.7.0，纯增量）
- 102/102 候选新增 `analysis`：thesis、dominant_driver、strengths、weaknesses、unknowns、causal_chain(5 步)、entry_point、differentiation、commercial_structure(5 项)、evidence_refs、falsifiers、confidence、analysis_score、single_axis_strong、scenario、not_a_gate。
- DeepSeek 真实分析：provider=deepseek、model=deepseek-chat、usage 55,080 tokens、latency 594s、失败 0；71 条因果链二次修复；模板兜底 0。
- causal_chain 102/102 恰好 5 步；禁用词 验证/实验/复核/门禁 = 0；single_axis_strong 20；旧字段/102 条候选/顺序未变。
- validate 20/20（V20 analysis 校验）；unittest 102/102；cold determinism 使用缓存不重调 API；--all 幂等。

## 前端（1.7.0，纯增量）
- 详情新增「02A 商机分析」区块（核心判断之后，默认展开）：分析评分/主导型徽标/置信度/论点/主导驱动 chips/5 步因果链/切入点与差异点/商业结构 5 项/强项弱项未知/证伪条件/证据 chips/「分析≠门禁」说明。
- 榜单卡片新增「主导型机会」小徽标 + 可选「主导型 · 20」筛选（默认关，不改排序/布局）；精选无 analysis 自动隐藏区块。
- 方法论新增「商机分析」说明；现有 9 路由/图表/AOV/布局不变。
- 版本 1.7.0；i18n 16/16；1600/1024 无溢出；截图 15 张。

## 安全边界
- LLM 只做分析与假设，不做通过/淘汰；弱项只标注；现有候选全保留；精选 80 不变。
- 分析是理论判断、非收入承诺；证据引用必须来自现有候选 evidence。