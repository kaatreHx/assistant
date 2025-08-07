import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";

function VoiceCBT() {
  const [isRecording, setIsRecording] = useState(false);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const recognitionRef = useRef(null);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();

  // Fetch and check session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        navigate("/");
      } else {
        setUserId(session.user.id);
      }
    };
    checkSession();
  }, [navigate]);

  // Send message to Supabase Edge Function
  async function sendMessage(text) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const res = await fetch(
        "https://azkftkxnhizydsuvcgpd.functions.supabase.co/cbt-voice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: text,
            user_id: userId,
          }),
        }
      );

      const result = await res.json();
      if (res.ok) {
        setResponse(result.reply);
        speakText(result.reply);
        console.log(result)
      } else {
        console.error("Error from server:", result);
        setResponse("⚠️ Error: " + result?.error || "Something went wrong.");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setResponse("⚠️ Failed to connect.");
    }
  }

  const speakText = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ne-NP"; // You can change to "ne-NP" for Nepali
    utterance.pitch = 1;
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
  };  
  

  // Start voice recognition
  const handleStart = () => {
    setIsRecording(true);
    setInput("");
    setResponse("");

    if (!("webkitSpeechRecognition" in window)) {
      alert("Your browser does not support speech recognition.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      sendMessage(transcript);
    };

    recognition.onerror = (event) => {
        setIsRecording(false);
        switch (event.error) {
          case "no-speech":
            alert("No speech detected. Please try again and speak clearly.");
            break;
          case "audio-capture":
            alert("No microphone detected. Please check your mic settings.");
            break;
          case "not-allowed":
            alert("Microphone access denied. Please allow permission.");
            break;
          default:
            alert("Speech recognition error: " + event.error);
        }
        console.error("Speech recognition error:", event.error);
      };
      

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  // Stop voice recognition
  const handleStop = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>🧠 CBT Voice Chat</h2>

      <div style={styles.svgContainer}>
        <svg
          width="100%"
          height="100"
          viewBox="0 0 500 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* <polyline
            points="0,60 20,40 40,70 60,30 80,60 100,40 120,70 140,30 160,60 180,40 200,70"
            fill="none"
            stroke="#4caf50"
            strokeWidth="4"
          /> */}
        </svg>
      </div>

      <div
        style={styles.micButton}
        onMouseDown={handleStart}
        onMouseUp={handleStop}
        onTouchStart={handleStart}
        onTouchEnd={handleStop}
      >
        🎤
      </div>

      <p style={{ color: isRecording ? "red" : "gray", marginTop: "10px" }}>
        {isRecording ? "Listening..." : "Hold the mic to speak"}
      </p>

      {input && (
        <div style={styles.responseBubble}>
          <strong>You:</strong> {input}
        </div>
      )}

      {response && (
        <div style={{ ...styles.responseBubble, backgroundColor: "#e8f5e9" }}>
          <strong>AI:</strong> {response}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    textAlign: "center",
    padding: "30px",
    background: "#f9f9f9",
    borderRadius: "20px",
    width: "90%",
    maxWidth: "500px",
    margin: "40px auto",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    fontFamily: "Arial, sans-serif",
  },
  heading: {
    marginBottom: "20px",
  },
  svgContainer: {
    background: "#fff",
    borderRadius: "10px",
    padding: "10px",
    marginBottom: "20px",
    height: "100px",
  },
  micButton: {
    width: "80px",
    height: "80px",
    background: "#4caf50",
    color: "#fff",
    borderRadius: "50%",
    fontSize: "30px",
    lineHeight: "80px",
    margin: "0 auto",
    cursor: "pointer",
    userSelect: "none",
  },
  responseBubble: {
    marginTop: "20px",
    background: "#ffffff",
    padding: "15px 20px",
    borderRadius: "10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    textAlign: "left",
    color: "#333",
  },
};

export default VoiceCBT;
