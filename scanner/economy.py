"""v1.5.1 经济测算（严格整数勾稽）：investment_breakdown / unit_economics / profit_model。

勾稽：
  客单价 - 单位成本 = 单位毛利
  单位毛利 - 单位固定成本 = 单位净贡献
  月收入 = 客单价 × 月单量
  月变动成本 = 单位成本 × 月单量
  月固定成本 = 单位固定成本 × 月单量
  月利润 = 月收入 - 月变动成本 - 月固定成本
  回本 = 投资总额 / 月利润
全部为理论测算、非实盘。
"""
from __future__ import annotations

import math
from typing import Any

INVESTMENT_SPLITS = [
    ("registration", "注册/主体", 0.04, "主体注册/开户/备案等一次性费用"),
    ("compliance", "合规/资质", 0.08, "许可、认证、检测或合规咨询"),
    ("inventory", "首批库存/样品", 0.30, "首批样品/小批量库存与打样"),
    ("channels", "平台/渠道开通", 0.10, "平台入驻、店铺/渠道建设"),
    ("logistics", "物流仓储", 0.10, "头程/仓储/退换与本地配送"),
    ("tools", "工具/软件", 0.06, "店铺/内容/数据工具订阅"),
    ("marketing", "市场推广", 0.16, "内容投放、达人/社群与冷启动获客"),
    ("labor", "人力/外包", 0.10, "运营/客服/设计/外包"),
    ("working_capital", "流动资金", 0.04, "现金流缓冲与补货周转"),
    ("contingency", "预备金", 0.02, "汇率/物流/退款等意外预备"),
]


def _num(value: Any, fallback: float) -> float:
    try:
        result = float(value)
        return result if result > 0 else fallback
    except (TypeError, ValueError):
        return fallback


def _range(roi: dict[str, Any], dict_key: str, min_key: str, max_key: str, fallback_min: float, fallback_max: float) -> tuple[int, int]:
    value = roi.get(dict_key)
    if isinstance(value, dict):
        lo, hi = _num(value.get("min"), fallback_min), _num(value.get("max"), fallback_max)
    elif isinstance(value, (int, float)):
        lo = hi = float(value)
    else:
        lo, hi = _num(roi.get(min_key), fallback_min), _num(roi.get(max_key), fallback_max)
    lo, hi = int(round(min(lo, hi))), int(round(max(lo, hi)))
    return max(1, lo), max(lo, hi)


def _choose_orders(revenue_min: int, revenue_max: int) -> int:
    gcd_value = math.gcd(revenue_min, revenue_max)
    candidates = [value for value in range(5, 241) if gcd_value % value == 0]
    if candidates:
        return max(candidates)
    for value in range(5, 241):
        if revenue_min % value == 0:
            return value
    return 100


