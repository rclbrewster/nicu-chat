import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = new Set([
  "positive",
  "wrong_answer",
  "outdated",
  "missing_info",
  "bug",
  "other",
]);

export async function POST(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const category = String(body.category ?? "other");
  const comment = String(body.comment ?? "").trim();
  const question = typeof body.question === "string" ? body.question : null;
  const answer = typeof body.answer === "string" ? body.answer : null;
  const sources = Array.isArray(body.sources) ? body.sources : null;

  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!comment || comment.length > 4000) {
    return NextResponse.json(
      { error: "Comment is required (max 4000 characters)." },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("feedback").insert({
    user_email: null,
    category,
    comment,
    question,
    answer,
    sources,
  });

  if (error) {
    console.error("feedback insert failed:", error.message);
    return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
