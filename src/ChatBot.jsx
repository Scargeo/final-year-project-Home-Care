import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './ChatBot.css'

function normalizeMarkdown(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\s+(#{1,6}\s+)/g, '\n\n$1')
    .replace(/\s+(\d+\.\s+)/g, '\n$1')
    .replace(/\s+([*-]\s+)(?=[^*])/g, '\n$1')
    .replace(/\s+(•\s+)/g, '\n$1')
    .replace(/\s+(>\s+)/g, '\n$1')
    .replace(/\s+(```)/g, '\n$1')
    .replace(/\*\s*\n/g, '\n* ')
    .replace(/\n\s+\*/g, '\n*')
    .trim()
}

const markdownComponents = {
  h1: ({ children, ...props }) => (
    <h1 className="message__heading message__heading--xl" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="message__heading message__heading--lg" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="message__heading message__heading--md" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="message__heading message__heading--sm" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="message__paragraph" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="message__list message__list--bullet" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="message__list message__list--numbered" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="message__list-item" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="message__strong" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="message__em" {...props}>
      {children}
    </em>
  ),
  a: ({ children, ...props }) => (
    <a className="message__link" target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="message__blockquote" {...props}>
      {children}
    </blockquote>
  ),
  code: ({ inline, children, ...props }) =>
    inline ? (
      <code className="message__code" {...props}>
        {children}
      </code>
    ) : (
      <pre className="message__pre">
        <code {...props}>{children}</code>
      </pre>
    ),
}

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
              {message.sender === 'bot' ? (
                <div className="message__text message__text--bot-rich">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {normalizeMarkdown(message.text)}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="message__text">{message.text}</p>
              )}
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
