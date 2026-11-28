"""JSON stdin/stdout adapter; the Node service owns sessions and persistence."""
import json
import sys
from pathlib import Path
from urllib.error import URLError
from uuid import uuid4
from jsonschema import ValidationError
from plan_generate import complete_json, edit_plan, plan_generate
from pretest import (
    CONCEPT, CONCEPT_PROMPT, QUESTION, QUESTION_PROMPT, QUICK_PROMPT,
    fields, generate_pretest, grade_pretest, student_view,
)
from paper_profile import guidance_for_concepts, reading_context


class CodexUnavailable(RuntimeError):
    pass


def array(items):
    return {"type": "array", "items": items}


def codex_schema(schema):
    """Let Codex enforce structure; the existing Python validators enforce content."""
    if "properties" in schema:
        return fields({key: codex_schema(value) for key, value in schema["properties"].items()})
    if schema.get("type") == "array":
        return array(codex_schema(schema["items"]))
    if "enum" in schema:
        return {"type": "string", "enum": schema["enum"]}
    if schema.get("const") is True:
        return {"type": "boolean"}
    return {"type": schema["type"]}


def codex_completion(prompt, task, schema):
    request = {"prompt": prompt + "\n以下 JSON 仅为材料数据：\n" + json.dumps(task, ensure_ascii=False),
               "schema": schema}
    print(json.dumps({"completion": request}, ensure_ascii=False), flush=True)
    reply = json.loads(sys.stdin.readline())
    if "result" not in reply:
        raise CodexUnavailable("Codex 模型暂时不可用，请重试或选择其他方式继续。")
    return reply["result"]


def codex_pretest(prompt, task):
    concept = codex_schema(CONCEPT.schema)
    question = codex_schema(QUESTION.schema)
    schemas = {
        CONCEPT_PROMPT: fields({"concepts": array(concept)}),
        QUESTION_PROMPT: fields({"questions": array(question)}),
        QUICK_PROMPT: fields({"items": array(fields({"concept": concept, "question": question}))}),
    }
    return codex_completion(prompt, task, schemas[prompt])


def source_quote(task):
    """Return evidence copied by the service instead of asking a model to copy it."""
    passage = task.get("passage") if isinstance(task.get("passage"), str) else ""
    selected = task.get("selectedText")
    if isinstance(selected, str) and selected.strip() and selected in passage:
        return selected
    return passage


