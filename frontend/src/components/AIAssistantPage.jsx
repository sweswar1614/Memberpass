import { useState, useEffect, useRef } from 'react';
import { aiApi } from '../services/api';

export default function AIAssistantPage({
  currentUser,
  onNavigateHome,
  onNavigateDashboard,
  onOpenAuthModal
}) {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Suggested prompt cards as specified in UI/UX requirements
  const suggestedPrompts = [
    {
      id: 'status',
      title: 'Check my membership status',
      desc: 'View your active plan, pass status & verification state',
      icon: 'fa-id-card-clip'
    },
    {
      id: 'classes',
      title: 'How many classes have I attended?',
      desc: 'Check completed sessions & remaining class balance',
      icon: 'fa-calendar-check'
    },
    {
      id: 'expiry',
      title: 'When does my membership expire?',
      desc: 'Check expiration date & days remaining in your cycle',
      icon: 'fa-hourglass-half'
    },
    {
      id: 'plans',
      title: 'Explain the membership plans',
      desc: 'Compare Basic, Standard, and Premium yoga tiers',
      icon: 'fa-layer-group'
    },
    {
      id: 'pause',
      title: 'How can I pause my membership?',
      desc: 'Learn how to temporarily freeze your yoga pass',
      icon: 'fa-circle-pause'
    }
  ];

  // Auto scroll to bottom whenever messages update or loading changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    const userMessageId = 'user-' + Date.now();
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append user message
    const userMessage = {
      id: userMessageId,
      sender: 'user',
      text: query,
      time: currentTime
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await aiApi.chat(query);

      const aiMessageId = 'ai-' + Date.now();
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (response && response.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: aiMessageId,
            sender: 'assistant',
            text: response.answer || 'I have processed your query.',
            time: replyTime,
            requiresAuth: response.requiresAuth || false
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: aiMessageId,
            sender: 'assistant',
            text: response?.message || 'Unable to retrieve answer. Please try again or check server connectivity.',
            time: replyTime,
            isError: true
          }
        ]);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'ai-err-' + Date.now(),
          sender: 'assistant',
          text: 'Unable to connect to MemberPass AI. Please check whether the server and AI services are running.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setInputQuery('');
  };

  const handleCopyMessage = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to render basic markdown-like formatting (bold, bullet points, line breaks)
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;

    // Split text into lines
    const lines = rawText.split('\n');

    return lines.map((line, lineIdx) => {
      // Process bold markers (**text**)
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const parsedParts = parts.map((part, partIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      // Check if bullet point
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return (
          <div key={lineIdx} className="chat-bullet-line">
            <span className="bullet-dot">•</span>
            <span>{parsedParts}</span>
          </div>
        );
      }

      return (
        <p key={lineIdx} className="chat-paragraph">
          {parsedParts.length > 0 ? parsedParts : '\u00A0'}
        </p>
      );
    });
  };

  return (
    <div className="ai-page-wrapper">
      <div className="ai-page-container">
        {/* =========================================================================
            HEADER & TOP TOOLBAR
            ========================================================================= */}
        <header className="ai-chat-header">
          <div className="ai-header-left">
            <nav className="ai-breadcrumb" aria-label="Breadcrumb">
              <button className="breadcrumb-link" onClick={onNavigateHome}>
                MemberPass
              </button>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">AI Assistant</span>
            </nav>

            <div className="ai-title-row">
              <div className="ai-avatar-badge">
                <span className="ai-badge-monogram">M</span>
                <span className="ai-badge-sparkle">✦</span>
              </div>
              <div>
                <h1 className="ai-page-title">AI Yoga &amp; Wellness Assistant</h1>
                <p className="ai-page-subtitle">
                  Intelligent conversational assistant for memberships, classes &amp; passes
                </p>
              </div>
            </div>
          </div>

          <div className="ai-header-right">
            <div className="ai-status-indicator" title="AI Service Status">
              <span className="status-pulse-dot" />
              <span className="status-text">Online • Ready</span>
            </div>

            {messages.length > 0 && (
              <button
                className="ai-action-btn ai-clear-btn"
                onClick={handleClearChat}
                title="Start a new conversation"
              >
                <i className="fa-solid fa-arrows-rotate" />
                <span>New Chat</span>
              </button>
            )}

            {currentUser ? (
              <button
                className="ai-action-btn ai-dashboard-btn"
                onClick={onNavigateDashboard}
                title="Return to Dashboard"
              >
                <i className="fa-solid fa-gauge" />
                <span>Dashboard</span>
              </button>
            ) : (
              <button
                className="ai-action-btn ai-signin-btn"
                onClick={() => onOpenAuthModal && onOpenAuthModal('login')}
                title="Sign in for member queries"
              >
                <i className="fa-solid fa-arrow-right-to-bracket" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* =========================================================================
            USER CONTEXT STRIP
            ========================================================================= */}
        <div className="ai-context-banner">
          {currentUser ? (
            <div className="context-banner-content logged-in">
              <span className="context-chip active">
                <i className="fa-solid fa-circle-check" />
                Authenticated Member
              </span>
              <span className="context-text">
                Connected as <strong>{currentUser.name}</strong> • Account active for live balance &amp; class inquiries
              </span>
            </div>
          ) : (
            <div className="context-banner-content guest">
              <span className="context-chip guest">
                <i className="fa-solid fa-user" />
                Guest Mode
              </span>
              <span className="context-text">
                General studio knowledge active. To check personal pass balances and attendance,{' '}
                <button
                  className="context-link-btn"
                  onClick={() => onOpenAuthModal && onOpenAuthModal('login')}
                >
                  Sign in to your account
                </button>
                .
              </span>
            </div>
          )}
        </div>

        {/* =========================================================================
            MAIN CHAT DISPLAY AREA
            ========================================================================= */}
        <main className="ai-messages-viewport">
          {messages.length === 0 ? (
            /* =====================================================================
               WELCOME SCREEN (Displayed when no active conversation)
               ===================================================================== */
            <div className="ai-welcome-screen">
              <div className="welcome-illustration-wrap">
                <div className="welcome-halo" />
                <div className="welcome-crest-center">
                  <span className="welcome-crest-monogram">M</span>
                  <span className="welcome-sparkle-top">✦</span>
                  <span className="welcome-sparkle-bottom">✦</span>
                </div>
              </div>

              <div className="welcome-text-block">
                <span className="welcome-eyebrow">MEMBERPASS INTELLIGENCE</span>
                <h2 className="welcome-heading">How can I assist your wellness journey today?</h2>
                <p className="welcome-description">
                  Ask me about your live membership status, class usage, digital QR pass, or studio policies.
                  Select a suggested topic below or type your inquiry.
                </p>
              </div>

              <div className="welcome-prompts-grid">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    className="suggested-prompt-card"
                    onClick={() => handleSendMessage(prompt.title)}
                    disabled={isLoading}
                  >
                    <div className="prompt-icon-bubble">
                      <i className={`fa-solid ${prompt.icon}`} />
                    </div>
                    <div className="prompt-text-group">
                      <span className="prompt-title">{prompt.title}</span>
                      <span className="prompt-desc">{prompt.desc}</span>
                    </div>
                    <div className="prompt-arrow-cue">
                      <i className="fa-solid fa-arrow-right" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* =====================================================================
               CONVERSATION THREAD (Message bubbles)
               ===================================================================== */
            <div className="chat-thread">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message-row ${msg.sender === 'user' ? 'row-user' : 'row-assistant'}`}
                >
                  {msg.sender === 'assistant' && (
                    <div className="chat-avatar assistant-avatar" title="MemberPass AI">
                      <span>M✦</span>
                    </div>
                  )}

                  <div className={`chat-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-assistant'} ${msg.isError ? 'bubble-error' : ''}`}>
                    <div className="bubble-header">
                      <span className="bubble-author">
                        {msg.sender === 'user' ? (currentUser?.name ? currentUser.name : 'You') : 'MemberPass Assistant'}
                      </span>
                      <span className="bubble-timestamp">{msg.time}</span>
                    </div>

                    <div className="bubble-body">
                      {renderFormattedText(msg.text)}
                    </div>

                    {msg.requiresAuth && !currentUser && (
                      <div className="bubble-auth-action">
                        <button
                          className="bubble-cta-btn"
                          onClick={() => onOpenAuthModal && onOpenAuthModal('login')}
                        >
                          <i className="fa-solid fa-lock-open" />
                          <span>Sign In to View Member Records</span>
                        </button>
                      </div>
                    )}

                    <div className="bubble-actions">
                      <button
                        className="bubble-action-btn"
                        onClick={() => handleCopyMessage(msg.id, msg.text)}
                        title="Copy message"
                      >
                        <i className={`fa-solid ${copiedId === msg.id ? 'fa-check' : 'fa-copy'}`} />
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="chat-avatar user-avatar" title="You">
                      <span>{currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'ME'}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator while AI responds */}
              {isLoading && (
                <div className="chat-message-row row-assistant">
                  <div className="chat-avatar assistant-avatar">
                    <span>M✦</span>
                  </div>
                  <div className="chat-bubble bubble-assistant bubble-typing">
                    <div className="typing-indicator" aria-label="AI Assistant is responding">
                      <span className="typing-dot dot-1" />
                      <span className="typing-dot dot-2" />
                      <span className="typing-dot dot-3" />
                    </div>
                    <span className="typing-label">Consulting MemberPass intelligence...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* =========================================================================
            BOTTOM CHAT INPUT
            ========================================================================= */}
        <footer className="ai-chat-input-dock">
          {messages.length > 0 && (
            <div className="quick-prompt-chips">
              <span className="chips-label">Suggested follow-ups:</span>
              <button
                className="chip-btn"
                onClick={() => handleSendMessage('Check my membership status')}
                disabled={isLoading}
              >
                Status
              </button>
              <button
                className="chip-btn"
                onClick={() => handleSendMessage('How many classes have I attended?')}
                disabled={isLoading}
              >
                Classes Used
              </button>
              <button
                className="chip-btn"
                onClick={() => handleSendMessage('When does my membership expire?')}
                disabled={isLoading}
              >
                Expiry Date
              </button>
              <button
                className="chip-btn"
                onClick={() => handleSendMessage('Explain the membership plans')}
                disabled={isLoading}
              >
                Plans
              </button>
              <button
                className="chip-btn"
                onClick={() => handleSendMessage('How can I pause my membership?')}
                disabled={isLoading}
              >
                Pause Pass
              </button>
            </div>
          )}

          <form className="ai-input-form" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
            <div className="input-textarea-wrapper">
              <textarea
                ref={textareaRef}
                className="ai-textarea"
                rows={1}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isLoading
                    ? 'MemberPass AI is thinking...'
                    : 'Ask MemberPass AI (e.g. membership status, class usage, digital passes)...'
                }
                disabled={isLoading}
              />
              <button
                type="submit"
                className={`ai-send-btn ${inputQuery.trim() ? 'has-text' : ''}`}
                disabled={!inputQuery.trim() || isLoading}
                aria-label="Send inquiry"
              >
                {isLoading ? (
                  <i className="fa-solid fa-spinner fa-spin" />
                ) : (
                  <i className="fa-solid fa-paper-plane" />
                )}
              </button>
            </div>

            <div className="input-dock-footer">
              <span className="keyboard-hint">
                Press <kbd>Enter ↵</kbd> to send • <kbd>Shift + Enter</kbd> for new line
              </span>
              <span className="ai-privacy-note">
                <i className="fa-solid fa-shield-halved" /> Confidential MemberPass Intelligence
              </span>
            </div>
          </form>
        </footer>
      </div>
    </div>
  );
}
