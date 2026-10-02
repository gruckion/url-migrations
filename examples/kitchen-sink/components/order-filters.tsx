'use client';

import { useQueryStates } from 'nuqs';

import { orderSchema, orderUrlKeys } from '@/lib/order-schema';

export function OrderFilters() {
  const [query, setQuery] = useQueryStates(orderSchema, { urlKeys: orderUrlKeys });
  return <button onClick={() => setQuery({ page: query.page + 1 })}>Page {query.page}</button>;
}
