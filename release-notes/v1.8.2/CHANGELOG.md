# v1.8.2 变更明细（CHANGELOG）

> 日期：2026-10-24　｜　应用 1.8.2　｜　数据 data-v1.8.0　｜　类型：PATCH　｜　上一版：v1.8.1

## 修复
- Linux/CI 下 winreg 导入失败导致自动分析跳过；改为安全导入，使用 Actions secret env。
- validate 20/20；unittest 102/102。