// Shared page routes for navigation, content links and build validation.
export const routes = {
  home: '/',
  about: '/about/',
  research: '/research/',
  software: '/software/',
  teaching: '/teaching/',
} as const;

export type PageId = keyof typeof routes;

interface NavigationItem {
  label: string;
  page: PageId;
}

export const primaryNavigation: NavigationItem[] = [
  { page: 'research', label: 'Research' },
  { page: 'software', label: 'Software' },
  { page: 'teaching', label: 'Teaching' },
  { page: 'about', label: 'About' },
];
