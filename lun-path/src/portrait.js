import {escape as esc} from './components.js';

export async function loadQuestions() {
  const response = await fetch('/shared/journal-questions.json');
  if (!response.ok) throw Error('Question data unavailable');
  return response.json();
}

export function answerText(q, answer, L) {
  if (!answer || answer.source === 'unknown') return L('未知', 'Unknown');
  if (answer.text !== undefined) return answer.text;
  const parts = (answer.values || []).map((value, i) => {
    const option = (q.groups ? q.groups[i].options : q.options)[value];
    return option ? L(...option) : L('未知', 'Unknown');
  });
  if (answer.other) parts.push(answer.other);
  return parts.join(L('、', ', '));
}

export function provenance(q, answer, L) {
  if (!answer || answer.source === 'unknown') return L('未知 · 待确认', 'Unknown · unconfirmed');
  if (answer.source === 'intro') {
    return L('系统推测 · 待确认 · 来自第 1 页', 'System inference · unconfirmed · page 1') + ' “' + answer.quote + '”';
  }
  if (answer.edited || (q.id !== 'intro' && answer.source === 'self' && answer.text !== undefined)) {
    return L('用户自述 · 明确表达 · 封底修改', 'Self-report · explicitly stated · edited on the last page');
  }
  const page = L(' · 第 ' + q.page + ' 页', ' · page ' + q.page);
  if (answer.source === 'check') {
    return (answer.other ? L('答题证据 · 理解待确认', 'Answer evidence · understanding unconfirmed') :
      L('答题证据 · 仅限本题', 'Answer evidence · this question only')) + page;
  }
  return L('用户自述 · 明确表达', 'Self-report · explicitly stated') + page;
}

export function evidenceDetails(q, evidence, L) {
  if (!evidence?.length) return '';
  const items = evidence.map(answer => {
    const result = answer.other ? L('理解待确认', 'Understanding unconfirmed') :
      answer.values?.[0] === q.correct ? L('本题答对', 'Correct on this question') : L('本题答错', 'Incorrect on this question');
    return '<li>' + esc(answerText(q, answer, L)) + ' · ' + result + '</li>';
  }).join('');
  return '<details class="check-record"><summary>' + L('查看原题与作答', 'Review question and answers') +
    '</summary><p>' + esc(L(...q.title)) + '</p><ol>' + items + '</ol></details>';
}
