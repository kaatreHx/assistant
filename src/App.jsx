import Login from './components/login'
import CBTChat from './components/cbt'
import CBTDashboard from './components/dashboard'
import VoiceChat from './components/voicecbt'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<CBTDashboard />} />
          <Route path="/chat" element={<CBTChat />} />
          <Route path="/voice" element={<VoiceChat />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
