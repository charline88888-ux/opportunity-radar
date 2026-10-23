"""v1.5.0 投资与回报理论测算（确定性、无需实盘）：investment_breakdown / unit_economics / profit_model。

公式：
  total_min/max = Σ item.min/max
  毛利/单 = 客单价 − 单位成本；毛利率 = 毛利/客单价
  月收入 = 客单价 × 月单量；月利润 = 月收入 − 单位成本×月单量 − 月固定成本
  盈亏平衡单量 = 月固定成本 / 毛利/单；回本月数 = 投资总额 / 月利润
"""
from __future__ import annotations

from typing import Any

INVESTMENT_SPLITS = [
    ("compliance", "注册/合规/资质", 0.08, "注册、许可、认证或合规咨询"),
    ("inventory", "首批库存/样品", 0.30, "首批样品/小批量库存与打样"),
    ("channels", "平台/渠道开通", 0.12, "平台入驻、店铺/渠道建设"),
    ("logistics", "物流仓储", 0.10, "头程/仓储/退换与本地配送"),
    ("tools", "工具/软件", 0.07, "店铺/内容/数据工具订阅"),
    ("marketing", "市场推广", 0.18, "内容投放、达人/社群与冷启动获客"),
    ("labor", "人力/外包", 0.10, "运营/客服/设计/外包"),
    ("working_capital", "流动资金", 0.03, "现金流缓冲与补货周转"),
    ("reserve", "预备金", 0.02, "汇率/物流/退款等意外预备"),
]



def _range(roi: dict[str, Any], dict_key: str, min_key: str, max_key: str, fallback_min: float, fallback_max: float) -> tuple[float, float]:
    value = roi.get(dict_key)
    if isinstance(value, dict):
        return _num(value.get("min"), fallback_min), _num(value.get("max"), fallback_max)
    if isinstance(value, (int, float)):
        return float(value), float(value)
    return _num(roi.get(min_key), fallback_min), _num(roi.get(max_key), fallback_max)



def _num(value: Any, fallback: float) -> float:
    try:
        result = float(value)
        return result if result > 0 else fallback
    except (TypeError, ValueError):
        return fallback


