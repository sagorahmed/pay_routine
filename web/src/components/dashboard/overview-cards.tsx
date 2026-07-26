import { Card } from "@/components/ui/card";

type Metric = {
  label: string;
  value: string;
  helper: string;
};

export function OverviewCards({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <p className="text-xs uppercase tracking-widest text-slate-400">{metric.label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{metric.value}</p>
          <p className="mt-1 text-sm text-slate-400">{metric.helper}</p>
        </Card>
      ))}
    </div>
  );
}
