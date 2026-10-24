# v1.6.0 开发文档（DEV）

> 版本：v1.6.0（MINOR）　｜　数据版本：data-v1.6.0　｜　日期：2026-10-24　｜　上一版：v1.5.3

## 用户要求
①扩源把高质量商机从 63 恢复到 100–150；②统一候选/精选 AOV 口径。

## 数据（1.6.0）
- 源：**206 平台 / 129 enabled**；新增 researcher P0 10 源 + 23 个区域/语言 Google News 查询 + 8 产业媒体；禁用 6 个失效源，恢复 3 个可用源。
- 漏斗：fetch **142 尝试 / 139 成功 / 3 失败**；raw **3392** → 信号 **2804** → new **1788** → business **449** → **候选 102**（目标 100–120）。
- 标题：102/102 唯一、无英文整句、无泛化、无「监管变化」凑数；11 条机译残句/IPO 噪声剔除；60 条英文具体信号由人工/模型中文标题 override。
- AOV 统一：候选+精选 `aov_source=roi_reverse`、`aov_basis=ROI 月收入/理论月单量`；`unit_economics.price_per_unit`=`profit_model.unit_price`；顶层 `aov` 同源。
- 数据 1.6.0；unittest 102/102；validate 20/20；cold determinism；--all 稳态 changed=0。

## 前端（1.6.0）
- 版本/Aboout/EN banner；AOV 卡下新增「AOV 口径：ROI 月收入/理论单量 [roi_reverse]」小字（hover aov_basis）。
- 既有 v1.5.3 图表口径（资金 0 基线、真瀑布勾稽、敏感性盈亏竖线、donut 居中、标签≥12）在 102 数据下回归正常。
- 9 路由；i18n 16/16；1600/1024 无溢出；截图 final-v1.6.0 18 张。

## 验收
- dist 6,055,147 B；两次 build 同 hash；冻结 MANIFEST；线上 `/` 与 `/v1.6.0/` 同 hash。