# v1.5.2 开发文档（DEV）

> 版本：v1.5.2（PATCH）　｜　数据数据：data-v1.5.0　｜　日期：2026-10-24　｜　上一版：v1.5.1

## 修复
- 执行方案「里程碑」不再暴露原始 key：`[{name,target}]` 映射为「里程碑/目标」可读文案；新增通用 ValueText 对象字段兜底（name/title/target/desc/note/basis/value/label/milestone/unit 等），避免其他数据对象原始 key 外露。
- 9 路由不变；数据 1.5.0 不变。

## 验收
- dist 5,055,560 B；两次 build 同 hash；截图 fix2-execution-zh；i18n 16/16；冻结 MANIFEST；线上 `/` 与 `/v1.5.2/` 同 hash。