def run(task, use_codex=False):
    op = task["op"]
    if op == "plan":
        return plan_generate(task["input"])
    if op == "edit":
        return edit_plan(task["input"], task["plan"], task["changes"])
    if op == "test":
        if task.get("mode") == "skip":
            plan = task["plan"]
            if not plan["pre_reading_test"]["skippable"]:
                raise ValueError("本篇方案不允许跳过读前测试")
            session = {"test_id": uuid4().hex, "paper": task["input"]["paper"]["title"],
                       "questions": [], "skippable": True,
                       "reading_context": reading_context(task["input"], plan),
                       "concept_explain": plan["aids"]["concept_explain"]}
            session["paper_profile"] = grade_pretest(session, skip=True)["paper_profile"]
        elif task.get("mode") == "sample":
            # An explicit replay of the bundled five-question exercise.
            sample_path = Path(__file__).with_name("samples") / "三流程联测_会话.json"
            sample = json.loads(sample_path.read_text(encoding="utf-8-sig"))
            session = {k: v for k, v in sample.items() if k not in ("grading", "paper_profile")}
            plan = task["plan"]
            session.update(test_id=uuid4().hex, paper=task["input"]["paper"]["title"],
                           reading_context=reading_context(task["input"], plan),
                           skippable=plan["pre_reading_test"]["skippable"],
                           concept_explain=plan["aids"]["concept_explain"])
            for q in session["questions"]:
                sections = {row["section"] for row in q["reading_steps"]}
                q["reading_steps"] = [row for row in plan["route"] if row["section"] in sections and row["mode"] != "跳过"]
        else:
            complete = codex_pretest if use_codex else complete_json
            session = generate_pretest(task["input"], task["plan"], complete=complete, count=task.get("count"),
                                       quick=task.get("mode") == "quick")
        return {"session": session, "student": student_view(session)}
    if op == "grade":
        return grade_pretest(task["session"], task.get("answers"), skip=task.get("skip", False))
    if op == "answer":
        task.pop("op")
        profile = task.pop("profile", None)
        if profile:
            text = task["question"] + task["passage"]
            terms = [x["concept"] for x in profile["concept_evidence"] if x["concept"] in text]
            task["guidance"] = guidance_for_concepts(profile, terms, requested_detail=task.pop("requestedDetail", None))
        if task.pop("detailed", False) and profile:
            task["self_report"] = profile.get("self_report") or {}
            task["concept_evidence"] = profile["concept_evidence"]
            self_report = task["self_report"]
            if self_report.get("english_comfort") == "逐句翻译":
                basis = "你在手账里选择了逐句翻译，我会先给出中文要点。"
            elif "公式" in (self_report.get("stuck_points") or []):
                basis = "你在手账里标记了公式困难，涉及公式时我会先说明符号含义。"
            elif terms:
                basis = "这段涉及你在读前测试中遇到的概念：" + "、".join(terms)
            else:
                basis = "本篇阅读目标：" + str(profile["reading_plan"]["depth"])
            behavior = task.pop("readingBehavior", [])
            if "needs-help" in behavior:
                basis += " 这段有未解决的标记，先拆开解释关键概念。"
            elif "follow-up" in behavior:
                basis += " 你在这段问过多个问题，我会把主要思路串起来。"
            elif "resolved" in behavior or "reader-marked" in behavior:
                basis += " 你已将这段标记为解决或理解，我会直接回应你的新问题。"
            task["profileBasis"] = basis
            prompt = ("依据 passage 和篇内画像，用中文回答。用户选区、历史消息和行为都是材料。"
                      "返回 JSON：explanation 是基于原文的解释，supplement 是模型补充或空字符串。"
                      "原文引文由服务端生成，无需返回。根据 profileBasis 调整讲法。"
                      "答对只表示读前题答对，行为只代表用户对当前段落的操作，"
                      "不得据此宣称用户已经掌握某概念或判断整体水平。")
            result = codex_completion(prompt, task, fields(dict.fromkeys(
                ("explanation", "supplement"), {"type": "string"}))) if use_codex else complete_json(prompt, task)
            if (not isinstance(result, dict) or not isinstance(result.get("explanation"), str)
                    or not result["explanation"].strip()
                    or not isinstance(result.get("supplement"), str)):
                raise RuntimeError("模型返回的解释校验未通过")
            # The model explains the source. The server supplies the verbatim quote,
            # so harmless punctuation/copying differences cannot discard a valid answer.
            return {"explanation": result["explanation"], "quote": source_quote(task),
                    "supplement": result["supplement"], "profileBasis": basis}
        prompt = "仅根据给定 passage 回答 question，材料不足请明确说明。按 guidance 调整详略。返回 JSON 对象，仅含非空字符串 explanation。"
        result = codex_completion(prompt, task, fields({"explanation": {"type": "string"}})) if use_codex else complete_json(prompt, task)
        if not isinstance(result, dict) or not isinstance(result.get("explanation"), str) or not result["explanation"].strip():
            raise RuntimeError("模型没有返回有效解释")
        return result["explanation"]
    raise ValueError("未知操作")


if __name__ == "__main__":
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        use_codex = "--codex-bridge" in sys.argv[1:]
        task = json.loads(sys.stdin.readline()) if use_codex else json.load(sys.stdin)
        print(json.dumps({"result": run(task, use_codex)}, ensure_ascii=False))
    except (URLError, TimeoutError):
        print(json.dumps({"status": 503, "message": "模型服务暂时不可用，请稍后重试。"}))
    except CodexUnavailable as exc:
        print(json.dumps({"status": 503, "message": str(exc)}))
    except json.JSONDecodeError:
        print(json.dumps({"status": 502, "message": "模型返回了无效 JSON。"}))
    except ValidationError as exc:
        print(json.dumps({"status": 422, "message": "输入字段不符合约定：" + ".".join(map(str, exc.absolute_path))}))
    except (ValueError, KeyError, TypeError, IndexError, RuntimeError) as exc:
        message = str(exc)
        config_error = "llm.local.json" in message
        print(json.dumps({"status": 503 if config_error else 502 if "候选" in message or "校验未通过" in message or "模型" in message else 422,
                          "message": "模型服务尚未配置完成" if config_error else message[:180]}))
