'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';

export function OrderPanel() {
  const [panel, setPanel] = useQueryState('panel', parseAsStringLiteral(['notes', 'files']));
  return <button onClick={() => setPanel(panel === 'notes' ? 'files' : 'notes')}>{panel}</button>;
}
