import { routes } from '../src/data/navigation';

/** Exercise the actual missing-route response, not only the generated 404 file. */
export const missingPageRoute = '/missing-page/';
export const contentPageRoutes = Object.values(routes).filter((route) => route !== routes.home);
