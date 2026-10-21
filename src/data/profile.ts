import type { ContactLink } from './schema.ts';

export type { ContactLink };

export const profile = {
  name: 'Bo Tang',
  greeting: 'Hello, this is Bo Tang, an operations researcher.',
  bio: 'My work draws on machine learning and modern computing to develop reliable and scalable methods and reusable computational frameworks for decision-making.',
  role: 'Postdoctoral Associate',
  institution: 'Massachusetts Institute of Technology',
  institutionUrl: 'https://mitsloan.mit.edu/faculty/directory/bo-tang',
  location: 'Cambridge, Massachusetts',
  email: 'botang@mit.edu',
  github: 'https://github.com/LucasBoTang',
  linkedin: 'https://www.linkedin.com/in/lucas-bo-tang',
  googleScholar: 'https://scholar.google.com/citations?user=QMzZalQAAAAJ&hl=en',
  cv: '/files/Bo-Tang-CV.pdf',
  // People named in the biography; Home and About link to the same pages.
  supervisor: { name: 'Haihao Lu', url: 'https://mit-lu-lab.github.io/haihao-website/' },
  doctoralAdvisor: { name: 'Elias B. Khalil', url: 'https://www.ekhalil.com/' },
  internshipCollaborator: { name: 'Ján Drgoňa', url: 'https://drgona.github.io/' },
} as const;

export const contactLinks: ContactLink[] = [
  {
    service: 'Email',
    label: 'Email',
    description: `Email ${profile.email}`,
    href: `mailto:${profile.email}`,
    icon: 'email',
  },
  { service: 'Google Scholar', label: 'Scholar', href: profile.googleScholar, icon: 'scholar' },
  { service: 'GitHub', label: 'GitHub', href: profile.github, icon: 'github' },
  { service: 'LinkedIn', label: 'LinkedIn', href: profile.linkedin, icon: 'linkedin' },
];
