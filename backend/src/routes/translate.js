import { Router } from "express";

const router = Router();

// Dictionary of common signs for BSL, ASL, ISL for local/simulation fallback
const simulatedSigns = {
  ASL: [
    { word: "Hello", confidence: 0.96 },
    { word: "Thank You", confidence: 0.94 },
    { word: "Please", confidence: 0.91 },
    { word: "Yes", confidence: 0.98 },
    { word: "No", confidence: 0.97 },
    { word: "Help", confidence: 0.89 },
    { word: "Excuse Me", confidence: 0.88 },
    { word: "I Love You", confidence: 0.95 }
  ],
  BSL: [
    { word: "Hello", confidence: 0.95 },
    { word: "Good Morning", confidence: 0.92 },
    { word: "Please", confidence: 0.90 },
    { word: "Thank You", confidence: 0.93 },
    { word: "Goodbye", confidence: 0.91 },
    { word: "Sorry", confidence: 0.87 }
  ],
  ISL: [
    { word: "Namaste", confidence: 0.97 },
    { word: "Thank You", confidence: 0.93 },
    { word: "Welcome", confidence: 0.91 },
    { word: "Please", confidence: 0.89 },
    { word: "Good Job", confidence: 0.94 }
  ]
};

router.post("/translate-sign", async (req, res) => {
  try {
    const { image, language } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image frame data." });
    }

    const lang = language || "ASL";
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      // Clean base64 header if present
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this image frame. The user is performing a sign language gesture in ${lang}. If a sign is detected, translate it into English text. Return only a JSON object matching this schema: {"word": "translated word or phrase", "confidence": 0.95}. If no sign is detected or it is ambiguous, return {"word": "", "confidence": 0.0}. Output only the raw JSON. Do not include markdown formatting.`
                  },
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const responseData = await response.json();
      const textResult = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (textResult) {
        try {
          // Clean potential markdown formatting wraps (like ```json ... ```)
          let cleaned = textResult.trim();
          if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
          }
          const parsed = JSON.parse(cleaned.trim());
          return res.json({
            word: parsed.word || "",
            confidence: parsed.confidence || 0.0,
            mode: "cloud"
          });
        } catch (e) {
          console.error("Failed to parse Gemini JSON output:", textResult, e);
        }
      }
    } else {
      console.warn("[Sign Language Translation] GEMINI_API_KEY is not set. Cloud translation is inactive.");
      return res.json({
        word: "",
        confidence: 0.0,
        mode: "cloud",
        error: "GEMINI_API_KEY is not configured."
      });
    }

    return res.json({
      word: "",
      confidence: 0.0,
      mode: "cloud"
    });

  } catch (error) {
    console.error("[Backend Sign Translation Error]:", error);
    res.status(500).json({ error: "Failed to translate sign language gesture." });
  }
});

export default router;
