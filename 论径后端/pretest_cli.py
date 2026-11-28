"""读前测试命令行，运行 python pretest_cli.py --help 查看子命令。"""

import argparse
import json
from pathlib import Path
import sys
from tempfile import NamedTemporaryFile

from jsonschema import ValidationError

from plan_generate import INPUT, OUTPUT, plan_generate
from paper_profile import build_paper_profile, reading_context
from pretest import generate_pretest, grade_pretest, student_view


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def save_graded_session(path, session, report):
    """一次替换整份会话，避免只写入判分或只写入画像。"""
    updated = {**session, "paper_profile": report["paper_profile"],
               "grading": {k: v for k, v in report.items() if k != "paper_profile"}}
    with NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        temp_path = Path(stream.name)
    try:
        temp_path.write_text(json.dumps(updated, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)
    finally:
        temp_path.unlink(missing_ok=True)


def restore_reading_context(session, input_path, plan_path):
    if not input_path or not plan_path:
        raise ValueError("补充旧会话需要同时提供 --input 和 --plan")
    data, plan = read_json(input_path), read_json(plan_path)
    INPUT.validate(data)
    OUTPUT.validate(plan)
    paper = data.get("paper")
    title = paper.get("title") if isinstance(paper, dict) else None
    if title != session["paper"]:
        raise ValueError("论文题名与会话不匹配")
    if any(s not in plan["route"] for q in session["questions"] for s in q["reading_steps"]):
        raise ValueError("阅读步骤与原会话不匹配")
    context = reading_context(data, plan)
    if "reading_context" in session and session["reading_context"] != context:
        raise ValueError("提供的画像或方案与会话已保存的输入不匹配")
    session["reading_context"] = context


def main(argv=None, complete=None):
    parser = argparse.ArgumentParser(description="论文读前测试")
    commands = parser.add_subparsers(dest="command", required=True)
    generate = commands.add_parser("generate", help="生成试题，并保存判分用的私有记录")
    generate.add_argument("input", type=Path, help="含 paper 和 profile 的上游 JSON")
    generate.add_argument("--plan", type=Path, help="已生成或编辑过的阅读方案，省略时调用规则生成")
    generate.add_argument("--count", type=int, choices=range(1, 6), help="本次覆盖方案题量")
    generate.add_argument("--session", required=True, type=Path, help="新建私有记录文件")
    grade = commands.add_parser("grade", help="根据本次记录判分并输出补讲建议")
    profile = commands.add_parser("profile", help="从已有判分记录生成篇内读前画像")
    profile.add_argument("--output", type=Path, help="将画像另存为新的 JSON 文件")
    for command in (grade, profile):
        command.add_argument("session", type=Path)
        command.add_argument("--input", type=Path, help="旧会话原始输入，配合 --plan 使用")
        command.add_argument("--plan", type=Path, help="旧会话原始阅读方案")
    submission = grade.add_mutually_exclusive_group(required=True)
    submission.add_argument("--answers", type=Path, help="包含 test_id 和 answers 的 JSON 文件")
    submission.add_argument("--skip", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.command == "generate":
            data = read_json(args.input)
            plan = read_json(args.plan) if args.plan else plan_generate(data)
            kwargs = {"complete": complete} if complete else {}
            session = generate_pretest(data, plan, count=args.count, **kwargs)
            with args.session.open("x", encoding="utf-8") as stream:
                json.dump(session, stream, ensure_ascii=False, indent=2)
            result = student_view(session)
        else:
            session = read_json(args.session)
            if args.input or args.plan:
                restore_reading_context(session, args.input, args.plan)
            if args.command == "profile":
                report = session.get("grading")
                if report is None:
                    if session["questions"]:
                        raise ValueError("本次测试尚无判分记录，请先提交答案或整体跳过")
                    report = {"test_id": session["test_id"], "completion_status": "disabled", "results": []}
                result = build_paper_profile(session, report)
                if args.output:
                    with args.output.open("x", encoding="utf-8") as stream:
                        json.dump(result, stream, ensure_ascii=False, indent=2)
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return
            answers = None
            if args.answers:
                submitted = read_json(args.answers)
                if not isinstance(submitted, dict) or submitted.get("test_id") != session["test_id"]:
                    raise ValueError("答案的 test_id 与本次测试不匹配")
                answers = submitted.get("answers")
            result = grade_pretest(session, answers, skip=args.skip)
            save_graded_session(args.session, session, result)
    except (ValidationError, ValueError, OSError, KeyError, IndexError) as exc:
        parser.exit(1, f"读前测试失败：{exc}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
