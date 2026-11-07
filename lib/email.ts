/**
 * Minimal outbound email via Resend's HTTP API (no SDK dependency). Used
 * only for the "Request access code" flow — forwards the requester's email
 * to whoever reviews access requests, who then manually sends a code back.
 */
export async function sendAccessRequestEmail(requesterEmail: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "RESEND_API_KEY is not set — access request from",
      requesterEmail,
      "was saved but not emailed.",
    );
    return;
  }

  const from = process.env.ACCESS_REQUEST_FROM || "NICU Wayfinder <onboarding@resend.dev>";
  const to = process.env.ACCESS_REQUEST_TO || "rbrewster@stanford.edu";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: requesterEmail,
      subject: "NICU Wayfinder access request",
      text: `${requesterEmail} requested an access code for NICU Wayfinder.\n\nReply to this email (it's set to reply-to them directly) or review and send a code manually.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend request failed:", res.status, body);
  }
}
