# v0.4.0 变更明细（CHANGELOG）

> 日期：2026-10-22　｜　应用 0.4.0　｜　数据 data-v0.4.0　｜　类型：MINOR　｜　上一版：v0.3.1

## 新增（Added）
- 中英双语 UI：`lib/i18n.tsx` + `i18n-dict.ts`，顶栏语言切换（localStorage），`html lang`/`document.title` 同步；机会内容保持中文并标注；数据/日期格式随语言。
- `scanner/enrich.py`：AI 富化 outbox（offline-template 默认；可选 `--online` + LLM_API_KEY，OpenAI 兼容；key 不落盘、失败回退、dry-run 不落盘；needs_human；永不自动入库）。
- `scanner/calibrate.py`：实验导出 JSON → 校准/年度报告 `data/reports/calibration-<date>.html/.md`（Brier/等级×成功率/花费耗时/建议/免责）。
- `/alerts` 桌面通知开关（Notification API，可选、本地、失败降级）。
- docs/12 §1.3（v0.4.0 增量）；docs/04 §12 更新至 v0.3.1 实现口径。

## 修改（Changed）
- 数据版本 0.3.1 → 0.4.0（全部 meta、报告重生成、校准报告新增）；sources 68；source-health 8/8。
- 实验导出 schema v0.4.0（含 outcome/data_version），与 calibrate.py 联动。
- 前端版本 0.4.0；About 版本历史更新；构建可复现。
- 发布流程：GitHub 异常时用 `git -c http.version=HTTP/1.1 -c http.sslBackend=schannel` 重试（文档记录）。

## 修复（Fixed）
- v0.3.1 P2：Brier 展示/导出精度统一、i18n 初始未译项、`documentElement.lang` 同步。
- 双语切换不再丢失路由/筛选/画像状态。

## 数据版本
| 版本 | 变化 |
|---|---|
| v0.3.1 | sources 68、8/8 采集、history/reports meta 0.3.1 |
| v0.4.0 | 全部 meta 0.4.0；新增 calibration 报告 2 文件；sources/rankings/stats/history/source-health 重生成；opportunities 未变 |

## 已知限制
- 双语仅 UI，数据内容中文（已标注）；LLM 在线模式未实际调用（无 key，单测覆盖）；校准报告样例仅为演示；其余同 v0.3.1。

## 升级与回滚
- 升级：`git pull` → `pipeline.py --all` → `cd app && pnpm build` → 打开 `releases/v0.4.0/dist/index.html`。
- 回滚：`releases/v0.3.1/dist/index.html` 或线上 `/v0.3.1/`。