def build_economics(
    *,
    roi: dict[str, Any],
    industry: str,
    title: str,
    reason: str = "",
    currency: str = "CNY",
) -> dict[str, Any]:
    capital_lo, capital_hi = _range(roi, "capital_cny", "capital_min", "capital_max", 30000, 150000)
    capital_min = int(round(min(capital_lo, capital_hi) / 100) * 100)
    capital_max = int(round(max(capital_lo, capital_hi) / 100) * 100)
    gross_raw = roi.get("gross_margin_pct")
    if isinstance(gross_raw, dict):
        margin_lo = _num(gross_raw.get("min"), 35)
        margin_hi = _num(gross_raw.get("max"), 60)
    elif isinstance(gross_raw, (int, float)):
        margin_lo = margin_hi = float(gross_raw)
    else:
        margin_lo = _num(roi.get("gross_margin_min"), 35)
        margin_hi = _num(roi.get("gross_margin_max"), 60)
    gross_min = min(margin_lo, margin_hi) / 100
    gross_max = max(margin_lo, margin_hi) / 100
    rev_lo, rev_hi = _range(roi, "monthly_revenue_cny", "monthly_revenue_min", "monthly_revenue_max", capital_min * 0.4, capital_max * 0.4)
    revenue_min = min(rev_lo, rev_hi)
    revenue_max = max(rev_lo, rev_hi)
    payback_target = _num(roi.get("payback_months"), 12)

    # 投资分项：按比例拆分，最后一项对齐 total
    items = []
    remain_min, remain_max = capital_min, capital_max
    for idx, (key, label, share, basis) in enumerate(INVESTMENT_SPLITS):
        if idx == len(INVESTMENT_SPLITS) - 1:
            item_min, item_max = remain_min, remain_max
        else:
            item_min = int(round(capital_min * share / 100) * 100)
            item_max = int(round(capital_max * share / 100) * 100)
            remain_min -= item_min
            remain_max -= item_max
        items.append({
            "key": key,
            "label": label,
            "min": max(0, item_min),
            "max": max(0, item_max),
            "basis": basis,
            "note": f"{label}按行业默认比例（{round(share * 100)}%）估算，需按实际报价调整",
        })
    total_min = sum(item["min"] for item in items)
    total_max = sum(item["max"] for item in items)

    # 客单价/单量：月收入以 ROI 为锚，客单与单量为理论反推值
    revenue_month_min = int(round(revenue_min))
    revenue_month_max = int(round(max(revenue_min, revenue_max)))
    base_orders = max(5, int(round(((revenue_month_min + revenue_month_max) / 2) / 100)))
    orders_min = max(5, int(round(base_orders * 0.7)))
    orders_max = max(orders_min + 2, int(round(base_orders * 1.3)))
    price_min = max(50, int(round(revenue_month_min / max(1, orders_min) / 10) * 10))
    price_max = max(price_min + 50, int(round(revenue_month_max / max(1, orders_max) / 10) * 10))
    cost_unit_min = int(round(price_min * (1 - gross_max)))
    cost_unit_max = int(round(price_max * (1 - gross_min)))
    gross_unit_min = price_min - cost_unit_min
    gross_unit_max = price_max - cost_unit_max
    gross_margin_pct_min = round(gross_unit_min / price_min * 100, 1) if price_min else 0.0
    gross_margin_pct_max = round(gross_unit_max / price_max * 100, 1) if price_max else 0.0
    if gross_margin_pct_min > gross_margin_pct_max:
        gross_margin_pct_min, gross_margin_pct_max = gross_margin_pct_max, gross_margin_pct_min
    fixed_cost_min = int(round(revenue_month_min * 0.10))
    fixed_cost_max = int(round(revenue_month_max * 0.10))
    variable_cost_min = int(round(revenue_month_min * (1 - gross_max)))
    variable_cost_max = int(round(revenue_month_max * (1 - gross_min)))
    profit_month_min = revenue_month_min - variable_cost_min - fixed_cost_min
    profit_month_max = revenue_month_max - variable_cost_max - fixed_cost_max
    if profit_month_min <= 0:
        fixed_cost_min = max(1, revenue_month_min - variable_cost_min - 1)
        profit_month_min = revenue_month_min - variable_cost_min - fixed_cost_min
    if profit_month_max <= 0:
        fixed_cost_max = max(1, revenue_month_max - variable_cost_max - 1)
        profit_month_max = revenue_month_max - variable_cost_max - fixed_cost_max
    breakeven_orders = int(round(fixed_cost_min / max(1, gross_unit_min)))
    # 回本=投资/月净利；target 用 roi.payback_months，range 限制在 1–60 月并包含 target
    payback_min = total_min / max(1, profit_month_max)
    payback_max = total_max / max(1, profit_month_min)
    if payback_max < payback_min:
        payback_min, payback_max = payback_max, payback_min
    payback_min = max(1.0, min(60.0, round(payback_min, 1)))
    payback_max = max(payback_min, min(60.0, round(payback_max, 1)))
    target_months = float(payback_target)
    if target_months < payback_min:
        payback_min = target_months
    if target_months > payback_max:
        payback_max = target_months

    revenue_streams = [
        {
            "name": "主营产品/服务收入",
            "monthly_amount_min": revenue_month_min,
            "monthly_amount_max": revenue_month_max,
            "share_pct": 85,
            "basis": f"客单价 {price_min:,}–{price_max:,} 元 × 月单量 {orders_min}–{orders_max} 单（理论测算）",
        },
        {
            "name": "增值服务/附加收入",
            "monthly_amount_min": int(round(revenue_month_min * 0.10)),
            "monthly_amount_max": int(round(revenue_month_max * 0.10)),
            "share_pct": 10,
            "basis": "定制、加急、延保或咨询等附加服务，按主收入 10% 估算",
        },
        {
            "name": "渠道返利/合作分佣",
            "monthly_amount_min": int(round(revenue_month_min * 0.05)),
            "monthly_amount_max": int(round(revenue_month_max * 0.05)),
            "share_pct": 5,
            "basis": "渠道/平台返利或合作分佣，按主收入 5% 估算",
        },
    ]
    cost_items = [
        {"name": "商品/服务直接成本", "monthly_amount_min": variable_cost_min, "monthly_amount_max": variable_cost_max, "basis": f"单位成本 {cost_unit_min:,}–{cost_unit_max:,} 元 × 理论单量"},
        {"name": "人力/外包", "monthly_amount_min": int(round(fixed_cost_min * 0.55)), "monthly_amount_max": int(round(fixed_cost_max * 0.55)), "basis": "固定运营/客服/设计人力"},
        {"name": "推广/渠道", "monthly_amount_min": int(round(fixed_cost_min * 0.30)), "monthly_amount_max": int(round(fixed_cost_max * 0.30)), "basis": "冷启动内容/投放/达人成本"},
        {"name": "工具/杂费", "monthly_amount_min": int(round(fixed_cost_min * 0.15)), "monthly_amount_max": int(round(fixed_cost_max * 0.15)), "basis": "软件订阅、物流杂费与预备金"},
    ]
    unit_economics = {
        "price_per_unit": {"min": price_min, "max": price_max, "basis": "客单价=ROI 月收入/理论单量反推（理论值）；月收入锚定 ROI"},
        "cost_per_unit": {"min": cost_unit_min, "max": cost_unit_max, "items": [{"name": "直接成本", "min": cost_unit_min, "max": cost_unit_max, "basis": "按毛利率反推"}], "basis": "直接采购/交付成本"},
        "gross_profit_per_unit": {"min": gross_unit_min, "max": gross_unit_max},
        "gross_margin_pct": {"min": gross_margin_pct_min, "max": gross_margin_pct_max},
        "monthly_orders": {"min": orders_min, "max": orders_max, "basis": "以 ROI 月收入为锚反推的理论单量（未实盘）"},
        "monthly_revenue": {"min": revenue_month_min, "max": revenue_month_max},
        "monthly_fixed_cost": {"min": fixed_cost_min, "max": fixed_cost_max},
        "monthly_variable_cost": {"min": variable_cost_min, "max": variable_cost_max},
        "monthly_profit": {"min": profit_month_min, "max": profit_month_max},
        "breakeven_orders": breakeven_orders,
        "payback_months": {"min": payback_min, "max": payback_max, "target": target_months, "target_months": target_months},
        "formula": "毛利/单=客单价−单位成本；月收入=客单价×月单量；月利润=月收入−单位成本×月单量−月固定成本；盈亏平衡单量=月固定成本/毛利/单；回本=投资总额/月利润",
        "assumptions": [
            "所有金额为理论测算，不含实盘数据；客单价与单量需按实际市场调整。",
            "毛利率、月单量、固定成本来自行业默认区间与 ROI 参数，不是承诺。",
            "投资分项按行业默认比例拆分，实际采购/渠道报价可能不同。",
            "未计入汇率波动、退款、税费与一次性意外支出。",
        ],
        "sensitivity": [
            {"label": "单量 -20%", "orders": max(1, int(round(base_orders * 0.8))), "revenue": int(round(revenue_month_min * 0.8)), "profit": int(round(profit_month_min * 0.7))},
            {"label": "基准", "orders": base_orders, "revenue": revenue_month_min, "profit": profit_month_min},
            {"label": "单量 +20%", "orders": int(round(base_orders * 1.2)), "revenue": int(round(revenue_month_max * 1.2)), "profit": int(round(profit_month_max * 1.25))},
            {"label": "客单价 -10%", "orders": base_orders, "revenue": int(round(revenue_month_min * 0.9)), "profit": int(round(profit_month_min * 0.8))},
            {"label": "客单价 +10%", "orders": base_orders, "revenue": int(round(revenue_month_max * 1.1)), "profit": int(round(profit_month_max * 1.1))},
        ],
    }
    profit_model = {
        "currency": currency,
        "revenue_streams": revenue_streams,
        "cost_items": cost_items,
        "unit_price": {"min": price_min, "max": price_max},
        "monthly_orders": {"min": orders_min, "max": orders_max},
        "monthly_revenue": {"min": revenue_month_min, "max": revenue_month_max},
        "monthly_profit": {"min": profit_month_min, "max": profit_month_max},
        "payback_months": {"min": payback_min, "max": payback_max, "target": target_months, "target_months": target_months},
        "basis": f"{industry} 行业默认区间 + 标题信号「{title[:40]}」；{reason or '理论测算，非实盘'}",
        "formula": unit_economics["formula"],
    }
    return {
        "investment_breakdown": {
            "currency": currency,
            "total_min": total_min,
            "total_max": total_max,
            "items": items,
            "basis": f"按 {industry} 行业默认比例拆分，需按实际报价调整",
        },
        "unit_economics": unit_economics,
        "profit_model": profit_model,
    }
