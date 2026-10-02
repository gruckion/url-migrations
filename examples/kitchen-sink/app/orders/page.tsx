import { OrderFilters } from '@/components/order-filters';
import { SelectionProvider } from '@/features/orders/provider';

export default function OrdersPage() {
  return (
    <SelectionProvider>
      <OrderFilters />
    </SelectionProvider>
  );
}
