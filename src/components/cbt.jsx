import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabaseClient'

const CBTChat = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const chatEndRef = useRef(null)
  const navigate = useNavigate()
  const [userId, setUserId] = useState(null)

  // ✅ Check user session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/') // redirect to login
      } else {
        setUserId(session.user.id) // store user ID
      }
    }
    checkSession()
  }, [navigate])

  // ✅ Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ✅ Add message to UI
  const addMessageToUI = (sender, text) => {
    setMessages(prev => [...prev, { sender, text }])
  }

  // ✅ Send message to backend
  async function sendMessage(text) {
    if (!text.trim()) return

    // Show user message instantly
    addMessageToUI("user", text)
    setInput('')

    try {
      // Get the user's access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      console.log(accessToken)
      // Call Supabase Edge Function
      const res = await fetch('https://azkftkxnhizydsuvcgpd.functions.supabase.co/cbt-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: text,
          user_id: userId // pass logged-in user ID
        })
      })

      const data = await res.json()

      if (data.reply) {
        addMessageToUI("ai", data.reply) // show AI reply
      } else {
        addMessageToUI("ai", "⚠️ Sorry, something went wrong.")
      }

    } catch (err) {
      console.error("Send message error:", err)
      addMessageToUI("ai", "⚠️ Could not reach the server.")
    }
  }

  // ✅ Voice-to-text handler
  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice recognition not supported in this browser.')
      return
    }

    const recognition = new window.webkitSpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.start()

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
    }
  }

  // ✅ Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>CBT Chat</h2>
        <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
      </div>

      <div style={styles.chatBox}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              ...styles.message,
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.sender === 'user' ? '#DCF8C6' : '#FFF',
            }}
          >
            {msg.text}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div style={styles.inputBox}>
        <button onClick={handleVoiceInput} style={styles.micButton}>🎤</button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={styles.input}
          placeholder="Type your message..."
        />
        <button onClick={() => sendMessage(input)} style={styles.sendButton}>➤</button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '1rem',
    fontFamily: 'Arial, sans-serif',
    border: '1px solid #ccc',
    borderRadius: '8px',
    height: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  chatBox: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: '#F5F5F5',
    borderRadius: '6px',
  },
  message: {
    padding: '10px 14px',
    borderRadius: '20px',
    maxWidth: '80%',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  inputBox: {
    display: 'flex',
    marginTop: '10px',
    gap: '10px',
  },
  input: {
    flex: 1,
    padding: '10px',
    borderRadius: '20px',
    border: '1px solid #ccc',
  },
  sendButton: {
    background: '#4CAF50',
    color: 'white',
    padding: '10px 14px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
  },
  micButton: {
    background: '#eee',
    padding: '10px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
  },
}

export default CBTChat
