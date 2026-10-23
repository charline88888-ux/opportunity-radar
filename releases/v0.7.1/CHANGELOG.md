# v0.7.1 变更明细（CHANGELOG）

> 日期：2026-10-23　｜　应用 0.7.1　｜　数据 data-v0.7.1　｜　类型：PATCH　｜　上一版：v0.7.0

## 修复（Fixed）
- 每日云端更新在非基准日（日榜为空）因前端 strict 自检旧配额（day≥6 等）而构建失败 → 配额改为仅基准日 2026-10-22 强制，其他 as_of 只校验结构并允许空榜（与 validate V08 一致）。
- tag 部署 workflow 的 `cancel-in-progress` 由 true 改 false，避免取消每日数据部署。

## 修改（Changed）
- 清理测试遗留 `jobid*.txt` 并加入 gitignore；数据版本 0.7.0 → 0.7.1；前端 0.7.1；报告/年鉴重生成。

## 已知限制
- 云端每日更新不新增机会（人工复核）；GitHub 调度可能延迟；Actions 失败时线上保留旧数据。