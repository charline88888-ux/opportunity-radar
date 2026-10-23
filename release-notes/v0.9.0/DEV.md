# v0.9.0 开发文档（DEV）

> 版本：v0.9.0（MINOR）　｜　数据版本：data-v0.9.0　｜　日期：2026-10-23　｜　上一版：v0.8.0

## 1. 产品原则修正（用户指出）
验证/实验不是信息获取与上榜的门禁。系统无法验证任何人能否赚钱；商业成败取决于执行与大量外部因素。系统职责是**发现商机并展示**；验证只是个人可选功能，不参与候选收录、排序或评级。

## 2. 变更
- `scanner/candidates.py`：outbox business 信号（184）+ maybe 补位（16）= **200 条自动候选**；七问自动草稿、ROI 估算（estimated）、10 维启发式评分、confidence、证据链接、`status=auto-discovered`、`verification_status=unverified`、免责声明；去重/上限/确定性；不写 opportunities.json。
- `data/candidates.json` + `data/candidate-rankings.json`：四窗口 **day21 / week124 / month168 / year199**，按 first_seen 归窗；meta `verification_affects_ranking=false`。
- stats：`candidates_total=200 / today_new_candidates=21 / unverified_candidates=200`；V14 扩展校验。
- 前端：`/discover` 发现榜（日/周/月/年，筛选/搜索，自动发现·未验证角标）、候选详情（七问草稿/来源/ROI/评分/免责）、`/rankings` 双轨（发现默认/精选）、指挥台今日候选入口。
- 验证/实验保持可选；不出现“验证后才能上榜”的文案或逻辑。

## 3. 验收
- 数据：validate 20/20、unittest 109/109、`--all` 双跑幂等；data 0.9.0；精选 80 条内容不变。
- 前端：构建可复现、16 路由、发现榜四窗口/详情/双轨、i18n、截图。
- 冻结/线上：MANIFEST 19/19、tag deploy success、线上 `/` 与 `/v0.9.0/` 同 hash。

## 4. 已知限制
- 候选由规则自动生成，可能不准确，需自行核验；不是投资/盈利建议；
- 验证/实验为可选功能，系统不承诺任何收益；
- 采集边界见 v0.8.0 控制台漏斗卡。