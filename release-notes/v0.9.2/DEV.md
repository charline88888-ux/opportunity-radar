# v0.9.2 开发文档（DEV）

> 版本：v0.9.2（MINOR）　｜　数据版本：data-v0.9.2　｜　日期：2026-10-23　｜　上一版：v0.9.1

## 1. 用户三问与修正
1) **验证边界**：商机是否成立 = 系统职责（system_validation 8 项检查，自动），实体验证 = 个人可选（默认 not_started，不影响收录/排序）；
2) **新商机英文**：候选 title_zh/one_liner_zh 中文化（200/200），原文保留；
3) **控制台一键更新 BUG**：daily-run.ps1 缺 UTF-8 BOM → PowerShell 5.1 解析失败；已修复并加 release 强制检查；job 日志中文解码修复。

## 2. 变更
- 候选：system_validation{verified_by_system, level, score, checks×8}；meta summary high53/medium133/low14（avg 92.9）；verification_status 语义实体验证，默认 not_started；stats 新增计数。
- 中文：title_zh/one_liner_zh/title_original/translation_method（template 194/source-zh 6）；中文覆盖率 100%。
- 源：rest-of-world XML 容错恢复；Arab News→Middle East Monitor；+8 源 → **168 平台/101 enabled/11 区域**；干净重跑 101/101 成功、2420 原始→1892 信号、new 1865/ledger 1865。
- 漏斗：outbox.funnel 真值（101/101/0；raw→1892→new1865→relevant344→candidates200）。
- serve：fetch `--fetch-limit 120`；job log `_decode_locale`；release.ps1 BOM 检查。

## 3. 验收
- validate 20/20、unittest 117/117、`--all` 双跑 0 变化；data 0.9.2；机会库 80 条不变。
- 前端：中文主标题、系统评估清单、实体验证可选区、漏斗修复；构建可复现；16 路由/i18n/截图。
- 冻结/线上：MANIFEST 19/19、tag deploy success、线上 `/` 与 `/v0.9.2/` 同 hash。

## 4. 已知限制
- 中文标题由模板生成（非人工翻译）；8 个 disabled 源保留原因；系统不保证盈利，实体验证可选。