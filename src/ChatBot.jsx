import { useEffect, useRef, useState } from 'react'
import './ChatBot.css'

function ChatBot({ onClose, apiBaseUrl = '' }) {
  const [messages, setMessages] = useState([
    {
      id: 'initial',
      text: 'Hello! I\'m your Home Care AI Assistant. I can help you with medical information and answer questions about healthcare. How can I help you today?',
      sender: 'bot',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSendMessage = async (e) => {
    e.preventDefault()

    if (!input.trim()) return

    // Add user message
    const userMessage = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    const hostBasedUrl = `${window.location.protocol}//${window.location.hostname}:8000`
    const normalizedBaseUrl = (apiBaseUrl || hostBasedUrl).replace(/\/+$/, '')

    try {
      const response = await fetch(`${normalizedBaseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `Server error: ${response.statusText}`)
      }

      // Add bot response
      const botMessage = {
        id: Date.now() + 1,
        text: data.response || 'I encountered an error processing your request.',
        sender: 'bot',
        timestamp: new Date(),
        context: data.context || [],
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      console.error('Error:', error)

      const errorMessage = {
        id: Date.now() + 1,
        text: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        sender: 'bot',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h3 className="chatbot-title">HomeCare AI Assistant</h3>
        <button className="chatbot-close" onClick={onClose} aria-label="Close chatbot">
          ✕
        </button>
      </div>

      <div className="chatbot-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message message--${message.sender}`}>
            <div className="message__content">
              <p className="message__text">{message.text}</p>
              {message.context && message.context.length > 0 && (
                <details className="message__sources">
                  <summary>View sources ({message.context.length})</summary>
                  <div className="sources-list">
                    {message.context.map((source, idx) => (
                      <div key={idx} className="source-item">
                        <small>{source}</small>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <span className="message__time">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message message--bot">
            <div className="message__content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chatbot-input-form" onSubmit={handleSendMessage}>
        <input
          ref={inputRef}
          type="text"
          className="chatbot-input"
          placeholder="Ask me anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="chatbot-send"
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default ChatBot
