// The fixed questionnaire recognizes a small set of complete clauses.
const rules = new Map([
  ['想入门神经网络', ['direction', 1]],
  ['I want to get into neural networks', ['direction', 1]],
  ['不知道从哪篇开始', ['difficulty', 3]],
  ['I am not sure which paper to start with', ['difficulty', 3]],
  ['为了完成课程作业', ['purpose', 0]],
  ['我还没用过 Python', ['python', 0]]
]);

export function introInferences(text) {
  return text.split(/[，。！？；,;.!?\n]/).flatMap(clause => {
    const quote = clause.trim();
    const rule = rules.get(quote);
    return rule ? [{ id: rule[0], option: rule[1], quote }] : [];
  });
}
