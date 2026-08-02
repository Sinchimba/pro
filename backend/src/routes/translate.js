import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router = Router();

// Validate Base64 image pattern
const BASE64_IMAGE_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,/;

router.post("/translate-sign", authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    const { image, language } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image frame data." });
    }

    // Input Validation: Check if it is a valid base64 image data URL
    if (typeof image !== "string" || (!BASE64_IMAGE_REGEX.test(image) && !image.startsWith("data:image/"))) {
      logger.security("Invalid image frame data format submitted", { userId });
      return res.status(400).json({ error: "Invalid image format. Only JPEG, PNG, and WebP data URLs are allowed." });
    }

    const lang = language || "ASL";
    if (!["ASL", "BSL", "ISL"].includes(lang)) {
      return res.status(400).json({ error: "Unsupported sign language." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      // Clean base64 header if present
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      // Input Validation: Check that the base64 string doesn't contain invalid characters
      if (!/^[a-zA-Z0-9+/={}\s]+$/.test(base64Data.slice(0, 100))) {
        logger.security("Malicious or malformed base64 payload detected", { userId });
        return res.status(400).json({ error: "Malformed image data." });
      }

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
          
          logger.info("Sign language cloud translation successful", { userId, word: parsed.word, lang });
          return res.json({
            word: parsed.word || "",
            confidence: parsed.confidence || 0.0,
            mode: "cloud"
          });
        } catch (e) {
          logger.error("Failed to parse Gemini JSON output", e, { textResult, userId });
        }
      }
    } else {
      logger.security("GEMINI_API_KEY is not set. Cloud translation fallback to empty response.", { userId });
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
    logger.error("Backend sign translation error", error, { userId });
    res.status(500).json({ error: "Failed to translate sign language gesture." });
  }
});

export default router;
