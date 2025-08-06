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

Deno.serve(async (req) => {
  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // --- Step 1: Parse JSON body ---
    let body;
    try {
      body = await req.json();
    } catch (err) {
      console.error("❌ Error parsing JSON body:", err);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message, user_id } = body;
    if (!message || !user_id) {
      console.error("❌ Missing message or user_id in request.");
      return new Response(
        JSON.stringify({ error: "Missing message or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    debugLog("Request Body", body);

    const authHeader = req.headers.get("authorization");

    // --- Step 2: Create Supabase client ---
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL) {
      throw new Error("❌ Missing SUPABASE_URL environment variable");
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
    }
    

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    // --- Step 3: Sentiment analysis ---
    let sentiment_score = 0;
    try {
      const sentimentCheck = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Try "gpt-3.5-turbo" if this fails
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

    // --- Step 4: Tone selection ---
    let tonePrompt =
      sentiment_score < -0.3
        ? "Be extra empathetic, validating, and reassuring."
        : sentiment_score > 0.3
        ? "Be positive, celebratory, and motivational."
        : "Be encouraging, practical, and neutral.";

    // --- Step 5: CBT AI response ---
    let ai_reply = "";
    try {
      const cbtResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Try "gpt-3.5-turbo" if this fails
        messages: [
          {
            role: "system",
            content: `You are a CBT-based productivity coach. ${tonePrompt}`,
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

    // --- Step 6: Store in Supabase ---
    try {
      const { error: insertError } = await supabase.from("conversations").insert([
        { 
          user_id, 
          messages: message, 
          role: "user", 
          sentiment_score
        },
        { 
          user_id, 
          messages: ai_reply, 
          role: "ai", 
          sentiment_score
        },
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

    // ✅ Success
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
