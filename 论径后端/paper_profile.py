"""根据本篇方案、用户自述和本次答题证据生成阅读起点。"""

from copy import deepcopy

from plan_rules import GIST, IMPLEMENT, RETELL


ANSWER_GOALS = {
    GIST: "先给核心结论，用通俗语言说明它与论文问题的关系。",
    RETELL: "讲清关键环节和它们的关系，给出读者可以用自己的话复述的解释。",
    IMPLEMENT: "涉及实现时，按原文说明操作步骤、输入输出和必要条件。",
}
CONCEPT_EXPLANATIONS = {
    "gap": "先给这个概念的直观定义，必要时举一个小例子，再联系当前问题。",
    "unsure": "先给一句概念提示，再回答问题，详细解释供读者按需展开。",
    "mastered": "可直接使用这个概念解释当前问题。",
}


def answer_guidance(context):
    """本篇的默认回答方式。局部知识掌握程度只由逐题证据提供。"""
    plan = context["reading_plan"]
    profile = context["self_report"]
    difficulties = profile.get("stuck_points") if isinstance(profile, dict) else None
    formula_help = None
    if plan["aids"].get("formula_explain"):
        formula_help = "遇到相关公式时说明符号和公式的用途。"
        if isinstance(difficulties, list) and "公式" in difficulties:
            formula_help = "先用日常语言说明公式表达的关系，再逐个解释相关符号。"
    return {
        "reading_goal": plan["depth"],
        "default_explanation": ANSWER_GOALS.get(plan["depth"], "按当前问题给出直接解释。"),
        "formula_guidance": formula_help,
        "untested_concept": "按本篇阅读目标回答，概念基础视为未知。",
        "explicit_request_first": True,
    }


def reading_context(data, plan):
    return deepcopy({
        "self_report": data.get("profile"),
        "reading_plan": {key: plan[key] for key in ("depth", "focus", "route", "aids")},
    })


def build_paper_profile(session, report):
    if report["test_id"] != session["test_id"]:
        raise ValueError("判分记录与阅读会话的 test_id 不匹配")
    context = session.get("reading_context")
    if context is None:
        # 旧版会话仅保留出题时实际引用的步骤和概念辅助设置。
        known_steps = {s["step"]: s for q in session["questions"] for s in q["reading_steps"]}
        context = {"self_report": None, "reading_plan": {
            "depth": None, "focus": None, "route": [known_steps[i] for i in sorted(known_steps)],
            "aids": {"concept_explain": session["concept_explain"]},
        }}
    results = report["results"]
    completion = report.get("completion_status")
    if completion is None:
        # 旧版报告把整套跳过和逐题选 UNSURE 编码为相同的结果。
        completion = "submitted" if any(r["status"] in ("mastered", "gap") for r in results) else "unknown"
    untested = list(session.get("untested_concepts", []))
    if completion == "skipped":
        untested.extend(q["concept"] for q in session["questions"])
    profile = {"paper": session["paper"], "test_id": session["test_id"], **deepcopy(context),
               "answer_guidance": answer_guidance(context),
               "completion_status": completion, "concept_evidence": [], "step_support": [],
               "untested_concepts": list(dict.fromkeys(untested))}
    if completion != "submitted":
        return profile

    support = {}
    route = context["reading_plan"]["route"]
    for result in results:
        linked = {s["step"] for s in result["reading_steps"]}
        steps = [s["step"] for s in route if s["step"] in linked]
        status = result["status"]
        evidence = {"question_id": result["id"], "concept": result["concept"], "status": status,
                    "user_choice": result["user_choice"], "steps": steps,
                    "why_needed": result.get("why_needed"),
                    "selection_evidence": result.get("evidence"),
                    "explanation_guidance": CONCEPT_EXPLANATIONS[status]}
        profile["concept_evidence"].append(evidence)
        if status == "mastered":
            continue
        action = {"question_id": result["id"], "concept": result["concept"],
                  "action": "pre_explain" if status == "gap" else "offer_explanation",
                  "explanation": result["explanation"]}
        for step in (steps[:1] if status == "gap" else steps):
            support.setdefault(step, []).append(action)
    profile["step_support"] = [
        {**row, "actions": support[row["step"]]} for row in route if row["step"] in support
    ]
    return profile


def guidance_for_concepts(profile, concepts, *, requested_detail=None):
    """供问答层取用；concepts 为当前问题涉及的规范概念名。"""
    defaults = profile.get("answer_guidance") or answer_guidance(profile)
    evidence = {row["concept"]: row for row in profile["concept_evidence"]}
    if isinstance(concepts, str):
        concepts = [concepts]
    concepts_guidance = []
    for name in dict.fromkeys(concepts):
        row = evidence.get(name)
        concepts_guidance.append({
            "concept": name,
            "status": row["status"] if row else "unassessed",
            "question_id": row["question_id"] if row else None,
            "guidance": CONCEPT_EXPLANATIONS[row["status"]] if row else defaults["untested_concept"],
        })
    return {"answer_detail": requested_detail or defaults["default_explanation"],
            "detail_source": "user_request" if requested_detail else "reading_plan",
            "concepts": concepts_guidance, "focus": deepcopy(profile["reading_plan"]["focus"]),
            "aids": deepcopy(profile["reading_plan"]["aids"]),
            "formula_guidance": defaults["formula_guidance"]}
