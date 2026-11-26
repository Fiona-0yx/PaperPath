// Sample paper content for the reading workspace.
// One paper = one book. This file is the single source of truth for paper
// text, so both the shelf list and the reader can import it without a fetch.
export const papers = [
  {
    id: 'features-labels-datasets',
    categoryId: 'machine-learning',
    title: 'Features, Labels and Datasets',
    zhTitle: '特征、标签与数据集：模型究竟看到了什么',
    difficulty: 1,
    abstract:
      'A supervised model is a function learned from examples. This note walks through the three parts every example carries — features, labels and the dataset that holds them — and shows what a model can and cannot see.',
    sections: [
      {
        id: 'introduction',
        heading: '1 · Introduction',
        paragraphs: [
          'Before a model can learn, data has to be organised into examples. In a supervised task, every example is a row with two parts: a set of features that describe the input, and a label that records the answer we want the model to predict. The dataset is simply the collection of those rows.',
          'It is tempting to treat this arrangement as bookkeeping. It is not. The choices made here decide what the model is able to learn at all. If a useful signal never becomes a feature, no amount of training will recover it.',
        ],
      },
      {
        id: 'features',
        heading: '2 · Features',
        paragraphs: [
          'A feature is a measurable property of an example. For a house-price task the features might be the floor area, the number of rooms, and the distance to the city centre. Each feature is a number the model can multiply, compare and combine.',
          'Raw observations rarely arrive in a useful form. A date, a category name or a free-text note must be encoded before a model can use it. This step — turning raw observations into numeric features — is called feature engineering, and it is where much of the practical skill of machine learning lives.',
        ],
      },
      {
        id: 'labels',
        heading: '3 · Labels',
        paragraphs: [
          'A label is the target the model is trained to predict. In a supervised task every training example carries one, and the model learns a mapping from features to labels. Without a label there is nothing to be right or wrong about, and supervised learning cannot begin.',
          'Labels must be treated as evidence about the past, not as a feature available at prediction time. A common failure is to build a feature out of information that already contains the answer — for example, using a cancelled-order flag to predict cancellations. The model then looks accurate in training and collapses in use.',
        ],
      },
      {
        id: 'datasets',
        heading: '4 · Datasets',
        paragraphs: [
          'A dataset is the set of rows used to train and evaluate a model. It is normally split into a training set, a validation set and a test set. The training set teaches the model, the validation set guides small decisions, and the test set is held back so the final score reflects unseen data.',
          'The split must respect how the model will be used. If rows from the same source appear in both training and test data, the test score can be inflated. A good dataset is not merely large; it is arranged so that the evaluation imitates the real future the model will face.',
        ],
      },
      {
        id: 'what-a-model-sees',
        heading: '5 · What a Model Actually Sees',
        paragraphs: [
          'At inference time a model sees only features. It never sees the label, because the label is exactly what it is trying to produce. Training is the process of adjusting the model so that, given features, it outputs labels close to the ones recorded in the past.',
          'The practical lesson is narrow and durable: the model can only use what is present in its features, and it can only learn what is present in its labels. A clean dataset, honest features and trustworthy labels do more for a model than a cleverer algorithm applied to a messy one.',
        ],
      },
    ],
  },
];

export const findPaper = id => papers.find(p => p.id === id) || null;
export const papersInCategory = categoryId => papers.filter(p => p.categoryId === categoryId);