def build_economics(
    *,
    roi: dict[str, Any],
    industry: str,
    title: str,
    reason: str = "",
    currency: str = "CNY",
) -> dict[str, Any]:
    capital_lo, capital_hi = _range(roi, "capital_cny", "capital_min", "capital_max", 30000, 150000)
    revenue_lo, revenue_hi = _range(roi, "monthly_revenue_cny", "monthly_revenue_min", "monthly_revenue_max", capital_lo * 0.4, capital_hi * 0.4)
    gross_raw = roi.get("gross_margin_pct")
    if isinstance(gross_raw, dict):
        margin_lo, margin_hi = _num(gross_raw.get("min"), 35), _num(gross_raw.get("max"), 60)
    elif isinstance(gross_raw, (int, float)):
        margin_lo = margin_hi = float(gross_raw)
    else:
        margin_lo, margin_hi = _num(roi.get("gross_margin_min"), 35), _num(roi.get("gross_margin_max"), 60)
    margin_lo, margin_hi = min(margin_lo, margin_hi), max(margin_lo, margin_hi)
    margin_lo = min(95.0, max(5.0, margin_lo))
    margin_hi = min(95.0, max(margin_lo, margin_hi))
    target_months = _num(roi.get("payback_months"), 12)

    items: list[dict[str, Any]] = []
    remain_lo, remain_hi = capital_lo, capital_hi
    for idx, (key, label, share, basis) in enumerate(INVESTMENT_SPLITS):
        if idx == len(INVESTMENT_SPLITS) - 1:
            item_lo, item_hi = remain_lo, remain_hi
        else:
            item_lo = int(round(capital_lo * share / 100) * 100)
            item_hi = int(round(capital_hi * share / 100) * 100)
            remain_lo -= item_lo
            remain_hi -= item_hi
        items.append({
            "id": key,
            "key": key,
            "name": label,
            "label": label,
            "min": max(0, item_lo),
            "max": max(0, item_hi),
            "basis": basis,
            "note": f"{label}按行业默认比例（{round(share * 100)}%）估算，需按实际报价调整",
        })
    total_min = sum(item["min"] for item in items)
    total_max = sum(item["max"] for item in items)

    orders = _choose_orders(revenue_lo, revenue_hi)
    price_min = max(10, revenue_lo // orders)
    price_max = max(price_min, revenue_hi // orders)
    revenue_month_min = price_min * orders
    revenue_month_max = price_max * orders
    cost_min = int(round(price_min * (1 - margin_lo / 100)))
    cost_max = int(round(price_max * (1 - margin_hi / 100)))
    cost_min = min(price_min - 1, max(0, cost_min))
    cost_max = min(price_max - 1, max(cost_min, cost_max))
    gross_min = price_min - cost_min
    gross_max = price_max - cost_max
    fixed_unit_min = max(1, min(gross_min - 1, gross_min - int(round(capital_lo / max(1.0, target_months) / orders))))
    fixed_unit_max = max(fixed_unit_min, min(gross_max - 1, gross_max - int(round(capital_hi / max(1.0, target_months) / orders))))
    net_unit_min = gross_min - fixed_unit_min
    net_unit_max = gross_max - fixed_unit_max
    variable_month_min = cost_min * orders
    variable_month_max = cost_max * orders
    fixed_month_min = fixed_unit_min * orders
    fixed_month_max = fixed_unit_max * orders
    profit_month_min = net_unit_min * orders
    profit_month_max = net_unit_max * orders
    payback_min = round(total_min / max(1, profit_month_max), 1)
    payback_max = round(total_max / max(1, profit_month_min), 1)
    if payback_max < payback_min:
        payback_min, payback_max = payback_max, payback_min
    payback_min = max(1.0, payback_min)
    payback_max = max(payback_min, payback_max)
    gross_margin_min = round(gross_min / price_min * 100, 1)
    gross_margin_max = round(gross_max / price_max * 100, 1)
    if gross_margin_min > gross_margin_max:
        gross_margin_min, gross_margin_max = gross_margin_max, gross_margin_min
    breakeven_orders = int(math.ceil(fixed_month_min / max(1, gross_min)))

    sensitivity: list[dict[str, Any]] = []
    for label, ords, price in (
        ("单量 -20%", max(1, int(round(orders * 0.8))), price_min),
        ("基准", orders, price_min),
        ("单量 +20%", max(1, int(round(orders * 1.2))), price_min),
        ("客单价 -10%", orders, max(1, int(round(price_min * 0.9)))),
        ("客单价 +10%", orders, int(round(price_min * 1.1))),
    ):
        revenue_point = price * ords
        variable_point = cost_min * ords
        fixed_point = fixed_unit_min * ords
        sensitivity.append({
            "label": label,
            "orders": ords,
            "revenue": revenue_point,
            "variable_cost": variable_point,
            "fixed_cost": fixed_point,
            "profit": revenue_point - variable_point - fixed_point,
        })

    unit_economics = {
        "aov_source": "roi_reverse",
        "aov_basis": "AOV = ROI 月收入区间 / 理论月单量（整数；与 price_per_unit、profit_model.unit_price 同源）",
        "price_per_unit": {"min": price_min, "max": price_max, "basis": "整数客单价；月收入锚定 ROI 后按单量反推"},
        "cost_per_unit": {"min": cost_min, "max": cost_max, "items": [{"name": "直接成本", "min": cost_min, "max": cost_max, "basis": "按毛利率反推"}], "basis": "单件采购/交付成本"},
        "gross_profit_per_unit": {"min": gross_min, "max": gross_max},
        "fixed_cost_per_unit": {"min": fixed_unit_min, "max": fixed_unit_max, "basis": "月固定成本按理论单量摊到每单"},
        "net_contribution_per_unit": {"min": net_unit_min, "max": net_unit_max},
        "gross_margin_pct": {"min": gross_margin_min, "max": gross_margin_max},
        "monthly_orders": {"min": orders, "max": orders, "basis": "整除 ROI 月收入的理论单量（同口径）"},
        "monthly_revenue": {"min": revenue_month_min, "max": revenue_month_max},
        "monthly_variable_cost": {"min": variable_month_min, "max": variable_month_max},
        "monthly_fixed_cost": {"min": fixed_month_min, "max": fixed_month_max},
        "monthly_profit": {"min": profit_month_min, "max": profit_month_max},
        "breakeven_orders": breakeven_orders,
        "payback_months": {"min": payback_min, "max": payback_max, "target": target_months, "target_months": target_months},
        "formula": "客单价−单位成本=单位毛利；单位毛利−单位固定=单位净贡献；月收入=客单价×月单量；月利润=月收入−月变动−月固定；回本=投资/月利润",
        "assumptions": [
            "全部为整数理论测算，不含实盘数据；四舍五入后加减仍严格相等。",
            "月收入锚定 ROI 月收入，单量取能整除收入的整数，客单价随之反推。",
            "固定成本按理论单量摊到每单，实际人力/工具/渠道成本可能不同。",
            "未计入汇率、退款、税费与一次性意外支出。",
        ],
        "sensitivity": sensitivity,
    }
    revenue_streams = [
        {"id": "product", "name": "主营产品/服务", "monthly_amount_min": revenue_month_min, "monthly_amount_max": revenue_month_max, "share_pct": 85, "basis": "客单价×理论单量（理论测算）"},
        {"id": "service", "name": "增值服务", "monthly_amount_min": int(round(revenue_month_min * 0.10)), "monthly_amount_max": int(round(revenue_month_max * 0.10)), "share_pct": 10, "basis": "按主营收入 10% 估算"},
        {"id": "fee", "name": "渠道/分佣", "monthly_amount_min": int(round(revenue_month_min * 0.05)), "monthly_amount_max": int(round(revenue_month_max * 0.05)), "share_pct": 5, "basis": "按主营收入 5% 估算"},
    ]
    profit_model = {
        "currency": currency,
        "revenue_streams": revenue_streams,
        "cost_items": [
            {"id": "cogs", "name": "商品/服务直接成本", "monthly_amount_min": variable_month_min, "monthly_amount_max": variable_month_max, "basis": "单位成本×理论单量"},
            {"id": "fixed", "name": "固定成本", "monthly_amount_min": fixed_month_min, "monthly_amount_max": fixed_month_max, "basis": "单位固定成本×理论单量"},
        ],
        "aov_source": "roi_reverse",
        "aov_basis": "与 unit_economics.price_per_unit 同源：ROI 月收入 / 理论月单量",
        "unit_price": {"min": price_min, "max": price_max},
        "monthly_orders": {"min": orders, "max": orders},
        "monthly_revenue": {"min": revenue_month_min, "max": revenue_month_max},
        "monthly_profit": {"min": profit_month_min, "max": profit_month_max},
        "payback_months": unit_economics["payback_months"],
        "basis": f"{industry} 行业默认区间 + 标题信号「{title[:40]}」；理论测算，非实盘",
        "formula": unit_economics["formula"],
    }
    return {
        "investment_breakdown": {
            "currency": currency,
            "theoretical": True,
            "total_min": total_min,
            "total_max": total_max,
            "items": items,
            "basis": f"按 {industry} 行业默认比例拆分；合计严格等于 roi.capital / conditions.capital",
        },
        "unit_economics": unit_economics,
        "profit_model": profit_model,
    }
