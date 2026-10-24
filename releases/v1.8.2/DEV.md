# v1.8.2 开发文档（DEV）

> 版本：v1.8.2（PATCH）　｜　数据版本：data-v1.8.0　｜　日期：2026-10-24　｜　上一版：v1.8.1

## 修复
- CI/Linux 下 `analysis_batch.read_hkcu_env()` 因 `import winreg` 失败，导致每日自动分析被跳过、新候选仍为 rule_fallback。
- 改为 Windows-only 安全导入（winreg 不可用返回空），继续使用 GitHub Actions 注入的 DEEPSEEK_API_KEY 环境变量；Linux/CI 可正常调用 DeepSeek。
- 不修改数据/前端；数据仍 BDFD1486（v1.8.0），dist 不变。

## 验收
- validate 20/20；unittest 102/102；py_compile OK；每日 workflow 用 secret 手动触发后应能分析 fallback 候选。