export async function extractConsolidatedInfo(text: string) {

  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  const url =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + API_KEY;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text }]
        }
      ]
    })
  });

  const data = await response.json();

  return data;
}
