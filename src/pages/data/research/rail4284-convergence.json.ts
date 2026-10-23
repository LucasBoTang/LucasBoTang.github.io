import type { APIRoute } from 'astro';
import recording from '../../../data/research/rail4284-convergence.json' with { type: 'json' };

// Preserve the public provenance download while sharing the instrument's canonical recording.
// Astro writes this endpoint to a static JSON file; it needs no runtime server.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(recording, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
