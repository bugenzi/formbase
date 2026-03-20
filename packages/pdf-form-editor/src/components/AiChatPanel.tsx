import React, { useState, useRef, useEffect } from 'react'
import { useEditorContext } from '../context/EditorContext'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function AiChatPanel(): React.ReactElement {
  const { aiProxyUrl } = useEditorContext()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch(aiProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }

      const data = await response.json()
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply ?? data.message ?? 'No response',
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${(e as Error).message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-chat-panel">
      <h3 className="pfe-sidebar__title" style={{ marginBottom: 8 }}>AI Assistant</h3>

      <div className="ai-chat-panel__messages" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="ai-chat-panel__empty">
            Ask AI to detect form fields, describe your document, or get help with field placement.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`ai-chat-panel__msg ai-chat-panel__msg--${msg.role}`}
          >
            <span className="ai-chat-panel__msg-role">
              {msg.role === 'user' ? 'You' : 'AI'}
            </span>
            <p>{msg.content}</p>
          </div>
        ))}
        {loading && (
          <p className="ai-chat-panel__loading">Thinking...</p>
        )}
      </div>

      <div className="ai-chat-panel__input-row">
        <input
          className="ai-chat-panel__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask AI..."
          disabled={loading}
        />
        <button
          className="ai-chat-panel__send"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  )
}
