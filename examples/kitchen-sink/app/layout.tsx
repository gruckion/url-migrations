import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

import { SelectionBadge } from '@/components/selection-badge';
import { ThemeSwitch } from '@/components/theme-switch';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NuqsAdapter>
          <ThemeSwitch />
          <SelectionBadge />
          {children}
        </NuqsAdapter>
      </body>
    </html>
  );
}
