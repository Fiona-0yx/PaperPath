/** Extension contracts: implement these interfaces without changing domain fixtures. */
export class ModelAdapter {
  async complete({ messages, context }) {
    void messages; void context;
    throw Object.assign(new Error('No model configured. Demo replies are rule-based, not actual LLM output.'), { code: 'MODEL_NOT_CONFIGURED' });
  }
}
export class LiteratureAdapter {
  async search({ query, branch, limit = 6 }) {
    void query; void branch; void limit;
    throw Object.assign(new Error('No literature retrieval provider configured. Fixtures are not search results.'), { code: 'RETRIEVAL_NOT_CONFIGURED' });
  }
}
export const adapters = { model: new ModelAdapter(), literature: new LiteratureAdapter() };
