# v0.7.2 变更明细（CHANGELOG）

> 日期：2026-10-23　｜　应用 0.7.2　｜　数据 data-v0.7.0（内容未变）　｜　类型：PATCH　｜　上一版：v0.7.1

## 修复（Fixed）
- CI/tag deploy 失败：单元测试硬编码基准日 2026-10-22（报告空窗口断言、年鉴 generated_at、窗口偏移）→ 改为从 rankings.meta.as_of 推导/空态容错。
- MANIFEST 与 git blob 不一致（README/VERSION-README/docs-09 共 3 条）→ 发布前 LF 归一 + 版本级 gitattributes + 发布后 verify_manifest.py 复核。
- 冻结 dist 版本号滞后（显示 0.7.0）→ release.ps1 自动同步前端版本。

## 新增（Added）
- `scripts/verify_manifest.py`（git blob sha256 复核）。

## 已知限制
- 云端每日更新不新增机会；v0.7.1 tag 的 tag deploy 失败为历史事实，v0.7.2 起修复。