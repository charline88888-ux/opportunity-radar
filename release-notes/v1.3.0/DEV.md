# v1.3.0 开发文档（DEV）

> 版本：v1.3.0（MINOR）　｜　数据版本：data-v1.3.0　｜　日期：2026-10-23　｜　上一版：v1.2.1

## 1. 用户反馈
v1.2.1 只是展开，字号排版不合理、看不清、没有重点、不像专业商业评估；要求数据模块图形化、专业深度释义。

## 2. 数据
- 每条候选新增 `analyst_narrative` 6 段连贯散文：thesis / market / competition / cross_market / timing / verdict；引用实体/数字/行业/区域，禁用词 0。
- 国家/地区 39 条、机构 8 条中文化；事件词 policy/funding/launch/partnership/demand/cost/market 中文化；window_stage 窗口打开/收窄/关闭；“检验单位经济”→“校准单位经济”。
- 数据 1.3.0；validate 20/20；unittest 100/100；cold determinism；--all 幂等；四窗口 99/200/200/200。

## 3. 前端
- 专业评估报告式布局：正文 15–16px/行高 1.7；H1 34；区块标题 20；大留白。
- Hero：标题+一句话结论+评分 gauge；4 个大 KPI（34px）。
- 左栏：核心判断段落（narrative）+ 10 维雷达+分数条+rationale/data_used + 9 格画布 + 竞争矩阵/差异化 + 跨市场 + 执行 timeline。
- 右栏 sticky：利润 donut、窗口进度、条件/门槛、来源。
- 商机榜/首页大卡：19px 标题、评分、3 KPI、why 两行、标签；精选同组件。
- 9 路由；i18n 16/16；1024；无验证/实验文案。

## 4. 验收
- dist 5,855,872 B；flows/routes/i18n/截图；冻结 MANIFEST；线上 `/` 与 `/v1.3.0/` 同 hash。