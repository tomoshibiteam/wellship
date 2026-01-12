import VesselDetailClient from './vessel-detail-client';

export default function VesselDetailPage({
  params,
}: {
  params: { vesselId: string };
}) {
  return <VesselDetailClient vesselId={params.vesselId} />;
}
