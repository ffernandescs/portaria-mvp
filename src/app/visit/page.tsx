import { VisitFlow } from '@/components/visit/visit-flow';

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VisitPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return <VisitFlow token={token ?? null} />;
}
