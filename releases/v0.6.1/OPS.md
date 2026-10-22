# v0.6.1 运营文档（OPS）

> 版本：v0.6.1　｜　数据版本：data-v0.6.1　｜　日期：2026-10-23　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 本版运营重点：每天自动更新
- 一次性启用：`powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1 -Fetch`（每 07:00 推进当天 as_of + 采集 + 构建 `current/index.html`）。
- 失败：`scanner/logs/ALERT.txt` + Windows 通知；查 `daily-<date>.log`。
- 数据新鲜度：Dashboard/顶部横幅显示 as_of 与距今；>7 天红色警告。
- 当天没有新机会/新证据 → 日榜为空是正确结果（不是故障）；周/月/年榜仍由库内数据计算。

## 2. 日常节奏
| 时间 | 动作 |
|---|---|
| 07:00 | 计划任务自动跑；看 `/alerts` 是否还有「数据过期」 |
| 早上 | 打开 `current/index.html`（当天数据）或线上稳定版 |
| 每日 10 分钟 | 复核 outbox（enrich → 人工判断 → 入库） |
| 需要对外发布 | `publish.ps1 -Version vX.Y.Z`（冻结+push tag→Actions 自动上线） |
| 每月 | 加密数据包备份 + 校准报告 + 年鉴指标复盘 |

## 3. KPI
| 指标 | 数值 |
|---|---|
| 数据基准日 | 2026-10-22（发布基线） |
| 机会库 | 80（14 行业/11 区域/53 国家/12 信息差/32 verified） |
| 数据版本 | 0.6.1 |
| 自动任务 | daily-run.ps1（已实测）；计划任务已实测创建/删除，未长期驻留 |
| 线上 | v0.6.1（tag 触发 Actions 部署） |

## 4. 注意
- 自动任务只更新工作副本 `current/`，**不改变**冻结版 `releases/`；对外发布仍需版本流程。
- 采集是显式联网且限速；产物不进机会库，人工复核后才入库。
- 若 Actions 部署失败：手动 `deploy-pages.ps1 -Version vX.Y.Z` 兜底。

## 5. 下一版动作
1. 观察 1 周自动任务稳定性（开机率/失败率/采集成功率）。
2. 清理失败源、补充新源，把采集成功率维持 8/8。
3. 准备 v0.7.0：机会库 120+、团队只读 bundle、证据 quote 规范化。