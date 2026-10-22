# v0.6.1 开发文档（DEV）

> 版本：v0.6.1（PATCH）　｜　数据版本：data-v0.6.1　｜　日期：2026-10-23　｜　上一版：v0.6.0
> 冻结目录：`releases/v0.6.1/`　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 本版目标
解决「数据怎么每天更新」：`--as-of` 真实推进、每日自动任务与失败告警、发布自动化（GitHub Actions）、前端数据新鲜度可视化。

## 2. 变更
### 2.1 扫描器
- `pipeline.py --as-of YYYY-MM-DD`（作用于 --all/--rank/--stats；report/yearbook 跟随；非法日期 exit 2；同输入双跑字节一致）。
- 实测 as_of=2026-10-23 → day 0/week 49/month 57/year 80；2026-11-01 → month 0；2027-01-01 → 全 0，均 validate 20/20。
- validate：V08 完整配额仅基准日 2026-10-22 强制；其他 as_of 仅结构校验、允许空榜；V07/V09/V14/V19 使用 meta.as_of。
- 新增 6 条单测（共 64）：resolve_as_of、窗口偏移、V08 两模式、report as_of、yearbook 取 rankings as_of。
- 数据 0.6.1；报告/年鉴/校准重生成。

### 2.2 自动化脚本
- `scripts/daily-run.ps1`：当天 as_of → `--all` → 可选 `--fetch` → validate → `pnpm build` → `current/index.html`；失败 ALERT.txt + Windows 通知；自动清理晚于 as_of 的历史快照（支持回填/重跑）；日志 `scanner/logs/daily-<as_of>.log`。
- `scripts/install-daily-task.ps1`：改为调度 daily-run（默认 07:00，可 -Time/-Fetch/-Uninstall）；已实测创建/查询/删除。
- `scripts/build_site.py`：从 `releases/*` 组装 Pages 站点（根=最新、历史归档、versions.json、404、.nojekyll），本地可验证。
- `scripts/publish.ps1`：release → push main/tag → 等 Actions 自动部署并校验线上 latest。
- `.github/workflows/ci.yml`（push/PR：validate+unittest+strict build+build_site 干跑）与 `deploy-pages.yml`（push tag `v*`：校验冻结版本→组装→部署 gh-pages）。

### 2.3 前端
- 数据新鲜度：as_of + 距今天数；≤2 天正常、3–7 天琥珀提示、>7 天红色全站横幅（可关闭，提示 daily-run）。
- `/alerts` 新增「数据过期」规则（>7 天严重、3–7 天注意，id 含 as_of）。
- About 新增「数据更新方式」；`/data` 显示基准日/最新采集时间/current 提示；版本 0.6.1。
- 14 路由 zh/en；构建可复现；截图 24 张（含新鲜度三态）。

## 3. 验收
| 项 | 结果 |
|---|---|
| 数据 | validate 20/20；unittest 64；--all 幂等；data 0.6.1；as_of 多日期测试通过 |
| 每日任务 | 失败路径写 ALERT+退出 1；成功路径 pipeline/validate/build/current 完成；计划任务创建/删除实测 |
| 发布链 | build_site 本地组装成功；tag 触发 Actions 自动部署（以线上 latest 校验为准） |
| 前端 | strict real/mock=[]；14 路由 zh/en；新鲜度三态实测；i18n 16/16 |
| 冻结/线上 | MANIFEST sha256；线上 `/` 与 `/v0.6.1/` 同 hash |

## 4. 已知问题
- 计划任务默认「用户登录时运行」，电脑需开机且已登录；无系统级告警（仅 ALERT + 本地通知）。
- `--fetch` 产物仍需人工复核入库；CI 不自动改机会库。
- 真实 Actions 首次运行依赖仓库 Actions 权限；失败可回退 `deploy-pages.ps1` 手动发布。

## 5. 下一版（v0.7.0）
机会库 120+、团队只读 bundle 原型、证据 quote 规范化、年鉴前后端报告联动。