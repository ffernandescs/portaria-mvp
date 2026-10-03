import { ResidentNotify } from '@/components/resident/resident-notify';

type Props = {
  params: Promise<{ residentId: string }>;
};

export default async function ResidentNotifyPage({ params }: Props) {
  const { residentId } = await params;
  return <ResidentNotify residentId={residentId} />;
}
