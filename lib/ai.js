// ======================================================
// OSTHAR MINI BOT - GEMINI AI
// Auto-select supported Flash model
// ======================================================

const MODEL_CACHE_MS = 10 * 60 * 1000;

let cachedModel = null;
let cachedAt = 0;

// ======================================================
// API KEY
// ======================================================

function getApiKey() {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  return apiKey;
}

// ======================================================
// NORMALIZE MODEL NAME
// ======================================================

function normalizeModelName(name = "") {
  return String(name)
    .replace(/^models\//, "")
    .trim();
}

// ======================================================
// LIST AVAILABLE MODELS
// ======================================================

async function listModels() {
  const apiKey =
    getApiKey();

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models" +
    `?key=${encodeURIComponent(apiKey)}`;

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      15000
    );

  try {
    const response =
      await fetch(url, {
        method: "GET",
        signal:
          controller.signal
      });

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `Models API HTTP ${response.status}`
      );
    }

    return Array.isArray(
      data?.models
    )
      ? data.models
      : [];

  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Gemini model lookup timed out."
      );
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}

// ======================================================
// CHECK generateContent SUPPORT
// ======================================================

function supportsGenerateContent(
  model
) {
  const methods =
    model?.supportedGenerationMethods;

  return (
    Array.isArray(methods) &&
    methods.includes(
      "generateContent"
    )
  );
}

// ======================================================
// MODEL SCORE
// ======================================================

function modelScore(name = "") {
  const value =
    normalizeModelName(name)
      .toLowerCase();

  // Prefer current text Flash models.
  if (
    value ===
    "gemini-3.6-flash"
  ) {
    return 1000;
  }

  if (
    value.includes(
      "gemini-3.6-flash"
    )
  ) {
    return 950;
  }

  if (
    value.includes(
      "gemini-3.5-flash"
    ) &&
    !value.includes("lite")
  ) {
    return 900;
  }

  if (
    value.includes(
      "gemini-3.1-flash"
    ) &&
    !value.includes("image") &&
    !value.includes("tts") &&
    !value.includes("lite")
  ) {
    return 850;
  }

  if (
    value.includes(
      "gemini-3-flash"
    ) &&
    !value.includes("image") &&
    !value.includes("tts")
  ) {
    return 800;
  }

  if (
    value.includes(
      "gemini"
    ) &&
    value.includes(
      "flash"
    ) &&
    !value.includes("image") &&
    !value.includes("tts") &&
    !value.includes("live")
  ) {
    return 700;
  }

  if (
    value.includes(
      "gemini"
    ) &&
    value.includes(
      "pro"
    ) &&
    !value.includes("image")
  ) {
    return 500;
  }

  return 0;
}

// ======================================================
// SELECT MODEL
// ======================================================

async function getBestModel(
  forceRefresh = false
) {
  const now =
    Date.now();

  if (
    !forceRefresh &&
    cachedModel &&
    now - cachedAt <
      MODEL_CACHE_MS
  ) {
    return cachedModel;
  }

  const models =
    await listModels();

  const configured =
    normalizeModelName(
      process.env.GEMINI_MODEL ||
      ""
    );

  // First try configured model if it is actually available.
  if (configured) {
    const match =
      models.find(model => {
        const name =
          normalizeModelName(
            model?.name
          );

        return (
          name === configured &&
          supportsGenerateContent(
            model
          )
        );
      });

    if (match) {
      cachedModel =
        configured;

      cachedAt = now;

      console.log(
        `[AI] Using configured model: ${cachedModel}`
      );

      return cachedModel;
    }

    console.log(
      `[AI] Configured model unavailable: ${configured}`
    );
  }

  // Select the best supported text model.
  const candidates =
    models
      .filter(
        supportsGenerateContent
      )
      .map(model => ({
        model,
        name:
          normalizeModelName(
            model?.name
          ),
        score:
          modelScore(
            model?.name
          )
      }))
      .filter(
        item =>
          item.score > 0
      )
      .sort(
        (a, b) =>
          b.score - a.score
      );

  if (
    !candidates.length
  ) {
    throw new Error(
      "No supported Gemini text model is available for this API key."
    );
  }

  cachedModel =
    candidates[0].name;

  cachedAt = now;

  console.log(
    `[AI] Auto-selected model: ${cachedModel}`
  );

  return cachedModel;
}

// ======================================================
// REQUEST
// ======================================================

async function callGenerateContent(
  model,
  prompt,
  options
) {
  const apiKey =
    getApiKey();

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent`;

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      45000
    );

  try {
    const response =
      await fetch(url, {
        method: "POST",

        signal:
          controller.signal,

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey
        },

        body:
          JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text:
                    options.system ||
                    "You are a helpful WhatsApp bot assistant. Give accurate, clear and concise answers."
                }
              ]
            },

            contents: [
              {
                role: "user",

                parts: [
                  {
                    text:
                      prompt
                  }
                ]
              }
            ],

            generationConfig: {
              temperature:
                options.temperature ??
                0.7,

              maxOutputTokens:
                options.maxOutputTokens ||
                1200
            }
          })
      });

    const data =
      await response.json();

    if (!response.ok) {
      const error =
        new Error(
          data?.error?.message ||
          `Gemini API HTTP ${response.status}`
        );

      error.status =
        response.status;

      throw error;
    }

    const parts =
      data?.candidates?.[0]
        ?.content?.parts ||
      [];

    const text =
      parts
        .map(
          part =>
            part?.text ||
            ""
        )
        .join("")
        .trim();

    if (!text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    return text;

  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "AI request timed out."
      );
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}

// ======================================================
// MAIN AI FUNCTION
// ======================================================

async function generateAI(
  prompt,
  options = {}
) {
  if (!prompt?.trim()) {
    throw new Error(
      "AI prompt is empty."
    );
  }

  let model =
    await getBestModel();

  try {
    return await callGenerateContent(
      model,
      prompt.trim(),
      options
    );

  } catch (error) {
    const message =
      String(
        error?.message ||
        ""
      ).toLowerCase();

    const modelProblem =
      error?.status === 404 ||
      message.includes(
        "no longer available"
      ) ||
      message.includes(
        "not found"
      ) ||
      message.includes(
        "not supported"
      ) ||
      message.includes(
        "model"
      ) &&
      message.includes(
        "available"
      );

    if (!modelProblem) {
      throw error;
    }

    console.log(
      `[AI] Model failed: ${model}`
    );

    console.log(
      "[AI] Refreshing Gemini model list..."
    );

    cachedModel = null;
    cachedAt = 0;

    model =
      await getBestModel(
        true
      );

    return await callGenerateContent(
      model,
      prompt.trim(),
      options
    );
  }
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  generateAI,
  listModels,
  getBestModel
};