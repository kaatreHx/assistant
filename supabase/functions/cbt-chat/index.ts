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

// --- Redirection messages ---
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
    const body = await req.json();
    const { message, user_id } = body;

    if (!message || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing message or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    debugLog("Request Body", body);

    const quickReplies = ["ok", "okay", "alright", "fine", "yep", "yes", "nah", "nope"];
    if (quickReplies.includes(message.trim().toLowerCase())) {
      const friendlyFollowUps = [
        "Alright, take your time. I’m here if you need to talk.",
        "Okay 😊. Let me know if you want to share more.",
        "Got it. How are you feeling now?",
        "Alright. Whenever you’re ready, we can chat more.",
      ];
      const reply = friendlyFollowUps[Math.floor(Math.random() * friendlyFollowUps.length)];
      return new Response(
        JSON.stringify({ reply, sentiment: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("authorization");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("❌ Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    // --- Fetch last few messages ---
    const { data: prevMessages, error: fetchError } = await supabase
      .from("conversations")
      .select("messages, role")
      .eq("user_id", user_id)
      .order("id", { ascending: false })
      .limit(5);

    const contextMessages = [];
    if (!fetchError && prevMessages) {
      for (let i = prevMessages.length - 1; i >= 0; i--) {
        const msg = prevMessages[i];
        contextMessages.push({
          role: msg.role === "ai" ? "assistant" : "user",
          content: msg.messages,
        });
      }
    }

    contextMessages.push({ role: "user", content: message });

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

    // --- GROQ API ---
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY env var");

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "You are MindMate, a friendly CBT companion. Keep answers short, warm, and supportive." },
          ...contextMessages
        ],
        max_tokens: 150
      })
    });

    let ai_reply = redirectionMessages[Math.floor(Math.random() * redirectionMessages.length)];
    if (groqResponse.ok) {
      const groqData = await groqResponse.json();
      ai_reply = groqData.choices[0]?.message?.content?.trim() || ai_reply;
    } else {
      console.error("GROQ API error:", await groqResponse.text());
    }

    // --- Save to Supabase ---
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