"""画像 + 论文 + 本篇设定 → 阅读方案。所有决策均为确定性纯函数。"""

import re


GIST, RETELL, IMPLEMENT = "看懂大意", "能讲清楚", "能复现"
FOCUS = {
    "课程作业": ["问题", "方法框架", "结论"],
    "科研入门": ["问题", "相关工作", "局限", "可延伸方向"],
    "竞赛": ["方法可借鉴点", "实验设置", "可复现性"],
    "保研准备": ["问题", "核心贡献", "局限", "与领域脉络的关系", "能否向别人讲清楚"],
    "兴趣": ["核心思路", "有意思的结论"],
}
TEST = {GIST: "gist", RETELL: "retell", IMPLEMENT: "implement"}
# 每行依次为阅读位置、方式、目标、遇到结构困难时的具体动作。
ROUTES = {
    GIST: [
        ("标题与摘要", "精读", "用一句话说出作者想解决什么问题。", "圈出研究对象和作者提出的做法。"),
        ("图表", "略读", "找一张能说明主要结果的图表。", "先读图注，再看比较了哪些对象。"),
        ("结论", "精读", "记下作者给出的主要答案。", "把结论与摘要中的问题配成一对。"),
        ("引言", "略读", "补上理解研究动机所需的背景。", "找出已有方法遇到的一个困难。"),
    ],
    RETELL: [
        ("摘要", "略读", "说出论文的问题和主要贡献。", "把问题与贡献各写成一句话。"),
        ("图表", "略读", "选择一张可以辅助讲解的图表。", "先用自己的话解释图注。"),
        ("引言", "精读", "讲清为什么值得研究这个问题。", "按背景、已有不足、本文目标整理三句话。"),
        ("方法（整体框架）", "精读", "用自己的话串起方法的主要环节。", "画出输入、关键步骤和输出。"),
        ("实验（结论层面）", "略读", "用一项实验结果支持主要结论。", "指出比较对象、指标和结果。"),
        ("局限", "精读", "说明结论在什么条件下仍有局限。", "找出一个未验证的情形并说明依据。"),
    ],
    IMPLEMENT: [
        ("摘要", "略读", "确定要复现的任务和目标结果。", "标出任务名称和报告的指标。"),
        ("引言", "略读", "确定方法针对的问题。", "写下作者采用的任务假设。"),
        ("方法（含细节）", "精读", "列出实现步骤、输入输出和关键参数。", "按执行顺序把步骤写成伪代码。"),
        ("实验设置", "精读", "整理数据处理、训练设置和评估方法。", "逐项记录数据划分、超参数和指标。"),
        ("消融", "精读", "梳理各组件对结果的影响。", "若有消融实验，列出移除组件前后的指标。"),
        ("附录／代码", "略读", "从可用的附录或代码补齐实现细节。", "核对配置，把尚缺的信息单独列出。"),
    ],
}
HEADINGS = {
    "标题与摘要": r"摘要|\babstract\b",
    "摘要": r"摘要|\babstract\b",
    "图表": r"图表|\b(figures?|tables?)\b",
    "引言": r"引言|绪论|\bintroduction\b",
    "结论": r"结论|\bconclusions?\b",
    "方法": r"方法|模型架构|\b(methods?|methodology|approach|architecture)\b",
    "实验": r"实验|结果|\b(experiments?|results?|evaluation|experimental setup)\b",
    "局限": r"局限|局限性|\blimitations?\b",
    "消融": r"消融|\bablation\b",
    "附录／代码": r"附录|代码|\b(appendix|appendices|code)\b",
}
EDITABLE = ["depth", "route", "focus", "aids"]
DEFAULTS = {
    "profile": {
        **dict.fromkeys(("grade", "major", "paper_count", "paper_language",
                         "english_comfort", "python_level")),
        "primary_purpose": "兴趣", "default_depth": GIST,
        "interests": [], "stuck_points": [], "secondary_purposes": [],
    },
    "paper": {"title": None, "abstract": None, "language": None, "section_titles": [],
              "has_formulas": None, "has_code_link": None},
}


