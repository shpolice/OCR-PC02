export async function extractConsolidatedInfo(text: string) {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
    {
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
    }
  );

  const data = await res.json();

if (!data.candidates) {
  console.error(data);
  return "Gemini API error";
}

return data.candidates[0].content.parts[0].text;
}
