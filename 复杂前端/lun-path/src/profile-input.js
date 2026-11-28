export async function profileInput(answers = parent.journalShell?.intake?.submitted?.answers || {}, questionsUrl = "../shared/journal-questions.json") {

  const response = await fetch(questionsUrl);
  const questions = await response.json();
  const mapped = {};
  function field(id, key, list, group = 0, multiple = false) {
    const a = answers[id];
    if (!a || a.source !== "self") return;
    const q = questions.find((q) => q.id === id);
    const options = (q.groups ? q.groups[group].options : q.options).map(
      (o) => o[0],
    );
    const values = list || options;
    if (a.edited || a.text) {
      const text = (a.text || "").trim();
      if (!text) return;
      const i = options.indexOf(text),
        value = i < 0 ? (values.includes(text) ? text : null) : values[i];
      if (value) mapped[key] = multiple ? [value] : value;
      return;
    }
    const indices = multiple ? a.values : [a.values?.[group]];
    const selected = (indices || [])
      .filter(Number.isInteger)
      .map((i) => values[i])
      .filter(Boolean);
    if (selected.length) mapped[key] = multiple ? selected : selected[0];
  }
  field("education", "grade", null, 0);
  field("education", "major", null, 1);
  field("purpose", "primary_purpose", [
    "课程作业",
    "科研入门",
    "竞赛",
    "保研准备",
    "兴趣",
  ]);
  field("direction", "interests", null, 0, true);
  field("reading", "paper_count", ["0", "1-3", "4-10", "10+"]);
  field("reading", "paper_language", ["中文", "英文", "差不多", null], 1);
  field("english", "english_comfort", ["逐句翻译", "查词可读", "基本无障碍"]);
  field("python", "python_level", ["不会", "能看懂", "能修改", "能修改"]);
  field(
    "difficulty",
    "stuck_points",
    ["生词", "公式", "结构", "不知道读什么"],
    0,
    true,
  );
  field("outcome", "default_depth", ["看懂大意", "能讲清楚", "能复现"]);
  return mapped;
}
