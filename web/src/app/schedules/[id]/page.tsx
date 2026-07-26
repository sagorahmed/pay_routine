import { ScheduleDetail } from "@/components/schedule/schedule-detail";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <ScheduleDetail id={id} />
    </main>
  );
}
