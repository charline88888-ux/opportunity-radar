# v0.5.0 变更明细（CHANGELOG）

> 日期：2026-10-22　｜　应用 0.5.0　｜　数据 data-v0.5.0　｜　类型：MINOR　｜　上一版：v0.4.0

## 新增（Added）
- `/yearbook` 年度复盘页：年榜 Top20、月度时间线、分布、A 级清单、窗口关闭、规则化年度建议、导出年鉴 MD/HTML。
- `scanner/yearbook.py`：年度年鉴 HTML/MD（自包含可打印、确定性、可选实验/Brier 摘要）。
- `/data` 个人数据包：导出/导入（校验/预览/覆盖或合并），多设备手动迁移。
- `lib/rec_log.ts` 推荐记录 + `/calibration` 推荐漏斗（曝光去重/查看/实验/命中率/忽略）；校准导出含 rec_log 摘要。
- docs/12 §1.4（v0.5.0 增量）；docs/00/06/07/08/10、README 同步。

## 修改（Changed）
- 数据版本 0.4.0 → 0.5.0（全部 meta、四窗口/校准/年鉴报告重生成）；unittest 45→50。
- 前端 14 路由；i18n 残差清理；About/版本历史更新。
- 构建可复现；发布流程沿用 release+deploy（GitHub 异常用 HTTP/1.1+schannel）。

## 修复（Fixed）
- v0.4.x 遗留：i18n 静态残差、校准页后端报告入口说明、通知细节。
- 数据包导入旧版本/坏文件提示；合并去重规则。

## 数据版本
| 版本 | 变化 |
|---|---|
| v0.4.0 | 46 机会 / 68 源 / 8/8 采集 / calibration 报告 |
| v0.5.0 | 全部 meta 0.5.0；新增 yearbook 报告；四窗口/校准重生成；机会库未变 |

## 已知限制
- 年度建议规则生成非投资建议；数据包明文（自行保管）；rec_log 上限 500；LLM 在线模式无 key 未真实调用；年鉴为年度快照，不替代日常榜单。

## 升级与回滚
- 升级：`git pull` → `pipeline.py --all` → `yearbook.py --year 2026` → `cd app && pnpm build` → 打开 `releases/v0.5.0/dist/index.html`。
- 回滚：`releases/v0.4.0/dist/index.html` 或线上 `/v0.4.0/`；数据包 0.5 导入 0.4 导出需升级提示。