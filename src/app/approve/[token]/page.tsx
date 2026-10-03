import { ApprovePanel } from '@/components/approve/approve-panel';

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ApprovePage({ params }: Props) {
  const { token } = await params;
  return <ApprovePanel token={token} />;
}
