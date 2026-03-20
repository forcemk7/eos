'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

const coverLetterTransport = new DefaultChatTransport({
  api: '/api/cover-letter/chat',
  credentials: 'include',
})

function IconFullscreen({ exit = false }: { exit?: boolean }) {
  if (exit) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  )
}

function IconHistory() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function IconNewChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function IconMoreVertical() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
    </svg>
  )
}

/** Renders an image part: uses imageUrl if present, else fetches signed URL. Images render first (preview); click opens overlay. */
function MessageImagePart({
  storagePath,
  imageUrl,
  onPreview,
}: { storagePath: string; imageUrl?: string; onPreview?: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(imageUrl ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (imageUrl) {
      setUrl(imageUrl)
      return
    }
    let cancelled = false
    fetch(`/api/cover-letter/image?path=${encodeURIComponent(storagePath)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success && data.url) setUrl(data.url)
        else if (!cancelled) setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [storagePath, imageUrl])

  if (failed) {
    return <span className="cover-letter-msg-image-tag">[Image unavailable]</span>
  }
  if (!url) {
    return <span className="cover-letter-msg-image-placeholder">Loading image…</span>
  }
  const content = (
    <img src={url} alt="Attached job listing" className="cover-letter-msg-inline-image" />
  )
  return (
    <span
      className={`cover-letter-msg-inline-image-wrap${onPreview ? ' cover-letter-msg-inline-image-clickable' : ''}`}
      role={onPreview ? 'button' : undefined}
      tabIndex={onPreview ? 0 : undefined}
      onClick={onPreview ? () => onPreview(url) : undefined}
      onKeyDown={onPreview ? (e) => e.key === 'Enter' && onPreview(url) : undefined}
      title={onPreview ? 'View full size' : undefined}
    >
      {content}
    </span>
  )
}

interface PendingImage {
  storagePath: string
  previewUrl: string
}

/** Renders the chat thread and input; only mounted when we have a chat id and loaded messages. */
function CoverLetterChatView({
  chatId,
  initialMessages,
  onError,
  onClearError,
}: {
  chatId: string
  initialMessages: UIMessage[]
  onError: (msg: string) => void
  onClearError: () => void
}) {
  const { messages, sendMessage, status, error: chatError, clearError } = useChat({
    id: chatId,
    messages: initialMessages,
    transport: coverLetterTransport,
  })
  const [inputText, setInputText] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lightboxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatError) onError(chatError.message)
  }, [chatError, onError])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (lightboxUrl) lightboxRef.current?.focus()
  }, [lightboxUrl])

  const sending = status === 'submitted' || status === 'streaming'

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const item = e.clipboardData?.items?.[0]
    if (!item || item.kind !== 'file') return
    const file = item.getAsFile()
    if (!file || !file.type.startsWith('image/')) return
    e.preventDefault()
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/cover-letter/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const storagePath = data.storagePath as string
      const previewUrl = URL.createObjectURL(file)
      setPendingImages((prev) => [...prev, { storagePath, previewUrl }])
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  function handleSend() {
    const parts: Array<{ type: 'text'; text: string } | { type: 'data-storagePath'; data: { storagePath: string } }> = []
    if (inputText.trim()) parts.push({ type: 'text', text: inputText.trim() })
    pendingImages.forEach((p) => parts.push({ type: 'data-storagePath', data: { storagePath: p.storagePath } }))
    if (parts.length === 0 || sending) return
    clearError?.()
    onClearError()
    sendMessage({ parts })
    setInputText('')
    pendingImages.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setPendingImages([])
  }

  const canSend = (inputText.trim() || pendingImages.length > 0) && !sending

  function renderUserMessage(msg: (typeof messages)[0]) {
    const parts = msg.parts ?? []
    const imageParts = parts
      .map((p, i) => (p.type === 'data-storagePath' && 'data' in p ? { p: p as { data: { storagePath: string; imageUrl?: string } }, i } : null))
      .filter((x): x is { p: { data: { storagePath: string; imageUrl?: string } }; i: number } => x != null)
    const textParts = parts
      .map((p, i) => (p.type === 'text' && 'text' in p ? { text: (p as { text: string }).text, i } : null))
      .filter((x): x is { text: string; i: number } => x != null)
    return (
      <>
        {imageParts.length > 0 && (
          <div className="cover-letter-msg-user-attachments">
            {imageParts.map(({ p, i }) => (
              <MessageImagePart
                key={i}
                storagePath={p.data.storagePath}
                imageUrl={p.data.imageUrl}
                onPreview={setLightboxUrl}
              />
            ))}
          </div>
        )}
        {textParts.length > 0 && (
          <div className="cover-letter-msg-user-content">
            <div className="cover-letter-msg-texts">
              {textParts.map(({ text, i }) => (
                <p key={i} className="cover-letter-msg-text">
                  {text}
                </p>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="cover-letter-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`cover-letter-msg cover-letter-msg-${msg.role}`}>
            {msg.role === 'user' ? (
              <div className="cover-letter-msg-user-inner">
                {renderUserMessage(msg)}
              </div>
            ) : (
              <div className="cover-letter-msg-assistant-content">
                <pre className="cover-letter-msg-draft">
                  {msg.parts
                    ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text' && 'text' in p)
                    .map((p) => p.text)
                    .join('') || ''}
                </pre>
                <button
                  type="button"
                  className="secondary-button small"
                  onClick={() => {
                    const text = msg.parts
                      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text' && 'text' in p)
                      .map((p) => p.text)
                      .join('')
                    if (text) navigator.clipboard.writeText(text).catch(() => {})
                  }}
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {lightboxUrl && (
        <div
          ref={lightboxRef}
          className="cover-letter-lightbox"
          role="dialog"
          aria-label="Image full size"
          tabIndex={0}
          onClick={() => setLightboxUrl(null)}
          onKeyDown={(e) => e.key === 'Escape' && setLightboxUrl(null)}
        >
          <button
            type="button"
            className="cover-letter-lightbox-close"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close"
          >
            ×
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
            className="cover-letter-lightbox-img"
          />
        </div>
      )}

      <div className="cover-letter-input-wrap">
        {pendingImages.length > 0 && (
          <div className="cover-letter-pending-images">
            {pendingImages.map((p) => (
              <span key={p.storagePath} className="cover-letter-pending-thumb">
                <img src={p.previewUrl} alt="" />
                <button
                  type="button"
                  className="cover-letter-remove-image"
                  onClick={() => setPendingImages((prev) => prev.filter((x) => x.storagePath !== p.storagePath))}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="cover-letter-input-row">
          <textarea
            className="cover-letter-input"
            placeholder="Paste job listing (image or text) or type a follow-up… (Enter to send, Shift+Enter for new line)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSend) handleSend()
              }
            }}
            rows={3}
            aria-label="Message"
            disabled={sending}
          />
          <button
            type="button"
            className="primary-button cover-letter-send"
            onClick={handleSend}
            disabled={!canSend}
            title="Send (Enter)"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </>
  )
}

interface ChatItem {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

interface DbMessagePart {
  type: string
  text?: string
  storagePath?: string
  imageUrl?: string | null
}

interface DbMessage {
  id: string
  role: 'user' | 'assistant'
  content: { parts?: DbMessagePart[] }
  created_at: string
}

const SESSION_KEY_VISITED = 'earnOS_coverLetter_visited'
const SESSION_KEY_LAST_CHAT = 'earnOS_coverLetter_lastChatId'

/** Convert DB message shape to SDK UIMessage (id, role, parts). Image parts become data-storagePath; imageUrl used for display. */
function dbMessagesToUIMessages(dbMessages: DbMessage[]): UIMessage[] {
  return dbMessages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: (m.content?.parts ?? []).map((p) => {
      if (p.type === 'text' && typeof p.text === 'string') {
        return { type: 'text' as const, text: p.text }
      }
      if (p.type === 'image' && typeof p.storagePath === 'string') {
        return {
          type: 'data-storagePath' as const,
          data: { storagePath: p.storagePath, imageUrl: p.imageUrl ?? undefined },
        }
      }
      return { type: 'text' as const, text: '' }
    }),
  }))
}

export default function CoverLetterTab() {
  const [chats, setChats] = useState<ChatItem[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [loadedMessages, setLoadedMessages] = useState<UIMessage[] | null>(null)
  const [loadingChats, setLoadingChats] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuChatId, setMenuChatId] = useState<string | null>(null)
  const [renameChatId, setRenameChatId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenRef = useRef<HTMLDivElement>(null)
  const sessionInitialized = useRef(false)

  const filteredChats = historySearch.trim()
    ? chats.filter((c) => (c.title ?? 'Untitled').toLowerCase().includes(historySearch.trim().toLowerCase()))
    : chats

  const loadChats = useCallback(async () => {
    setLoadingChats(true)
    setError(null)
    try {
      const res = await fetch('/api/cover-letter/chats', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load chats')
      setChats(data.chats ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chats')
    } finally {
      setLoadingChats(false)
    }
  }, [])

  useEffect(() => {
    loadChats()
  }, [loadChats])

  // First time opening Cover letter this session → auto-create a new chat. Tab/app switch → restore last chat.
  useEffect(() => {
    if (sessionInitialized.current || typeof window === 'undefined') return
    sessionInitialized.current = true

    const visited = window.sessionStorage.getItem(SESSION_KEY_VISITED)
    const lastChatId = window.sessionStorage.getItem(SESSION_KEY_LAST_CHAT)

    if (!visited) {
      window.sessionStorage.setItem(SESSION_KEY_VISITED, '1')
      fetch('/api/cover-letter/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.chat) {
            const chat = data.chat as ChatItem
            setChats((prev) => [chat, ...prev])
            setCurrentChatId(chat.id)
            setLoadedMessages([])
            window.sessionStorage.setItem(SESSION_KEY_LAST_CHAT, chat.id)
          }
        })
        .catch(() => {})
      return
    }

    if (lastChatId) {
      setCurrentChatId(lastChatId)
    }
  }, [])

  useEffect(() => {
    if (!currentChatId) {
      setLoadedMessages(null)
      return
    }
    let cancelled = false
    fetch(`/api/cover-letter/chats/${currentChatId}`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 404) {
          if (!cancelled) {
            setCurrentChatId(null)
            setLoadedMessages(null)
            persistLastChatId(null)
          }
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled || data === null) return
        if (data.success && Array.isArray(data.messages)) {
          setLoadedMessages(dbMessagesToUIMessages(data.messages))
        } else {
          setLoadedMessages([])
        }
      })
      .catch(() => {
        if (!cancelled) setLoadedMessages([])
      })
    return () => {
      cancelled = true
    }
  }, [currentChatId])

  function persistLastChatId(chatId: string | null) {
    try {
      if (typeof window !== 'undefined') {
        if (chatId) window.sessionStorage.setItem(SESSION_KEY_LAST_CHAT, chatId)
        else window.sessionStorage.removeItem(SESSION_KEY_LAST_CHAT)
      }
    } catch {
      // ignore
    }
  }

  async function handleNewChat() {
    setError(null)
    try {
      const res = await fetch('/api/cover-letter/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create chat')
      const chat = data.chat as ChatItem
      setChats((prev) => [chat, ...prev])
      setCurrentChatId(chat.id)
      setLoadedMessages([])
      persistLastChatId(chat.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create chat')
    }
  }

  async function handleRename(chat: ChatItem) {
    setRenameChatId(chat.id)
    setRenameValue(chat.title ?? '')
  }

  async function submitRename() {
    if (!renameChatId) return
    setError(null)
    try {
      const res = await fetch(`/api/cover-letter/chats/${renameChatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameValue.trim() || 'Untitled' }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rename failed')
      setChats((prev) =>
        prev.map((c) => (c.id === renameChatId ? { ...c, title: (data.chat as ChatItem).title } : c))
      )
      setRenameChatId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed')
    }
  }

  async function handleDelete(chat: ChatItem) {
    if (!confirm('Delete this chat and all its messages?')) return
    setError(null)
    try {
      const res = await fetch(`/api/cover-letter/chats/${chat.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Delete failed')
      }
      setChats((prev) => prev.filter((c) => c.id !== chat.id))
      if (currentChatId === chat.id) {
        setCurrentChatId(null)
        persistLastChatId(null)
      }
      setMenuChatId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  function toggleFullscreen() {
    const el = fullscreenRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  function openHistoryAndSelect(chatId: string) {
    setCurrentChatId(chatId)
    persistLastChatId(chatId)
    setHistoryDrawerOpen(false)
    setMenuChatId(null)
  }

  return (
    <div ref={fullscreenRef} className="cover-letter-tab cover-letter-chat-layout">
      <header className="cover-letter-top-bar">
        <div className="cover-letter-top-bar-left">
          <button
            type="button"
            className="cover-letter-top-bar-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            <IconFullscreen exit={isFullscreen} />
          </button>
        </div>
        <div className="cover-letter-top-bar-right">
          <button
            type="button"
            className="cover-letter-top-bar-btn cover-letter-top-bar-btn-text"
            onClick={() => setHistoryDrawerOpen(true)}
            aria-label="History"
          >
            <IconHistory />
            <span>History</span>
          </button>
          <button
            type="button"
            className="cover-letter-top-bar-btn cover-letter-top-bar-btn-text"
            onClick={() => {
              setHistoryDrawerOpen(false)
              handleNewChat()
            }}
            aria-label="New chat"
          >
            <IconNewChat />
            <span>New chat</span>
          </button>
        </div>
      </header>

      {historyDrawerOpen && (
        <>
          <div
            className="cover-letter-drawer-overlay"
            role="button"
            tabIndex={0}
            onClick={() => setHistoryDrawerOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setHistoryDrawerOpen(false)}
            aria-label="Close history"
          />
          <aside className="cover-letter-drawer" aria-label="Chat history">
            <div className="cover-letter-drawer-search-wrap">
              <IconSearch />
              <input
                type="search"
                className="cover-letter-drawer-search"
                placeholder="Search chats…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setHistoryDrawerOpen(false)}
                aria-label="Search chats"
                autoFocus
              />
            </div>
            {loadingChats ? (
              <ul className="cover-letter-chat-list" aria-busy="true" aria-label="Loading chats">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="cover-letter-drawer-skeleton-item">
                    <div className="jobs-skeleton-line jobs-skeleton-line--title" />
                    <div className="jobs-skeleton-line jobs-skeleton-line--meta mt-2" />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="cover-letter-chat-list">
                {filteredChats.map((chat) => (
                  <li key={chat.id} className="cover-letter-chat-list-item">
                    <button
                      type="button"
                      className={`cover-letter-chat-item ${currentChatId === chat.id ? 'active' : ''}`}
                      onClick={() => openHistoryAndSelect(chat.id)}
                    >
                      <span className="cover-letter-chat-item-title">{chat.title || 'Untitled'}</span>
                      <span className="cover-letter-chat-item-date">
                        {new Date(chat.updated_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="cover-letter-chat-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuChatId(menuChatId === chat.id ? null : chat.id)
                      }}
                      aria-label="Rename or delete chat"
                      title="Rename or delete"
                    >
                      <IconMoreVertical />
                    </button>
                    {menuChatId === chat.id && (
                      <div className="cover-letter-chat-menu">
                        <button
                          type="button"
                          className="cover-letter-chat-menu-item"
                          onClick={() => {
                            handleRename(chat)
                            setMenuChatId(null)
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="cover-letter-chat-menu-item cover-letter-chat-menu-item-delete"
                          onClick={() => handleDelete(chat)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!loadingChats && filteredChats.length === 0 && (
              <p className="cover-letter-drawer-empty">
                {historySearch.trim() ? 'No chats match your search.' : 'No chats yet.'}
              </p>
            )}
          </aside>
        </>
      )}

      {renameChatId && (
        <div className="cover-letter-rename-overlay" role="dialog" aria-label="Rename chat">
          <div className="cover-letter-rename-modal">
            <label htmlFor="cover-letter-rename-input">Chat title</label>
            <input
              id="cover-letter-rename-input"
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename()
                if (e.key === 'Escape') setRenameChatId(null)
              }}
              className="cover-letter-rename-input"
            />
            <div className="cover-letter-rename-actions">
              <button type="button" className="secondary-button" onClick={() => setRenameChatId(null)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={submitRename}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cover-letter-main">
        {!currentChatId ? (
          <div className="cover-letter-empty">
            <h2 className="cover-letter-title">Cover letter</h2>
            <p className="cover-letter-hint">
              Select a chat from history or start a new one.
            </p>
          </div>
        ) : loadedMessages === null ? (
          <div className="cover-letter-loading-wrap">
            <p className="cover-letter-loading">Loading…</p>
          </div>
        ) : (
          <>
            {error && <p className="jobs-error">{error}</p>}
            <CoverLetterChatView
              key={currentChatId}
              chatId={currentChatId}
              initialMessages={loadedMessages}
              onError={setError}
              onClearError={() => setError(null)}
            />
          </>
        )}
      </div>
    </div>
  )
}
