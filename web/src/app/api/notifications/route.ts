import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  userAddress: z.string().startsWith("0x").length(42),
  channels: z.object({
    email: z.string().email().optional(),
    telegram: z.string().optional(),
    discordWebhook: z.string().url().optional(),
    webhook: z.string().url().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Notification preferences saved",
    data: parsed.data,
  });
}
