# v1.4.1 开发文档（DEV）

> 版本：v1.4.1（PATCH）　｜　数据版本：data-v1.4.0　｜　日期：2026-10-23　｜　上一版：v1.4.0

## 修复
- 1024 宽度下精选详情 `/opportunities/:id` 横向溢出：根容器 max-w/overflow-x-hidden、栅格 min-w-0、长标题/七问/来源链接 break-words/break-all、证据卡 min-w-0。
- 复核：9 路由 1024 overflow=0；数据/其他页面不变。

## 验收
- dist 3,327,185 B；data 1.4.0（63 候选）；9 路由/i18n；冻结 MANIFEST；线上 `/` 与 `/v1.4.1/` 同 hash。