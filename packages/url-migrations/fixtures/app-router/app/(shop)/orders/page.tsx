import { OrderFilters } from '@/components/order-filters';
import { LegacyReader } from '@/components/legacy-reader';

export default function Page() {
  return (
    <>
      <OrderFilters />
      <LegacyReader />
    </>
  );
}
