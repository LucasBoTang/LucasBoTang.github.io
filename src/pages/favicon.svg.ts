import type { APIRoute } from 'astro';
import { theme } from '../data/theme';

// Prerendered as /favicon.svg; no server is required.
export const GET: APIRoute = () =>
  new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${theme.ink}"/><path fill="${theme.blue}" fill-rule="evenodd" d="M15 12h7v16c3-4 7-6 12-6 10 0 16 7 16 17s-6 17-16 17c-5 0-9-2-12-6v5h-7zm17 17c-6 0-10 4-10 10s4 10 10 10 10-4 10-10-4-10-10-10z"/></svg>`,
    {
      headers: { 'Content-Type': 'image/svg+xml' },
    },
  );
