import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import CallPage from './secure/CallPage.jsx'
import ChatPage from './secure/ChatPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/secure/call" element={<CallPage />} />
        <Route path="/secure/chat" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
