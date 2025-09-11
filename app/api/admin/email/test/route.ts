import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const { to } = await req.json();
    if (!to) return NextResponse.json({ error: "Missing 'to' address" }, { status: 400 });

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { data, error } = await resend.emails.send({
      to,
      from: process.env.RESEND_FROM_EMAIL || "WebInstant <onboarding@resend.dev>",
      subject: "Test email ✔",
      html: "<p>Resend test is configured correctly.</p>",
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

