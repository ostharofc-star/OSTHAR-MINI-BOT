const axios = require("axios");

async function geminiText(prompt) {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model =
    String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const response = await axios.post(
    url,
    {
      contents: [
        {
          parts: [
            { text: String(prompt || "").slice(0, 50000) }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1800
      }
    },
    { timeout: 60000 }
  );

  const text =
    response?.data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("\n")
      .trim();

  if (!text) {
    throw new Error("AI returned an empty response.");
  }

  return text;
}

module.exports = {
  geminiText
};
