import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from copy import deepcopy
from pathlib import Path

from plan_generate import plan_generate
from paper_profile import build_paper_profile, guidance_for_concepts
from pretest import CONCEPT_PROMPT, generate_pretest, grade_pretest, select_concepts, student_view
from pretest_cli import main


class PretestTests(unittest.TestCase):
    def setUp(self):
        self.input_path = Path(__file__).with_name("samples") / "example_input.json"
        self.data = json.loads(self.input_path.read_text(encoding="utf-8"))
        self.plan = plan_generate(self.data)
        self.calls = []

    def mock_model(self, prompt, task):
        self.calls.append((prompt, task))
        if prompt == CONCEPT_PROMPT:
            return {"concepts": [
                {"concept": name, "steps": [step], "focus": [task["focus"][0]],
                 "why_needed": "帮助理解任务执行过程", "evidence": "智能体",
                 "priority": 4, "standalone": True}
                for name, step in [("目标", 1), ("动作", 4), ("反馈", 4), ("状态", 3), ("误差", 5)]
            ]}
        return {"questions": [
            {"id": row["id"], "stem": row["concept"] + "的含义是什么？",
             "options": {"A": "甲", "B": "乙", "C": "丙"}, "answer": "B", "explanation": "示例解析"}
            for row in task["concepts"]
        ]}

    def test_generate_and_grade(self):
        session = generate_pretest(self.data, self.plan, self.mock_model, count=5)
        self.assertEqual(len(session["questions"]), 5)
        self.assertEqual(len(self.calls), 2)
        for _, task in self.calls:
            self.assertEqual(task["profile"], self.data["profile"])
            self.assertEqual(task["focus"], self.plan["focus"])
            self.assertEqual(task["paper"], self.data["paper"])
        self.assertEqual(set(student_view(session)["questions"][0]), {"id", "stem", "options"})
        answers = dict.fromkeys([q["id"] for q in session["questions"]], "B")
        answers.update(q1="A", q2="UNSURE")
        report = grade_pretest(session, answers)
        self.assertEqual([r["status"] for r in report["results"]],
                         ["gap", "unsure", "mastered", "mastered", "mastered"])
        self.assertEqual(report["concept_gaps"], [session["questions"][0]["concept"]])
        self.assertTrue(report["results"][0]["reading_steps"])
        self.assertEqual(grade_pretest(session, skip=True)["concept_gaps"], [])
        session["skippable"] = False
        with self.assertRaises(ValueError):
            grade_pretest(session, skip=True)
        with self.assertRaises(ValueError):
            grade_pretest(session, {})

    def test_quick_generation_checks_evidence_and_uses_one_model_call(self):
        calls = []

        def combined(prompt, task):
            calls.append(task)
            concepts = self.mock_model(CONCEPT_PROMPT, task)["concepts"]
            questions = self.mock_model("", {
                "concepts": [{"id": f"q{i}", **c} for i, c in enumerate(concepts, 1)]
            })["questions"]
            concepts[0]["evidence"] = "文中不存在"
            return {"items": [{"concept": c, "question": q} for c, q in zip(concepts, questions)]}

        session = generate_pretest(self.data, self.plan, combined, count=2, quick=True)
        self.assertEqual(len(calls), 1)
        self.assertEqual([q["id"] for q in session["questions"]], ["q1", "q2"])
        self.assertTrue(all(q["evidence"] == "智能体" for q in session["questions"]))
        self.assertNotIn("answer", student_view(session)["questions"][0])
        with self.assertRaisesRegex(ValueError, "校验未通过"):
            generate_pretest(self.data, self.plan, combined, count=5, quick=True)

    def test_refill_and_targeted_repair(self):
        def flaky(prompt, task):
            reply = self.mock_model(prompt, task)
            if len(self.calls) == 1:
                reply["concepts"][0]["steps"] = [999]
                reply["concepts"][1]["evidence"] = "文中不存在"
                reply["concepts"][2]["standalone"] = False
                reply["concepts"][3]["concept"] = reply["concepts"][4]["concept"]
            if len(self.calls) == 3:
                reply["questions"][1]["answer"] = "UNSURE"
            return reply

        session = generate_pretest(self.data, self.plan, flaky, count=5)
        self.assertEqual(len(self.calls[1][1]["accepted"]), 1)
        self.assertEqual([r["id"] for r in self.calls[3][1]["concepts"]], ["q2"])
        self.assertEqual(len(session["questions"]), 5)

    def test_profile_uses_route_order_and_preserves_inputs(self):
        session = generate_pretest(self.data, self.plan, self.mock_model, count=3)
        route = self.plan["route"]
        session["questions"][0]["reading_steps"] = [route[3], route[0]]
        session["questions"][1]["reading_steps"] = [route[3]]
        original = deepcopy(session)
        profile = grade_pretest(session, {"q1": "A", "q2": "UNSURE", "q3": "B"})["paper_profile"]
        self.assertEqual(profile["self_report"], self.data["profile"])
        self.assertEqual(profile["reading_plan"]["aids"], self.plan["aids"])
        self.assertEqual(profile["completion_status"], "submitted")
        self.assertEqual(profile["concept_evidence"][0]["steps"], [1, 4])
        support = profile["step_support"]
        self.assertEqual([(s["step"], s["actions"][0]["action"]) for s in support],
                         [(1, "pre_explain"), (4, "offer_explanation")])
        self.assertEqual(support[0]["actions"][0]["question_id"], "q1")
        self.assertEqual(session, original)

    def test_unknown_skipped_unsure_and_disabled(self):
        session = generate_pretest(self.data, self.plan, self.mock_model)
        answers = {q["id"]: "UNSURE" for q in session["questions"]}
        submitted = grade_pretest(session, answers)
        self.assertEqual(len(submitted["paper_profile"]["concept_evidence"]), len(answers))
        skipped = grade_pretest(session, skip=True)["paper_profile"]
        self.assertEqual(skipped["completion_status"], "skipped")
        self.assertEqual(skipped["concept_evidence"], [])
        del submitted["completion_status"]
        legacy = build_paper_profile(session, submitted)
        self.assertEqual(legacy["completion_status"], "unknown")
        self.assertEqual(legacy["step_support"], [])
        self.plan["pre_reading_test"]["enabled"] = False
        disabled = generate_pretest(self.data, self.plan)
        baseline = student_view(disabled)["paper_profile"]
        self.assertEqual(baseline["completion_status"], "disabled")
        self.assertEqual(baseline["self_report"], self.data["profile"])
        self.assertEqual(baseline["concept_evidence"], [])

    def test_answer_guidance_is_local_to_concept(self):
        session = generate_pretest(self.data, self.plan, self.mock_model, count=3)
        answers = {"q1": "A", "q2": "B", "q3": "UNSURE"}
        profile = grade_pretest(session, answers)["paper_profile"]
        rules = [e["explanation_guidance"] for e in profile["concept_evidence"]]
        self.assertIn("直观定义", rules[0])
        self.assertIn("直接使用", rules[1])
        self.assertIn("一句概念提示", rules[2])
        revised = grade_pretest(session, {**answers, "q1": "B"})["paper_profile"]
        self.assertEqual(profile["answer_guidance"], revised["answer_guidance"])
        self.assertEqual(profile["concept_evidence"][1:], revised["concept_evidence"][1:])
        self.assertEqual(revised["concept_evidence"][0]["explanation_guidance"], rules[1])

    def test_default_answer_guidance_without_evidence(self):
        self.plan["pre_reading_test"]["enabled"] = False
        self.plan["aids"]["formula_explain"] = True
        for depth, term in [("看懂大意", "核心结论"), ("能讲清楚", "复述"), ("能复现", "操作步骤")]:
            self.plan["depth"] = depth
            profile = generate_pretest(self.data, self.plan)["paper_profile"]
            guidance = profile["answer_guidance"]
            self.assertIn(term, guidance["default_explanation"])
            self.assertIn("日常语言", guidance["formula_guidance"])
            self.assertTrue(guidance["explicit_request_first"])
            self.assertEqual(profile["concept_evidence"], [])
        self.plan["aids"]["formula_explain"] = False
        guidance = generate_pretest({}, self.plan)["paper_profile"]["answer_guidance"]
        self.assertIsNone(guidance["formula_guidance"])

    def test_known_untested_and_question_specific_guidance(self):
        session = generate_pretest(self.data, self.plan, self.mock_model, count=2)
        report = grade_pretest(session, {"q1": "A", "q2": "UNSURE"})
        profile = report["paper_profile"]
        self.assertEqual(len(profile["untested_concepts"]), 3)
        names = [q["concept"] for q in session["questions"]] + profile["untested_concepts"][:1]
        info = guidance_for_concepts(profile, names, requested_detail="只要一句话")
        self.assertEqual(info["answer_detail"], "只要一句话")
        self.assertEqual([r["status"] for r in info["concepts"]], ["gap", "unsure", "unassessed"])
        self.assertIsNone(info["concepts"][-1]["question_id"])
        self.assertEqual(profile["concept_evidence"][0]["selection_evidence"], "智能体")
        skipped = grade_pretest(session, skip=True)["paper_profile"]
        self.assertEqual(len(skipped["untested_concepts"]), 5)
        self.assertEqual(guidance_for_concepts(skipped, names[0])["concepts"][0]["status"], "unassessed")

    def test_disabled_and_invalid_output(self):
        self.plan["pre_reading_test"]["enabled"] = False
        self.assertEqual(generate_pretest({}, self.plan)["questions"], [])
        self.plan["pre_reading_test"]["enabled"] = True
        with self.assertRaisesRegex(ValueError, "有效考点"):
            generate_pretest(self.data, self.plan, lambda *_: {})
        with self.assertRaisesRegex(ValueError, "出题依据"):
            generate_pretest({}, self.plan, self.mock_model)

    def test_selection_covers_remaining_goals(self):
        route = [{"step": 1, "mode": "精读"}, {"step": 2, "mode": "精读"}]
        a = {"focus": ["目标一"], "priority": 5, "steps": [1]}
        b = {**a, "priority": 4}
        c = {"focus": ["目标二"], "priority": 3, "steps": [2]}
        self.assertEqual(select_concepts([a, b, c], route, 2), [a, c])

    def test_cli_round_trip(self):
        with tempfile.TemporaryDirectory() as folder:
            session = str(Path(folder) / "session.json")
            output = io.StringIO()
            with redirect_stdout(output):
                main(["generate", str(self.input_path), "--session", session], self.mock_model)
            public = json.loads(output.getvalue())
            self.assertEqual(len(public["questions"]), self.plan["pre_reading_test"]["num_questions"])
            answers = Path(folder) / "answers.json"
            answers.write_text(json.dumps({"test_id": public["test_id"], "answers": {
                q["id"]: "B" for q in public["questions"]
            }}), encoding="utf-8")
            output = io.StringIO()
            with redirect_stdout(output):
                main(["grade", session, "--answers", str(answers)])
            self.assertTrue(all(r["status"] == "mastered" for r in json.loads(output.getvalue())["results"]))
            saved = json.loads(Path(session).read_text(encoding="utf-8"))
            self.assertEqual(saved["paper_profile"], json.loads(output.getvalue())["paper_profile"])
            self.assertEqual(saved["grading"]["completion_status"], "submitted")
            # 直接用已有判分生成画像，兼容不含新版画像字段的旧记录。
            del saved["paper_profile"]
            Path(session).write_text(json.dumps(saved), encoding="utf-8")
            before = Path(session).read_bytes()
            export = Path(folder) / "profile.json"
            with redirect_stdout(io.StringIO()):
                main(["profile", session, "--output", str(export)])
            self.assertEqual(json.loads(export.read_text(encoding="utf-8")),
                             json.loads(output.getvalue())["paper_profile"])
            self.assertEqual(Path(session).read_bytes(), before)
