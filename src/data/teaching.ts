import type { Teaching } from './schema.ts';

const notebookFiles = [
  ['Gurobi basics', 'Lab_01_Gurobi_Basics.ipynb'],
  ['Lagrangian relaxation', 'Lab_03_Lagrangian_Relaxation.ipynb'],
  ['Column generation', 'Lab_05_Column_Generation.ipynb'],
  ['Stochastic programming', 'Lab_06_Stochastic_Programming.ipynb'],
  ['Network programming', 'Lab_07_Network_Programming.ipynb'],
  ['Dynamic programming', 'Lab_08_Dynamic_Programming.ipynb'],
  ['Discounted Markov decision processes', 'Lab_10_Discounted_Markov_Decision_Processes.ipynb'],
  ['Average-cost Markov decision processes', 'Lab_11_Average_Markov_Decision_Processes.ipynb'],
];
const workshops = [
  {
    id: 'acc-piml',
    title: 'ACC Workshop on Physics-informed Machine Learning',
    date: 'July 2024',
    role: 'Hands-on PyEPO tutorial',
    href: 'https://piml4control.github.io/PIML-ACC2024/',
  },
  {
    id: 'aaai-leanopt',
    title: 'AAAI Workshop on Learnable Optimization',
    date: 'February 2024',
    role: 'Hands-on PyEPO tutorial',
    href: 'https://leanopt.github.io/',
  },
  {
    id: 'coridm',
    title: 'CORIDM Lecture Series',
    date: 'November 2023',
    role: 'Invited lecture',
    href: 'https://coridm.d2d.ai/lecture/41',
    recording: true,
  },
];

export const teaching: Teaching = {
  courses: [
    {
      id: 'mie365',
      code: 'MIE365H1',
      href: 'https://engineering.calendar.utoronto.ca/course/mie365h1',
      title: 'Advanced Operations Research',
      term: 'Fall 2020, 2023, 2024',
      role: 'Teaching assistant & lab instructor',
      description:
        'I led the tutorials and labs over three fall terms and wrote the eight lab notebooks for Fall 2024. The notebooks combine mathematical formulations with guided exercises in modeling and algorithm implementation.',
      links: [],
      materials: {
        label: 'MIE365 notebooks',
        notebooks: notebookFiles.map(([label, filename]) => ({
          label,
          href: `https://colab.research.google.com/github/LucasBoTang/MIE365-Lab/blob/main/${filename}`,
        })),
      },
    },
    {
      id: 'mie376',
      code: 'MIE376H1',
      href: 'https://engineering.calendar.utoronto.ca/course/mie376h1',
      title: 'Mathematical Programming',
      term: 'Winter 2024',
      role: 'Teaching assistant & lab instructor',
      description:
        'I designed the assignments, exam problems, and lab exercises, and led the labs. The exercises ask students to formulate decision problems as linear, network, and integer programs and solve them, pairing the theory of mathematical programming with practice in modeling.',
      links: [],
    },
    {
      id: 'mie424',
      code: 'MIE424H1',
      href: 'https://engineering.calendar.utoronto.ca/course/mie424h1',
      title: 'Optimization in Machine Learning',
      term: 'Winter 2024',
      role: 'Teaching assistant & lab instructor',
      description:
        'I led the tutorials and labs. The labs connect machine-learning methods with their optimization foundations, from formulating regularized regression problems in CVXPY to implementing the splitting criteria of decision trees.',
      links: [{ label: 'Course materials', href: 'https://github.com/MIE424-2023' }],
    },
  ],
  workshops,
  tutorialLinks: [
    {
      label: 'Slides',
      href: 'https://github.com/khalil-research/PyEPO/blob/main/slides/PyEPO.pdf',
    },
  ],
};
