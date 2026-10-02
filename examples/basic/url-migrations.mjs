import { createURLMigration } from 'url-migrations';

// Oldest first. One pass upgrades a link that is several versions behind.
export const migrate = createURLMigration([
  // v2: the search box param was renamed.
  { type: 'rename-key', from: 'search', to: 'q' },
]);

// Each breaking change in url-contract.json needs an example here: an old URL and the URL it becomes.
export const fixtures = [{ from: '/products?search=lamp', to: '/products?q=lamp' }];
