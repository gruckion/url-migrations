import { GlobalBar } from '@/components/global-bar';
import { Tabs } from '@/components/tabs';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Tabs />
        <GlobalBar />
        {children}
      </body>
    </html>
  );
}
