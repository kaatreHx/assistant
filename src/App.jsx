import Login from './components/login'
import CBTChat from './components/cbt'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<CBTChat />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
