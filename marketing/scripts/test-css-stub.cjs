// Unit tests import pages and components; a page may import its own stylesheet (route-scoped CSS: app/layout.tsx).
// Next.js bundles those imports; Node can't parse CSS, so under `npm test` a .css import loads as an empty module.
require.extensions[".css"] = () => {};
