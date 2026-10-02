export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: 'compact' | 'full'; q?: string }>;
}) {
  const { view } = await searchParams;
  return <div>{view}</div>;
}
