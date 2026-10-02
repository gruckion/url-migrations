import { createURLMigration } from 'url-migrations';

const onOrders = (url) => url.pathname === '/orders';

// Oldest first. One pass upgrades a link that is several versions behind.
export const migrate = createURLMigration([
  // custom rule that moves the route: /clients became /customers.
  {
    type: 'custom',
    matches: (url) => url.pathname === '/clients',
    action: (_params, url) => {
      url.pathname = '/customers';
    },
  },
  // rename-key: ?team=a,b became ?team_ids=a,b.
  { type: 'rename-key', from: 'team', to: 'team_ids', matches: onOrders },
  // update-value: the "cancelled" status was merged into "void". Return null to drop a value.
  {
    type: 'update-value',
    key: 'status',
    matches: onOrders,
    action: (value) => (value === 'cancelled' ? 'void' : value),
  },
  // remove-key: page size is no longer a link option.
  { type: 'remove-key', key: 'per_page', matches: onOrders },
  // custom: ?sort=newest split into a sort key and a direction.
  {
    type: 'custom',
    matches: onOrders,
    action: (params) => {
      if (params.get('sort') !== 'newest') return;
      params.set('sort', 'created');
      params.set('dir', 'desc');
    },
  },
]);

// Each breaking change in url-contract.json needs an example here: an old URL and the URL it becomes.
export const fixtures = [
  { from: '/clients?status=open', to: '/customers?status=open' },
  { from: '/orders?team=a,b', to: '/orders?team_ids=a,b' },
  { from: '/orders?status=cancelled', to: '/orders?status=void' },
  { from: '/orders?per_page=50', to: '/orders' },
  { from: '/orders?sort=newest', to: '/orders?sort=created&dir=desc' },
];

// A break that needs no migration, for example a retired page nobody links to. Say why.
//   { route: '/retired', reason: 'feature removed, no inbound links' }
export const waivers = [];
