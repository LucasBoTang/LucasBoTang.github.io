// Media queries that scripts share. CSS writes the same widths literally, as media queries
// cannot read custom properties.
/** The single-column phone layout. */
const PHONE_QUERY = '(max-width: 720px)';

/** Whether the single-column phone layout is showing. */
export const isPhone = () => matchMedia(PHONE_QUERY).matches;

/** Openings run at this fraction of their duration on phones, where each screen holds less. */
export const phonePace = () => (isPhone() ? 0.8 : 1);
