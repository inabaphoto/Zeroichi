export async function notifyError(summary: string, details?: Record<string, unknown>) {
  try {
    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (!webhook) return;
    const text = `:rotating_light: ${summary}` + (details ? `\n\n\`\`\`${JSON.stringify(details, null, 2)}\`\`\`` : "");
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // ignore notification errors
  }
}

