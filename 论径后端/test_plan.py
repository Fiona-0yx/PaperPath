import json
from copy import deepcopy
from pathlib import Path
import unittest

from jsonschema import ValidationError

from plan_generate import edit_plan, plan_generate
from plan_rules import DEFAULTS, GIST, IMPLEMENT, RETELL


class ReadingPlanTests(unittest.TestCase):
    def test_retell(self):
        plan = plan_generate({
            "profile": {"primary_purpose": "保研准备", "default_depth": RETELL,
                        "english_comfort": "查词可读", "stuck_points": ["公式"]},
            "paper": {"language": "英文", "section_titles": ["Method", "Limitations"]},
        })
        self.assertEqual(plan["warnings"], [])
        self.assertEqual(plan["post_reading_test"]["type"], "retell")
        self.assertEqual(plan["aids"]["translation"], "key_terms")
        self.assertTrue(plan["aids"]["formula_explain"])
        sections = [r["section"] for r in plan["route"] if r["mode"] == "精读"]
        self.assertIn("方法（整体框架） · Method", sections)
        self.assertIn("局限 · Limitations", sections)

    def test_implementation_code_prerequisite(self):
        plan = plan_generate({"profile": {"default_depth": IMPLEMENT, "python_level": "不会"}})
        self.assertEqual(plan["depth"], IMPLEMENT)
        self.assertEqual(len(plan["warnings"]), 1)
        self.assertIn("代码基础", plan["warnings"][0])

    def test_implementation_without_code(self):
        plan = plan_generate({"profile": {"python_level": "能运行"}, "paper": {"has_code_link": False},
                              "this_reading": {"depth": IMPLEMENT}})
        self.assertTrue(plan["aids"]["code_walkthrough"])
        self.assertIn("没有公开代码", plan["warnings"][0])

    def test_unsure_defaults(self):
        data = {"profile": dict.fromkeys(DEFAULTS["profile"], "unsure")}
        plan = plan_generate(data)
        self.assertEqual(plan["depth"], GIST)
        self.assertEqual(plan["aids"]["translation"], "key_terms")
        paths = {s.split("：")[0] for s in plan["assumptions"]}
        expected = {f"{group}.{key}" for group, fields in DEFAULTS.items() for key in fields}
        expected.update("this_reading." + k for k in ("depth", "purpose", "deadline"))
        self.assertEqual(paths, expected)
        self.assertEqual(plan, plan_generate({}))

    def test_competition_gist(self):
        plan = plan_generate({"this_reading": {"purpose": "竞赛", "depth": GIST}})
        self.assertIn("竞赛", plan["warnings"][0])
        self.assertEqual(plan["post_reading_test"]["type"], "gist")

    def test_example_and_edit(self):
        data = json.loads((Path(__file__).with_name("samples") / "example_input.json").read_text(encoding="utf-8"))
        data["this_reading"]["deadline"] = "今天"
        original = deepcopy(data)
        plan = plan_generate(data)
        self.assertEqual(plan["focus"], ["问题", "核心贡献", "局限"])
        self.assertEqual(plan["aids"]["translation"], "full")
        self.assertIn("首篇", plan["warnings"][0])
        changed = edit_plan(data, plan, {"depth": IMPLEMENT, "focus": ["实验设置"]})
        self.assertTrue(any("时间" in s for s in changed["warnings"]))
        self.assertEqual(changed["post_reading_test"]["type"], "implement")
        again = edit_plan(data, changed, {"aids": {"translation": "none"}, "route": plan["route"]})
        self.assertEqual(again["route"], plan["route"])
        self.assertEqual(again["focus"], ["实验设置"])
        self.assertEqual(again["warnings"], changed["warnings"])
        self.assertEqual(data, original)
        self.assertEqual(plan, plan_generate(data))
        with self.assertRaises(ValueError):
            edit_plan(data, plan, {"warnings": []})

    def test_aids_and_purpose_priority(self):
        data = {"profile": {"primary_purpose": "竞赛", "default_depth": IMPLEMENT,
                            "secondary_purposes": ["兴趣"], "english_comfort": "逐句翻译",
                            "stuck_points": ["生词", "结构"]},
                "this_reading": {"purpose": "课程作业", "depth": RETELL},
                "paper": {"language": "中文", "has_formulas": True, "section_titles": ["References"]}}
        plan = plan_generate(data)
        self.assertEqual(plan["focus"], ["问题", "方法框架", "结论", "核心思路", "有意思的结论"])
        self.assertEqual(plan["aids"], {"translation": "none", "code_walkthrough": False,
                                       "formula_explain": True, "concept_explain": "before_reading"})
        self.assertEqual(plan["route"][-1]["mode"], "跳过")
        data["profile"]["stuck_points"].remove("结构")
        plain = plan_generate(data)
        for guided, base in zip(plan["route"], plain["route"], strict=True):
            self.assertGreater(len(guided["goal"]), len(base["goal"]))

    def test_llm_boundary_and_validation(self):
        data = {"paper": {"section_titles": ["Overview of our pipeline", "References"]},
                "this_reading": {"depth": RETELL}}

        def complete(task):
            return {"assignments": [4, 0], "goals": [r["goal"] for r in task["skeleton"]],
                    "warnings": task["warnings"]}

        plan = plan_generate(data, complete)
        self.assertIn("Overview of our pipeline", plan["route"][3]["section"])
        self.assertEqual(plan["route"][-1]["section"], "References")
        with self.assertRaises(ValueError):
            plan_generate(data, lambda task: {**complete(task), "depth": IMPLEMENT})
        with self.assertRaises(ValidationError):
            plan_generate({"this_reading": {"depth": "任意深度"}})


if __name__ == "__main__":
    unittest.main()
