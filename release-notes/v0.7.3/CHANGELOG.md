# v0.7.3 变更明细（CHANGELOG）

> 日期：2026-10-23　｜　应用 0.7.3　｜　数据 data-v0.7.0（内容未改）　｜　类型：PATCH　｜　上一版：v0.7.2

## 新增（Added）
- 控制台「采集收件箱」：最近采集文件/时间/原始 185/信号 183/来源分布/Top5 标题/REVIEW.md；空态与刷新。
- `/api/status.outbox`、`/api/outbox?limit=N`（只读、安全字段、无绝对路径）。
- 指挥台「今天没有新机会入库」解释卡 + 日榜空态文案；控制台可用时显示待复核数并链接 /control。

## 修改（Changed）
- `pipeline.py --fetch --as-of YYYY-MM-DD`；控制台采集/fetch 自动带 rankings as_of；daily-run 传当天 as_of。
- 前端 0.7.3；docs/README 同步。

## 已知限制
- 原始信号需人工复核入库；itunes 源当前空；采集源以公开 RSS/JSON 为主。