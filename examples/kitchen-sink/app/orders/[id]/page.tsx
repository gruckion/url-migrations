import { OrderPanel } from '@/components/order-panel';

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: 'details' | 'history' }>;
}) {
  const { tab } = await searchParams;
  return (
    <div>
      {tab}
      <OrderPanel />
    </div>
  );
}
