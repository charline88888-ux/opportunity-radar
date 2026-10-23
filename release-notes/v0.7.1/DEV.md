# v0.7.1 开发文档（DEV）

> 版本：v0.7.1（PATCH）　｜　数据版本：data-v0.7.1　｜　日期：2026-10-23　｜　上一版：v0.7.0
> 冻结目录：`releases/v0.7.1/`　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 本版目标
修复 v0.7.0 每日云端更新的构建阻断：Actions `daily-update` 在非基准日（day 窗口为空）触发前端 strict 自检的旧配额 → build 失败 → 每日数据无法上线。

## 2. 变更
- `app/scripts/sync-data.mjs`：榜单配额仅在基准发布日 2026-10-22 强制；其他 as_of 只校验结构（rank 连续/排序/opp_id 存在）并允许空榜，与 `validate.py` V08 口径一致；输出文案同步说明「非基准日仅结构校验、允许空榜」。
- `.github/workflows/deploy-pages.yml`：`cancel-in-progress: false`，避免 tag 部署取消每日数据部署（两者共用 `pages-deploy` 并发组）。
- 清理测试遗留 `jobid*.txt`（gitignore）。
- data 版本 0.7.1；报告/年鉴/校准重生成；前端版本 0.7.1。

## 3. 验证
- 模拟非基准日：`scripts/daily-run.ps1 -AsOf 2026-10-23` → pipeline/validate/build 全过（day 0 时 strict 不再失败），随后清理 10-23 快照并恢复基准日（validate 20/20、history 3 份）。
- 冻结后 push tag v0.7.1 → Actions tag 部署成功；手动 dispatch `daily-update` 验证 root=live_as_of 当天、`/v0.7.1/` 冻结归档、versions.json 正确。
- MANIFEST 19/19；线上 hash 与冻结 dist 一致。

## 4. 已知问题
- GitHub 调度可能延迟；每日更新不新增机会（人工复核）；Actions 失败仍以线上旧数据兜底。

## 5. 下一版
控制台任务历史/信号 inbox、机会库 120+、团队只读 bundle、证据 quote 规范化。