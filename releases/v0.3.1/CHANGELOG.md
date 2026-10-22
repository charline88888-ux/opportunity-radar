# v0.3.1 变更明细（CHANGELOG）

> 日期：2026-10-22　｜　应用 0.3.1　｜　数据 data-v0.3.1　｜　类型：PATCH　｜　上一版：v0.3.0

## 修复（Fixed）
- 采集 3 源失败 → 8/8 成功：reddit（改 manual + lobsters 替代）、itunes-reviews（GB storefront + feed.entry 解析）、shopify-changelog（官方 feed.xml）。
- 采集参数：timeout 12→20s、UA 升级；限速/缓存/重试/合规不变。
- docs/04 §12 示例与真实数据不一致（v0.3.0 已修，纳入本版发布快照）。

## 新增（Added）
- 校准页 **Brier 分数**（含基线对比、N、导出 JSON/MD）；单桶样本 <3 提示。
- 画像 **严格资金过滤** 开关（默认关，按 ROI 启动资金硬过滤）。
- 预警 id 含 **data_version**（升版自动重提醒）；source 告警用 checked_at。

## 修改（Changed）
- 数据版本 0.3.0 → 0.3.1（全部 meta）；sources 67→68；source-health 8/8；三份 history 与 8 份报告按 0.3.1 重生成。
- 前端构建可复现（sync 时间戳改用数据 generated_at）；dist 2,147,394 B / SHA256 7C2E13D5…。
- 版本 0.3.1；About/README/docs 同步。

## 数据版本
| 版本 | 变化 |
|---|---|
| v0.3.0 | 68→67 源（历史）… |
| v0.3.1 | sources 68、source-health 8/8、history/reports meta 0.3.1；opportunities 指纹未变 |

## 已知限制
- reddit 本机网络不可达（人工浏览）；Apple customerreviews 仅部分 storefront 有数据。
- Brier N=6，样本不足；其余同 v0.3.0。