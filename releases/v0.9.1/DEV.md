# v0.9.1 开发文档（DEV）

> 版本：v0.9.1（MINOR）　｜　数据版本：data-v0.9.1　｜　日期：2026-10-23　｜　上一版：v0.9.0

## 1. 本版目标（用户要求“两个一起做”）
1) 源扩到 85+ 自动 / 160+ 平台；2) 候选质量（清洗、gap 兜底、区域/国家、新鲜度去重）。验证/实验仍不禁门。

## 2. 源扩充
- 平台 125→**160**；enabled 自动源 57→**91**；11/11 区域。
- 并入 researcher 25 个实测 RSS（24 成功；Arab News 403→false）；`rest-of-world` URL 修复但 XML 解析失败→false+原因；Google News TR + 3 query；App Store jp/br/in/ng/ae/au 6 国。
- 干净首跑：**92 源尝试/91 成功、2177 原始→1653 信号、new 1627/seen 26/ledger 1627**；source-health 92 行、ok 91、items 2177、mode online-fetch。

## 3. 候选质量
- 标题/摘要清洗（去 HTML/实体/空白/来源尾缀，title≤28，summary≤160）；同 canonical URL 保留最新；first/last_seen。
- gap 三层启发式兜底：**覆盖 200/200（100%），fallback 28**，meta `gap_inference_coverage`；候选 `gap_inferred` 标签。
- region 11/11、country 28；meta `region_coverage/country_coverage`。
- 200 候选四窗口 **day95/week200/month200/year200**；stats today_new_candidates=95；`verification_affects_ranking=false` 不变。

## 4. 验收
- validate 20/20、unittest 114/114、`--all` 双跑幂等；机会库 80 条指纹未变。
- 前端：源 160/自动 91/区域 11 展示；发现榜 gap 覆盖率/详情；构建可复现；16 路由/i18n/截图。
- 冻结/线上：MANIFEST 19/19、tag deploy success、线上 `/` 与 `/v0.9.1/` 同 hash。

## 5. 已知限制
- 2 个新源失败（rest-of-world XML、Arab News 403）已标 false+原因，下轮替换/容错；
- 候选仍为规则推断线索，不保证准确/盈利；验证/实验可选，不影响展示。