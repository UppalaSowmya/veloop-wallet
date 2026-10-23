import { useState } from 'react'
import api from './api/axios'
import './Login.css'

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (isRegister) {
        await api.post('/auth/register', { name, email, password })
        setMessage('Registration successful! Please log in.')
        setIsRegister(false)
        setName('')
        setPassword('')
      } else {
        const response = await api.post('/auth/login', {
          email,
          password,
        })

        const { token, user } = response.data

        if (!token) {
          throw new Error('Login succeeded but no token was returned.')
        }

        localStorage.setItem('token', token)
        onLogin(user)
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">V</div>
        <h1>VELoop</h1>
        <p className="auth-subtitle">
          {isRegister
            ? 'Create your rewards account'
            : 'Welcome back! Sign in to your wallet.'}
        </p>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <label>
              Full name
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : isRegister
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setError('')
              setMessage('')
            }}
          >
            {isRegister ? 'Sign in' : 'Register'}
          </button>
        </p>
      </section>
    </main>
  )
}

export default Login