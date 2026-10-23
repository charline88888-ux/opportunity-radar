# v0.7.2 运营文档（OPS）

> 版本：v0.7.2　｜　数据版本：data-v0.7.0　｜　日期：2026-10-23　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 本版要点
- CI/发布在「每日数据推进」后仍然通过；发布不再因 MANIFEST 哈希不一致而失败。
- 前端版本自动跟随发布版本（冻结 dist 显示 0.7.2）。
- 线上根为最新数据；`/v0.7.2/` 为冻结版本；历史版本归档保留。

## 2. 日常不变
- 双击 `启动机会雷达.bat` → 控制台一键更新/采集/启停每日任务（07:00 本机计划任务已启用）。
- 线上每天 06:30（北京时间）由 Actions 刷新根数据；无新机会时 day=0 属正常。
- 发布：`publish.ps1 -Version vX.Y.Z`（自动冻结+推送+校验）；MANIFEST 复核：`python scripts/verify_manifest.py --release releases/vX.Y.Z`。

## 3. 回滚
- 线上 `/v0.7.1/`、`/v0.7.0/`… 或本地 `releases/vX.Y.Z/dist/index.html`。