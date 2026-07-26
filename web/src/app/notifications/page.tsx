import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 md:px-8">
      <h1 className="text-3xl font-black text-slate-100">Notifications</h1>
      <Card>
        <h2 className="text-lg font-semibold text-slate-100">Delivery Channels</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input placeholder="Email endpoint" />
          <Input placeholder="Telegram chat ID" />
          <Input placeholder="Discord webhook URL" />
          <Input placeholder="Custom webhook URL" />
        </div>
        <Button className="mt-4">Save Channels</Button>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold text-slate-100">Triggers</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Payment executed</li>
          <li>Schedule completed</li>
          <li>Schedule cancelled</li>
          <li>Execution failure</li>
          <li>Low executor balance</li>
        </ul>
      </Card>
    </main>
  );
}
