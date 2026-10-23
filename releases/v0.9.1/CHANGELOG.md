# v0.9.1 变更明细（CHANGELOG）

> 日期：2026-10-23　｜　应用 0.9.1　｜　数据 data-v0.9.1　｜　类型：MINOR　｜　上一版：v0.9.0

## 新增/修改
- 源：125→160 平台；57→91 自动源；25 个实测 RSS 并入（24 成功）、GN TR+3 query、App Store 6 国；rest-of-world/Arab News 失败标 false+原因。
- 采集：92 尝试/91 成功、2177 原始→1653 信号、new 1627/seen 26/ledger 1627。
- 候选：清洗、canonical URL 最新、gap 兜底 100%、region 11/11、country 28；四窗口 day95/week200/month200/year200；stats today_new_candidates=95。
- 前端：源 160/91/11 展示、发现榜 gap 覆盖率/详情增强。
- 数据/前端 0.9.1；报告/年鉴/校准重生成；验证解耦原则不变。

## 已知限制
- 2 新源失败；候选规则推断可能不准确；系统不保证盈利。