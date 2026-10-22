# v0.5.0 开发文档（DEV）

> 版本：v0.5.0（MINOR）　｜　数据版本：data-v0.5.0　｜　日期：2026-10-22　｜　上一版：v0.4.0
> 冻结目录：`releases/v0.5.0/`　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 本版目标

把「日/周/月」的使用闭环延伸到「年度复盘 + 数据可携带 + 推荐可度量」：年度年鉴页与后端可打印报告、个人数据包导入导出（多设备手动迁移）、推荐曝光/行动漏斗、i18n 残差清理。

## 2. 变更

### 2.1 年度年鉴（前端 `/yearbook` + 后端 `scanner/yearbook.py`）
- 年榜 Top20、月度活动时间线（12 个月，按 activity_dates 聚合，含主题 Top2）、行业/区域/信息差/等级/窗口分布、A 级清单、窗口关闭/≤3 月机会、评分分布；规则化「年度 3 个方向建议」（标注非投资建议）。
- 浏览器可导出年鉴 MD/HTML；后端 `python scanner/yearbook.py --year 2026 [--experiments <导出 JSON>]` 生成 `data/reports/yearbook-2026.html/.md`（自包含可打印、generated_at 确定性、可选实验/Brier 摘要）。实测：46 机会/Top20/A11/Brier 0.2338（样例）。

### 2.2 个人数据包（前端 `/data`）
- 导出单个 JSON：`{schema_version:"0.5.0", exported_at, profile, experiments, alerts_state, rec_log, settings}`；导入校验/预览/覆盖或合并（按 id 去重取较新）；错误/旧版本提示；纯本地、不上传。

### 2.3 推荐记录与漏斗（前端）
- `lib/rec_log.ts`：记录 `impression/view/experiment/dismiss`（上限 500 滚动，impression 每会话去重）。
- `/calibration` 推荐漏斗：曝光去重机会数 → 查看 → 加入实验、命中率、忽略数；校准导出附带 rec_log 摘要（可选字段，不破坏 v0.4 schema）。

### 2.4 收尾
- i18n 残差清理（新页面完整双语）；`/calibration` 增加后端校准报告说明；通知开关细节复核。
- 数据版本 0.5.0（全部 meta、四窗口/校准/年鉴报告重生成）；validate 20/20；unittest 50；`--all` 幂等。

## 3. 架构

```
data/* → pipeline → rankings/stats/history；yearbook.py → data/reports/yearbook-2026.html/.md
前端 localStorage：profile / experiments / alerts_state / rec_log
        ↕ /data 导出/导入 bundle.json（schema 0.5.0）
/yearbook 浏览器端年鉴视图 + 导出 MD/HTML
/calibration 推荐漏斗 + 实验校准 + 导出（含 rec_log 摘要）
```

## 4. 验收

| 项目 | 结果 |
|---|---|
| 数据 | validate 20/20；unittest 50；--all 幂等；data 0.5.0 |
| 年鉴 | 双跑字节一致；无实验/有实验/空年份/非法 JSON 容错；HTML/MD 可打开 |
| 前端 | build strict；14 路由 zh/en；/data 导出→导入→覆盖/合并；推荐漏斗计数正确 |
| 冻结 | 见 `releases/v0.5.0/MANIFEST.json`（红队核验） |
| 线上 | 根 `/` 与 `/v0.5.0/` = 冻结 dist；旧版归档不串台；versions.json latest=v0.5.0 |

## 5. 已知问题
- 年度建议为规则生成（非投资建议）；数据包为明文 JSON（用户自行保管，勿放公开位置）；rec_log 上限 500 条；LLM 在线模式仍未真实调用（无 key）。

## 6. 下一版（v0.6.0 / v0.5.1）
- v0.5.1：LLM 在线模式真实调用（自备 key）、数据包加密选项、年鉴前端指标细化。
- v0.6.0：多设备同步方案（自建轻量同步服务或加密文件云盘方案）、团队/协作模式评估、机会库扩充到 80+。