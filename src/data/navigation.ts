// Shared page routes for navigation, content links and build validation.
export const routes = {
  home: '/',
  about: '/about/',
  research: '/research/',
  software: '/software/',
} as const;

export type PageId = keyof typeof routes;

export interface NavigationItem {
  label: string;
  page: PageId;
}

export const primaryNavigation: NavigationItem[] = [
  { page: 'research', label: 'Research' },
  { page: 'software', label: 'Software' },
  { page: 'about', label: 'About' },
];
