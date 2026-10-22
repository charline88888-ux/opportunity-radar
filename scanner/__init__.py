"""机会雷达 · 扫描器包（Python 3.11，纯标准库）。

模块划分：
- adapters/  采集适配器（离线 fixtures，可替换为真实网络适配器）
- normalize  原始信号 → 统一信号对象
- dedupe     跨源去重与证据合并
- score      10 维加权总分 / 等级 / rank_score（契约 4.5）
- rank       日/周/月/年榜单（契约 5.1）
- stats      聚合统计（契约 5.2）
- validate   V01–V15 数据校验（契约第 9 节）
- pipeline   命令行入口：python scanner/pipeline.py --all
"""

__version__ = "0.1.0"
