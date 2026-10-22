# v0.5.1 开发文档（DEV）

> 版本：v0.5.1（PATCH）　｜　数据版本：data-v0.5.1　｜　日期：2026-10-22　｜　上一版：v0.5.0
> 冻结目录：`releases/v0.5.1/`　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 本版目标
关闭 v0.5.0 的 P2 与安全/可验证性缺口：年鉴分数口径、数据包加密、AI 富化在线路径可离线验证、i18n 收尾。

## 2. 变更
### 2.1 前端
- `/yearbook`：年榜第 1 名总分（rank1.total）与年度最高总分（max total）分开展示。
- `/data`：可选口令加密导出（PBKDF2-SHA256 210000 + AES-GCM-256，随机 salt/iv，schema 0.5.1）；导入自动识别，错误口令/损坏/旧版提示；口令不落盘。
- i18n 收尾：新文案完整双语；静态精确覆盖率目标 ≥60%；运行时 EN 非数据中文=0。
- About v0.5.1。
### 2.2 数据/扫描器
- `enrich.py --provider mock`：本地模拟在线响应（不联网、同解析链、generator=mock-llm）；在线模式 `--limit`、usage/token/成本估算、缓存标注、超时重试。
- 单测内置本地 mock HTTP server 覆盖真实 HTTP 路径（不依赖外网/key）。
- 数据版本 0.5.1；报告重生成；README/CHANGELOG 更新；validate 20/20；unittest 全绿。

## 3. 验收
| 项 | 结果 |
|---|---|
| 数据 | `--all` 幂等；validate 20/20；unittest 全绿；data 0.5.1 |
| enrich | mock 不联网且 schema 合法；usage/limit；无 key 报错；不写机会库；本地 HTTP mock 测试 |
| 前端 | 14 路由 zh/en；加密四态；年鉴双值；构建可复现 |
| 冻结/线上 | MANIFEST sha256；线上 `/` 与 `/v0.5.1/` 同 hash；旧版不串台 |

## 4. 已知问题
- mock 仅演示/测试，不代表真实模型质量；真实 LLM 需自备 key 并人工复核。
- 加密包忘记口令不可恢复；口令强度由用户负责。
- i18n 静态覆盖率含动态模板/DOM 余量，以运行时 EN 非数据中文为准。

## 5. 下一版（v0.6.0）
机会库扩充（80+）、多设备同步方案评估（加密云盘/自建轻量同步）、团队协作模式、年鉴指标细化。