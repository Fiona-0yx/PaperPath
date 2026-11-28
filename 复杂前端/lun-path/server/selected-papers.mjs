import { paperCatalog } from '../../../论径后端/recommendation/paper-catalog.mjs';
import { findPaper } from '../shared/papers.js';

// Short passages only; the catalogue URL points to the original publication.
const passages = {
  'scikit-learn': 'Scikit-learn is a Python module integrating a wide range of state-of-the-art machine learning algorithms for medium-scale supervised and unsupervised problems.',
  xgboost: 'We propose a novel sparsity-aware algorithm for sparse data and weighted quantile sketch for approximate tree learning.',
  'glorot-initialization': 'Based on these considerations, we propose a new initialization scheme that brings substantially faster convergence.',
  dropout: 'The key idea is to randomly drop units (along with their connections) from the neural network during training.',
  'deep-learning-review': 'Deep learning allows computational models that are composed of multiple processing layers to learn representations of data with multiple levels of abstraction.',
  'batch-normalization': 'We refer to this phenomenon as internal covariate shift, and address the problem by normalizing layer inputs.',
  alexnet: 'To make training faster, we used non-saturating neurons and a very efficient GPU implementation of convolutional nets.',
  resnet: 'We explicitly reformulate the layers as learning residual functions with reference to the layer inputs, instead of learning unreferenced functions.',
  glove: 'Semantic vector space models of language represent each word with a real-valued vector.',
  transformer: 'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.'
};
export function selectedPaper(id) {
  const local = findPaper(id);
  if (local) return local;
  const entry = paperCatalog.find(p => p.id === id);
  if (!entry || !passages[id]) return null;
  return { id, title:entry.title, version:id === 'scikit-learn' ? 'excerpt-v2' : 'excerpt-v1', language:'英文', excerpt:true,
    original:entry.url, abstract:passages[id], sections:[{id:'excerpt',heading:id === 'glove' ? 'Introduction · 摘录' : 'Abstract · 摘录',paragraphs:[passages[id]]}] };
}
