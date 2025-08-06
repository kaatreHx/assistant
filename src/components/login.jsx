// src/components/Login.jsx
import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom' // if you're using React Router
import { supabase } from '../utils/supabaseClient'

const Login = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('User already logged in:', session)
        navigate('/dashboard') // or wherever you want to redirect
      }
    }
    checkSession()
  }, [])

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    if (error) {
      console.error('Google login error:', error.message)
    }
  }

  return (
    <div>
      <h2>Login</h2>
      <button onClick={handleGoogleLogin}>
        Sign in with Google
      </button>
    </div>
  )
}

export default Login
