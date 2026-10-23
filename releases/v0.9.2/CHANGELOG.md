# v0.9.2 变更明细（CHANGELOG）

> 日期：2026-10-23　｜　应用 0.9.2　｜　数据 data-v0.9.2　｜　类型：MINOR　｜　上一版：v0.9.1

## 修复（Fixed）
- 控制台「立即更新数据」失败：daily-run.ps1 缺 UTF-8 BOM（PowerShell 5.1 解析中文失败）→ 恢复 BOM + release.ps1 强制检查；job 日志中文乱码修复。
- 控制台漏斗计数（92/92/0）→ 以 source-health 真值（101/101/0）。
- fetch 默认 60 源 → serve fetch 改为 --fetch-limit 120（全量 enabled）。
- rest-of-world XML 未转义恢复；Arab News 403 换源。

## 新增/修改
- 商机系统评估 system_validation（8 项检查/等级/评分/verified_by_system）；verification_status 改为实体验证（可选，不影响排序）。
- 候选中文化 title_zh/one_liner_zh/title_original/translation_method（200/200）。
- 源 168 平台/101 自动/11 区域；101/101 成功、2420→1892、new 1865；发现榜日99/周200/月200/年200。
- 数据/前端 0.9.2；报告/年鉴/校准重生成。