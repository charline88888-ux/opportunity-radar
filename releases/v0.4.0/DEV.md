# v0.4.0 开发文档（DEV）

> 版本：v0.4.0（MINOR）　｜　数据版本：data-v0.4.0　｜　日期：2026-10-22　｜　上一版：v0.3.1
> 冻结目录：`releases/v0.4.0/`　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 本版目标

从「自用工具」走向「可分享、AI 辅助、可年度复盘」：中英双语 UI、AI 富化 outbox（人工复核门禁）、实验校准/年度报告、预警桌面通知；并纳入 v0.3.1 的 P2 修复（Brier/严格资金/告警重提醒/采集修复）。

## 2. 变更

### 2.1 中英双语 UI（前端）
- `lib/i18n.tsx` + `i18n-dict.ts`：zh/en 字典覆盖全部静态 UI；顶栏切换（localStorage 持久化），`<html lang>`/`document.title` 同步，日期/数字随语言；切换不刷新、保留路由/筛选/画像状态。
- 机会数据（标题/证据/七问等）保持中文，EN 模式明确标注 "Opportunity content is Chinese-only in v0.4.0"。
- 覆盖率自查：`_i18n-extract` 提取 + 未译清单 `_i18n-unexplained` 归零（数据内容除外）。

### 2.2 AI 富化 outbox（数据/扫描器）
- `scanner/enrich.py`：读 `scanner/outbox/signals-*.json` → `enriched-*.json` + `REVIEW.md`；默认 **offline-template**（无网络/无 key，标签映射 + 七问草稿 + 语言启发式 + 证据透传，`needs_human:true`）；可选 `--online` + `LLM_API_KEY`（OpenAI 兼容、key 不落盘、失败回退、`--dry-run` 不落盘）。
- 实测：211 条候选 / 0 跳过；**永不自动写 opportunities.json**（单测断言）；outbox 全部 gitignore。

### 2.3 实验校准/年度报告（数据/扫描器）
- `scanner/calibrate.py --experiments <导出 JSON>` → `data/reports/calibration-<date>.html/.md`：样本数、结果分布、等级×成功率、**Brier**（p=clamp(total/100)，o=pos1/neg0，inconclusive 排除；样例 N=5 Brier=0.2338，基线 0.25）、花费/耗时、建议、免责。
- 与 `/calibration` 前端导出 schema v0.4.0 联动。

### 2.4 预警桌面通知（前端）
- `/alerts` 开关：Notification API 本地通知（需授权；页面打开时新高严重度预警触发）；不支持/被拒优雅降级；不上传。

### 2.5 数据版本
- data-v0.4.0（MINOR）：元数据升级、报告重生成、校准报告新增；validate 20/20；unittest 45+；`--all` 幂等。

### 2.6 文档
- docs/12 增 §1.3（v0.4.0 增量：实验导出/校准报告/enrich outbox/双语 UI）。
- docs/04 §12 更新至 v0.3.1 实现口径（Brier 已实现+clamp、导出 schema、O1/O3/O4/O5 闭环、告警 id）。
- docs/00/06/07/08/10、README、release-notes 同步 v0.4.0。

## 3. 架构

```
--fetch → outbox/signals-*.json → enrich.py → outbox/enriched-*.json + REVIEW.md → 人工复核 → opportunities
/lab → /calibration 导出 experiments.json → calibrate.py → data/reports/calibration-*.html/.md
zh/en 双语展示层（i18n 字典），数据内容保持中文
```

## 4. 验收

| 项目 | 结果 |
|---|---|
| 数据 | validate 20/20 PASS；unittest 45+；--all 幂等；data 0.4.0 |
| enrich | offline 211 候选/0 跳过；needs_human；dry-run 不落盘；无 key 清晰报错；不入库 |
| calibrate | 样例 N=5 Brier=0.2338；报告 HTML/MD 可打开；边界 0/2/6 条；与 docs/04 公式一致 |
| 前端 | build strict（real、mock=[]）；12 路由 zh/en 抽查；无 console error/1024 溢出；构建可复现 |
| 冻结 | 见 `releases/v0.4.0/MANIFEST.json`（红队核验） |
| 线上 | 根 `/` 与 `/v0.4.0/` = 冻结 dist；旧版归档不串台；versions.json latest=v0.4.0 |

## 5. 已知问题
- 双语只覆盖 UI，机会内容仍中文（v0.4.0 明确标注）；LLM 在线模式未实际调用（无 key，仅单测覆盖回退）；校准报告样例数据仅为演示，真实结论需 ≥3 条已决实验。
- 其余同 v0.3.1（verified 5 条、localStorage 不跨设备、单文件约 2.2MB）。

## 6. 下一版（v0.4.1 / v0.5.0）
- v0.4.1：双语覆盖细节、i18n 持久化测试、LLM 在线模式真实调用（用户自备 key）、校准报告并入前端展示。
- v0.5.0：个人画像 ↔ 机会库的自动匹配记录、年度年鉴生成、团队/多设备同步方案（可选）。