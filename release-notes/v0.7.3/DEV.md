# v0.7.3 开发文档（DEV）

> 版本：v0.7.3（PATCH）　｜　数据版本：data-v0.7.0（内容未改）　｜　日期：2026-10-23　｜　上一版：v0.7.2

## 1. 背景
用户点「立即更新数据」+「立即采集」后页面显示“信息和机会为零”，无法判断是采集失败还是今天没商机。实查：更新成功（as_of=2026-10-23、day=0、机会库 80 条仍在）；采集成功（183 条原始信号，8 源 7 成功），但信号只进 outbox、前端不可见，且 fetch 仍写 2026-10-22 文件。

## 2. 变更
- `pipeline.py --fetch --as-of YYYY-MM-DD`：outbox 文件名/meta.as_of 跟随日期；默认仍 taxonomy as_of；控制台「立即采集」自动带 rankings.meta.as_of；`scripts/daily-run.ps1` 传当天 as_of。
- 控制台 API：`/api/status.outbox` + `/api/outbox?limit=N`（摘要/by_source/top≤5/REVIEW.md；安全白名单）；
- 前端 `/control` 新增「采集收件箱」卡：最近采集文件/时间/原始 185/信号 183/来源分布/Top5 标题/REVIEW.md；空态与说明；
- 指挥台 `new_today=0` 解释卡：今天没有新机会入库（正常）+ 机会库总数 + 待复核信号数（控制台可用时）/control 链接；日榜空态文案同步。
- About/version 0.7.3。

## 3. 验证
- 后端 94/94、validate 20/20、fetch as-of/outbox API 红队 PASS；前端 strict 2,473,167 B / C917A934…、15 路由 zh/en、收件箱/零机会态实测、i18n 16/16。
- 冻结/线上：MANIFEST 19/19、dist 版本 0.7.3、线上 `/` 与 `/v0.7.3/` 同 hash、Actions tag deploy success。

## 4. 已知限制
- 采集信号质量参差（arxiv/hn 为主），需人工筛选；机会库仍人工增量（无自动入库）。
- 8 源中 itunes 评论 feed 当前返回空（已验证），其余 7 源正常。