def normalize(data):
    assumptions = []

    def group(name, defaults):
        raw = data.get(name)
        raw = raw if isinstance(raw, dict) else {}
        values = {}
        for key, default in defaults.items():
            value = raw.get(key)
            if isinstance(value, list) and "unsure" in value:
                value = [v for v in value if v != "unsure"]
                assumptions.append(f"{name}.{key}：忽略未确认的选项。")
            if value in (None, "unsure", ""):
                value = default
                note = "未提供，保留未知" if default is None else f"采用{default}"
                if key == "english_comfort":
                    note = "英文或语种未知时提供关键词翻译"
                assumptions.append(f"{name}.{key}：{note}。")
            values[key] = value
        return values

    profile = group("profile", DEFAULTS["profile"])
    paper = group("paper", DEFAULTS["paper"])
    reading = group("this_reading", {"purpose": profile["primary_purpose"],
                                    "depth": profile["default_depth"], "deadline": "无"})
    return profile, paper, reading, assumptions


def warnings_for(profile, paper, reading):
    warnings = []
    if reading["depth"] == IMPLEMENT:
        if profile["python_level"] in ("不会", "能看懂"):
            warnings.append("建议先补代码基础，或本篇降为『能讲清楚』。")
        if paper["has_code_link"] is False:
            warnings.append("这篇没有公开代码，复现难度较高。")
        if reading["deadline"] == "今天":
            warnings.append("时间可能不够，建议先走『能讲清楚』路线。")
    if reading["purpose"] == "竞赛" and reading["depth"] == GIST:
        warnings.append("竞赛通常需要读到方法细节，是否提高到『能讲清楚』？")
    if (profile["paper_count"] in (0, "0") and paper["language"] == "英文"
            and profile["english_comfort"] == "逐句翻译"):
        warnings.append("首篇建议换更易读的论文或先读综述。")
    return warnings


def make_route(depth, titles, structure_help, assignments=None):
    remaining = list(dict.fromkeys(titles))
    route = []
    for label, mode, goal, action in ROUTES[depth]:
        key = "实验" if label.startswith("实验") else label.split("（")[0]
        # 优先把带“消融”的标题留给专门的消融步骤。
        matched = [t for t in remaining if re.search(HEADINGS[key], t, re.I)
                   and not (depth == IMPLEMENT and key == "实验"
                            and re.search(HEADINGS["消融"], t, re.I))]
        if assignments is not None:
            matched = [t for t in remaining if assignments[t] == len(route) + 1]
        remaining = [t for t in remaining if t not in matched]
        section = f"{label} · {' / '.join(matched)}" if matched else label
        if structure_help:
            goal += action
        route.append(dict(step=len(route) + 1, section=section, mode=mode, goal=goal))
    for title in remaining:
        goal = "此节不属于本次阅读主线，可留到需要补充证据时查阅。"
        if structure_help:
            goal += "先记下标题，在主线笔记出现疑问时回查。"
        route.append(dict(step=len(route) + 1, section=title, mode="跳过", goal=goal))
    return route


def plan_rules(data):
    profile, paper, reading, assumptions = normalize(data)
    depth = reading["depth"]
    stuck = profile["stuck_points"]
    purposes = [reading["purpose"], *profile["secondary_purposes"]]
    focus = list(dict.fromkeys(item for p in purposes for item in FOCUS[p]))
    translation = {"逐句翻译": "full", "基本无障碍": "none"}.get(
        profile["english_comfort"], "key_terms")
    return {
        "depth": depth,
        "route": make_route(depth, paper["section_titles"], "结构" in stuck),
        "focus": focus[:3] if "不知道读什么" in stuck else focus,
        "aids": {
            "translation": "none" if paper["language"] == "中文" else translation,
            "formula_explain": "公式" in stuck or (paper["has_formulas"] is True and depth != GIST),
            "concept_explain": "before_reading" if "生词" in stuck else "ondemand",
            "code_walkthrough": depth == IMPLEMENT and profile["python_level"] in ("能运行", "能修改"),
        },
        "pre_reading_test": {"enabled": True, "num_questions": 3, "skippable": True},
        "post_reading_test": {"type": TEST[depth], "num_questions": 3},
        "warnings": warnings_for(profile, paper, reading),
        "assumptions": assumptions, "editable_fields": EDITABLE.copy(),
    }
