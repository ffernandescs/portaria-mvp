import { GateDisplay } from '@/components/gate/gate-display';

type Props = {
  params: Promise<{ gateId: string }>;
};

export default async function GateDisplayPage({ params }: Props) {
  const { gateId } = await params;
  return <GateDisplay gateId={gateId} />;
}
