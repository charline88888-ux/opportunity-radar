# v0.7.0 运营文档（OPS）

> 版本：v0.7.0　｜　数据版本：data-v0.7.0　｜　日期：2026-10-23　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 每天怎么用（推荐流程）
1. 双击 `启动机会雷达.bat`（首次会打开控制台；之后可设置登录自启动）；
2. 控制台点「立即更新数据」→ 等完成 → 刷新/打开工作副本；
3. 需要新信号：点「立即采集」→ `scanner/outbox/` 人工复核后入库；
4. 想省事：点「启用每日自动」→ 每天 07:00 本机自动更新；
5. 线上：无需操作，每天 06:30 GitHub Actions 自动刷新根目录数据。

## 2. 三个入口的区别
| 入口 | 数据 | 用途 |
|---|---|---|
| `current/index.html`（控制台生成） | 当天/最近一次本地更新 | 个人最新工作副本 |
| 线上 `/` | 每天 06:30 云端刷新 | 手机/外网查看最新数据 |
| 线上 `/vX.Y.Z/` | 冻结版本（只读） | 回滚/对比/历史归档 |

## 3. 定时任务管理
- 启用：控制台按钮，或 `scripts/install-daily-task.ps1 -Fetch`；
- 停用：控制台按钮，或 `scripts/install-daily-task.ps1 -Uninstall`；
- 自启动控制台（可选）：`scripts/install-console-autostart.ps1`；
- 日志：`scanner/logs/daily-<as_of>.log`、`console.log`；失败：`ALERT.txt` + Windows 通知。

## 4. 发布新版本
`publish.ps1 -Version vX.Y.Z`（冻结→push tag→Actions 自动部署），线上 `/vX.Y.Z/` 归档自动生成。

## 5. 注意
- 网页按钮只在本地控制台运行时有效；线上静态页会在控制台显示未启动引导（正常）。
- 机会库新增仍需人工研究/复核；自动更新不改变机会条目。