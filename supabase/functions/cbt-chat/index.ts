// supabase/functions/cbt-chat/index.ts

import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js";

// --- OpenAI init ---
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
if (!OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in environment variables.");
}
const openai = new OpenAI({ apiKey: OPENAI_API_KEY || "" });

// --- CORS headers ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// --- Debug helper ---
function debugLog(step: string, data: any) {
  console.log(`🔍 [${step}]`, JSON.stringify(data, null, 2));
}

// --- Redirection messages if off-topic ---
const redirectionMessages = [
  "I'm here to help with how you're feeling. Want to talk about it?",
  "Let’s focus on your emotional well-being. How are you doing today?",
  "I'm here to listen if you're feeling off or stressed. What's on your mind?",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message, user_id } = body;
    if (!message || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing message or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    debugLog("Request Body", body);

    const authHeader = req.headers.get("authorization");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("❌ Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    // --- Sentiment Analysis ---
    let sentiment_score = 0;
    try {
      const sentimentCheck = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Return only a number between -1.0 and 1.0 for sentiment.",
          },
          { role: "user", content: message },
        ],
        temperature: 0,
      });

      const rawScore = sentimentCheck.choices[0]?.message?.content?.trim() || "0";
      sentiment_score = parseFloat(rawScore);
      if (isNaN(sentiment_score)) sentiment_score = 0;

      debugLog("Sentiment Score", { rawScore, sentiment_score });
    } catch (err) {
      console.error("❌ Sentiment analysis failed:", err);
      return new Response(
        JSON.stringify({ error: "Sentiment analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Tone Prompt ---
    let tonePrompt =
      sentiment_score < -0.3
        ? "Be extra empathetic, validating, and reassuring."
        : sentiment_score > 0.3
        ? "Be positive, celebratory, and motivational."
        : "Be encouraging, practical, and neutral.";

    // --- CBT Response or Redirection ---
    let ai_reply = "";
    try {
      const cbtResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a CBT-based AI assistant. Keep responses short (max 2-3 lines), focused only on emotional well-being, productivity, or coping strategies. If the user's message is off-topic (like talking about games, entertainment, or random chat), do not respond to that directly—instead, respond with one of these:
${redirectionMessages.map((msg, i) => `(${i + 1}) "${msg}"`).join("\n")}
Use CBT techniques like validating, reframing, and goal-setting where appropriate.`,
          },
          { role: "user", content: message },
        ],
        temperature: 0.7,
      });

      ai_reply = cbtResponse.choices[0]?.message?.content?.trim() || "";
      debugLog("AI Reply", ai_reply);
    } catch (err) {
      console.error("❌ CBT AI response failed:", err);
      return new Response(
        JSON.stringify({ error: "AI response generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Save conversation ---
    try {
      const { error: insertError } = await supabase.from("conversations").insert([
        { user_id, messages: message, role: "user", sentiment_score },
        { user_id, messages: ai_reply, role: "ai", sentiment_score },
      ]);

      if (insertError) {
        console.error("❌ Supabase insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Database insert failed", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (err) {
      console.error("❌ Supabase DB error:", err);
      return new Response(
        JSON.stringify({ error: "Database operation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ reply: ai_reply, sentiment: sentiment_score }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
