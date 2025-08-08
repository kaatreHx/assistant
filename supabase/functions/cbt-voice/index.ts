import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
if (!OPENAI_API_KEY) console.error("❌ Missing OPENAI_API_KEY");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY || "" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { message, user_id } = body;

    if (!message || !user_id) {
      return new Response(JSON.stringify({ error: "Missing message or user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("❌ Supabase environment variables missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    // --- QUICK REPLY DETECTION ---
    const quickReplyRegex = /^(ok(ay)?|alright|fine|yep|yes|nah|nope)[.! ]*$/i;
    if (quickReplyRegex.test(message.trim())) {
      const friendlyFollowUps = [
        "Alright, take your time. I’m here if you need to talk.",
        "Okay 😊. Let me know if you want to share more.",
        "Got it. How are you feeling now?",
        "Alright. Whenever you’re ready, we can chat more.",
      ];
      const reply = friendlyFollowUps[Math.floor(Math.random() * friendlyFollowUps.length)];

      // Store quick reply + response
      await supabase.from("conversations").insert([
        { user_id, messages: message, role: "user", sentiment_score: 0 },
        { user_id, messages: reply, role: "ai", sentiment_score: 0 },
      ]);

      return new Response(
        JSON.stringify({ reply, sentiment: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Sentiment Analysis ---
    let sentiment_score = 0;
    try {
      const sentimentCheck = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Return only a number between -1.0 and 1.0 for sentiment." },
          { role: "user", content: message },
        ],
        temperature: 0,
      });

      const rawScore = sentimentCheck.choices[0]?.message?.content?.trim() || "0";
      sentiment_score = parseFloat(rawScore);
      if (isNaN(sentiment_score)) sentiment_score = 0;
    } catch (err) {
      console.error("❌ Sentiment error:", err);
      return new Response(JSON.stringify({ error: "Sentiment analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Tone and Brevity Prompt ---
    const tonePrompt =
      sentiment_score < -0.4
        ? "Use warm, validating, and caring language. Be *brief* but comforting. Assume the user is emotionally overwhelmed, so keep it concise and gentle."
        : sentiment_score > 0.4
        ? "Use upbeat, cheerful, and short motivational replies. Keep it under 15 words and uplifting."
        : "Be calm, neutral, and encouraging. Keep it short and soothing, not too wordy.";

    // --- Redirection Messages ---
    const redirectionMessages = [
      "I'm here to help with how you're feeling. Want to talk about it?",
      "Let’s focus on your emotional well-being. How are you doing today?",
      "I'm here to listen if you're feeling off or stressed. What's on your mind?",
    ];
    const redirectLine = redirectionMessages[Math.floor(Math.random() * redirectionMessages.length)];

    const { data: history, error: historyError } = await supabase
      .from("conversations")
      .select("role, messages")
      .eq("user_id", user_id)
      .order("id", { ascending: false })
      .limit(6);

    if (historyError) {
      console.error("❌ History fetch error:", historyError);
    }

    const conversationHistory = (history || [])
      .reverse()
      .map((entry) => ({
        role: entry.role === "ai" ? "assistant" : "user",
        content: entry.messages,
      }));

    conversationHistory.push({ role: "user", content: message });

    // --- AI CBT Response ---
    let ai_reply = "";
    try {
      const cbtResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
              You are a CBT (Cognitive Behavioral Therapy) AI. Your job: help the user feel emotionally better.

              Rules:
              - Reply in 1–2 short sentences only.
              - Show warmth, empathy, and natural variation in phrasing so it feels human.
              - Focus only on feelings, mood, stress, or thoughts.
              - If off-topic: gently redirect with this exact line: "${redirectLine}"
              - If emotion + unrelated request: acknowledge the feeling first, then suggest a healthy coping idea.
              - Avoid medical, tech, or factual info.

              Tone: ${tonePrompt}
              Be creative but brief.
              `,
          },
          ...conversationHistory,
        ],
        temperature: 0.7,
      });

      ai_reply = cbtResponse.choices[0]?.message?.content?.trim() || "";
    } catch (err) {
      console.error("❌ AI response error:", err);
      return new Response(JSON.stringify({ error: "AI reply failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Store in Supabase ---
    try {
      const { error: insertError } = await supabase.from("conversations").insert([
        { user_id, messages: message, role: "user", sentiment_score },
        { user_id, messages: ai_reply, role: "ai", sentiment_score },
      ]);

      if (insertError) {
        console.error("❌ Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Insert failed", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (err) {
      console.error("❌ DB error:", err);
      return new Response(JSON.stringify({ error: "DB failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ reply: ai_reply, sentiment: sentiment_score }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected failure" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
