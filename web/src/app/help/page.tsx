import { Card } from "@/components/ui/card";

const faqs = [
  "Why do I escrow all funds upfront? To guarantee every payment and eliminate balance failures.",
  "Can anyone execute my payment? Yes, and optional reward incentives keep liveness healthy.",
  "What if I cancel early? Remaining escrow can be withdrawn by the creator.",
  "Is database state authoritative? No. On-chain contract state is always source of truth.",
];

export default function HelpPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <h1 className="text-3xl font-black text-slate-100">Help Center</h1>
      <div className="mt-6 space-y-3">
        {faqs.map((faq) => (
          <Card key={faq}>
            <p className="text-sm text-slate-300">{faq}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
