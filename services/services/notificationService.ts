export async function sendDataToWebhook(data: any) {
  const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL;

  if (!WEBHOOK_URL) {
    console.log("Webhook chưa được cấu hình");
    return;
  }

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error("Webhook error:", err);
  }
}
