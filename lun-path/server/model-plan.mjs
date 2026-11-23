/** Roles describe responsibilities, not a one-role-one-model allocation. */
export const modelPlan = Object.freeze({
  intake: { provider: null, model: null, responsibility: 'Extract explicit goals and experience; preserve unknowns and source evidence.' },
  planner: { provider: null, model: null, responsibility: 'Choose the next useful question, paper and reading path from current evidence.' },
  tutor: { provider: null, model: null, responsibility: 'Explain accessible source passages in the selected interface language.' },
  assessment: { provider: null, model: null, responsibility: 'Generate source-grounded questions; keep open and uncertain answers ungraded until assessed.' },
  critic: { provider: null, model: null, responsibility: 'Check the support for questions, explanations and claims before showing them.' },
  profiler: { provider: null, model: null, responsibility: 'Maintain local knowledge evidence without inventing broad ability scores.' }
});
