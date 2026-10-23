# v0.7.2 开发文档（DEV）

> 版本：v0.7.2（PATCH）　｜　数据版本：data-v0.7.0（内容未变）　｜　日期：2026-10-23　｜　上一版：v0.7.1

## 1. 本版目标
修复 v0.7.1 的发布阻断：CI/tag deploy 因单元测试硬编码基准日 2026-10-22 而失败；MANIFEST 3 个文件哈希与 git blob 不一致；冻结 dist 版本号落后。

## 2. 变更
- 测试与每日 as_of 解耦：`test_generate_reports` 空窗口容错；`test_deterministic_double_run` 的 generated_at 从 `rankings.meta.as_of` 推导；`test_rank_windows_shift_with_as_of` 完全日期无关。
- release.ps1：发布前同步前端版本（app/package.json、app/src/lib/data.ts、AppShell）；发布目录文本统一 LF；写入版本级 `.gitattributes`（`releases/vX.Y.Z/** text eol=lf`，历史版本不受影响）；提交后执行 `scripts/verify_manifest.py`，以 git blob 逐字节复核 MANIFEST sha256，不一致则发布失败。
- 新增 `scripts/verify_manifest.py`（可独立用于任何版本/rev 的复核）。

## 3. 验证
- 本地：unittest 89/89（as_of=2026-10-22 与模拟 2026-10-23 两种数据均通过）；validate 20/20；`--all` 幂等；数据指纹不变。
- 发布：`verify_manifest.py --release releases/v0.7.2` → 19/19 一致；tag deploy workflow 成功；线上根与 `/v0.7.2/` 同 hash；旧 tag/归档不串台。

## 4. 已知限制
- 云端每日刷新只更新窗口/历史/统计，不新增机会；计划任务需开机登录。
- v0.7.1 的 tag 保留（历史），其 tag deploy 失败但线上内容已由 daily workflow/后续版本覆盖；使用 v0.7.2+。

## 5. 下一版
控制台任务历史/信号 inbox、机会库 120+、团队只读 bundle、证据 quote 规范化。