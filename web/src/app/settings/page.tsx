import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 md:px-8">
      <h1 className="text-3xl font-black text-slate-100">Settings</h1>
      <Card>
        <h2 className="text-lg font-semibold text-slate-100">Profile</h2>
        <div className="mt-4 space-y-3">
          <Input placeholder="Display name" defaultValue="PayRoutine Operator" />
          <Input placeholder="Email" defaultValue="ops@payroutine.xyz" />
          <Button>Save Profile</Button>
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold text-slate-100">Execution Preferences</h2>
        <div className="mt-4 space-y-3">
          <Input placeholder="Default executor reward" defaultValue="0.02" />
          <Input placeholder="Max retry attempts" defaultValue="5" />
          <Button variant="secondary">Save Preferences</Button>
        </div>
      </Card>
    </main>
  );
}
