import { createURLMigration } from 'url-migrations';

// Oldest first. One pass upgrades a link that is several versions behind.
export const migrate = createURLMigration([
  // v2: the search box param was renamed.
  { type: 'rename-key', from: 'search', to: 'q' },
  // v3: the "price" sort was renamed.
  {
    type: 'update-value',
    key: 'sort',
    matches: (url) => url.pathname === '/products',
    action: (value) => (value === 'price' ? 'price_asc' : value),
  },
]);

// Each breaking change in url-contract.json needs an example here: an old URL and the URL it becomes.
export const fixtures = [
  { from: '/products?search=lamp', to: '/products?q=lamp' },
  { from: '/products?sort=price', to: '/products?sort=price_asc' },
];
