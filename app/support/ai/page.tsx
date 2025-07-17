"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';

interface UserInfo {
  name: string;
  email: string;
  phone: string;
  category: string;
  message: string;
}

type ChatMessage = { role: "user" | "ai"; content: string; fallback?: boolean };

export default function SupportAIPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [exited, setExited] = useState(false);
  const [review, setReview] = useState<{ rating: number; comment: string }>({ rating: 0, comment: "" });
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [muted] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [urgency, setUrgency] = useState<'urgent' | 'not_urgent' | null>(null);

  // Load user info from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("supportForm");
    if (stored) {
      const info = JSON.parse(stored);
      setUserInfo(info);
      setMessages([
        { role: "user", content: info.message },
      ]);
      // Automatically send the initial message to the AI (no delay, streaming)
      sendToAI(info.message, info);
    } else {
      router.replace("/support");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Play sound on new AI message
  useEffect(() => {
    if (messages.length > 1 && messages[messages.length - 1].role === "ai" && !muted) {
      audioRef.current?.play();
    }
  }, [messages, muted]);

  const handleCopy = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1200);
  }, []);

  function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Gemini AI chat handler (calls backend)
  const sendToAI = async (userMsg: string, userInfoOverride?: UserInfo) => {
    setLoading(true);
    setError(null);
    let aiContent = "";
    setMessages((msgs) => [...msgs, { role: "ai", content: "" }]);
    try {
      const res = await fetch("/api/gemini-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInfo: userInfoOverride || userInfo, messages: [...messages, { role: "user", content: userMsg }] }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        // Try to parse error message from backend
        let errorMsg = `AI service error. (HTTP ${res.status})`;
        try {
          const errData = await res.json();
          errorMsg =
            (errData.error ? `AI error: ${errData.error}` : '') +
            (errData.details ? `\nDetails: ${errData.details}` : '') +
            (errData.message ? `\nMessage: ${errData.message}` : '') +
            `\n(HTTP ${res.status})`;
          // If fallback generic response is present, show it
          if (errData.fallback && errData.answer) {
            setMessages((msgs) => {
              const updated = [...msgs];
              let lastIdx = updated.length - 1;
              while (lastIdx >= 0 && updated[lastIdx].role !== "ai") lastIdx--;
              if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], content: errData.answer, fallback: true };
              return updated;
            });
            setLoading(false);
            return;
          }
        } catch {
          // If JSON parse fails, try to get text
          try {
            const text = await res.text();
            errorMsg += `\nRaw response: ${text}`;
          } catch {}
        }
        setError(errorMsg);
        setLoading(false);
        setMessages((msgs) => {
          // Remove the last empty AI message
          const updated = [...msgs];
          let lastIdx = updated.length - 1;
          while (lastIdx >= 0 && updated[lastIdx].role !== "ai") lastIdx--;
          if (lastIdx >= 0) updated.splice(lastIdx, 1);
          return updated;
        });
        return;
      }
      if (contentType.includes("application/json")) {
        // Non-streaming: parse the whole response at once
        const data = await res.json();
        if (data.fallback && data.answer) {
          setMessages((msgs) => {
            const updated = [...msgs];
            let lastIdx = updated.length - 1;
            while (lastIdx >= 0 && updated[lastIdx].role !== "ai") lastIdx--;
            if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], content: data.answer, fallback: true };
            return updated;
          });
          setLoading(false);
          return;
        }
        if (Array.isArray(data)) {
          for (const chunk of data) {
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (typeof text === "string") aiContent += text;
          }
        } else {
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text === "string") aiContent += text;
        }
        if (!aiContent) {
          setError("AI did not return a response.");
          setMessages((msgs) => {
            // Remove the last empty AI message
            const updated = [...msgs];
            let lastIdx = updated.length - 1;
            while (lastIdx >= 0 && updated[lastIdx].role !== "ai") lastIdx--;
            if (lastIdx >= 0) updated.splice(lastIdx, 1);
            return updated;
          });
          setLoading(false);
          return;
        }
        setMessages((msgs) => {
          const updated = [...msgs];
          let lastIdx = updated.length - 1;
          while (lastIdx >= 0 && updated[lastIdx].role !== "ai") lastIdx--;
          if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], content: aiContent };
          return updated;
        });
        setLoading(false);
      } else if (res.body) {
        // Streaming logic (as before)
        const reader = res.body.getReader();
        let done = false;
        const decoder = new TextDecoder();
        let buffer = "";
        let gotContent = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const json = JSON.parse(line);
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (typeof text === "string") {
                  aiContent += text;
                  gotContent = true;
                  setMessages((msgs) => {
                    const updated = [...msgs];
                    let lastIdx = updated.length - 1;
                    while (lastIdx >= 0 && updated[lastIdx].role !== "ai") lastIdx--;
                    if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], content: aiContent };
                    return updated;
                  });
                }
              } catch {
                // ignore JSON parse errors for incomplete lines
              }
            }
          }
        }
        if (!gotContent) {
          setError("AI did not return a response.");
          setMessages((msgs) => {
            // Remove the last empty AI message
            const updated = [...msgs];
            let lastIdx = updated.length - 1;
            while (lastIdx >= 0 && updated[lastIdx].role !== "ai") lastIdx--;
            if (lastIdx >= 0) updated.splice(lastIdx, 1);
            return updated;
          });
        }
        setLoading(false);
      } else {
        setError("No response body from AI service.");
        setMessages((msgs) => {
          // Remove the last empty AI message
          const updated = [...msgs];
          let lastIdx = updated.length - 1;
          while (lastIdx >= 0 && updated[lastIdx].role !== "ai") lastIdx--;
          if (lastIdx >= 0) updated.splice(lastIdx, 1);
          return updated;
        });
        setLoading(false);
      }
    } catch {
      setError("Network error.");
      setMessages((msgs) => {
        // Remove the last empty AI message
        const updated = [...msgs];
        let lastIdx = updated.length - 1;
        while (lastIdx >= 0 && updated[lastIdx].role !== "ai") lastIdx--;
        if (lastIdx >= 0) updated.splice(lastIdx, 1);
        return updated;
      });
      setLoading(false);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || loading) return;
    setMessages((msgs) => [...msgs, { role: "user", content: input }]);
    await sendToAI(input);
    setInput("");
  };

  // Escalation handler
  const handleEscalate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInfo, transcript: messages, urgency }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError((data.error || "Failed to escalate.") + (data.details ? `\nDetails: ${data.details}` : ""));
      } else {
        setEscalated(true);
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // Review handler (optional, just a placeholder)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInfo, review }),
      });
      setReviewSubmitted(true);
    } catch {
      setError('Failed to send review.');
    } finally {
      setLoading(false);
    }
  };

  const userAvatar = (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: '50%', border: '2px solid #2aff8f', background: '#222', boxShadow: '0 2px 8px rgba(42,255,143,0.10)' }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="#222" />
        <circle cx="12" cy="10" r="4.2" fill="#2aff8f" fillOpacity="0.18" />
        <circle cx="12" cy="10" r="3.2" fill="#2aff8f" />
        <ellipse cx="12" cy="18" rx="6.5" ry="3.2" fill="#2aff8f" fillOpacity="0.18" />
        <ellipse cx="12" cy="18" rx="5.2" ry="2.2" fill="#2aff8f" />
      </svg>
    </span>
  );
  const aiAvatar = (
    <Image
      src="/globe.svg"
      alt="AI avatar"
      width={38}
      height={38}
      style={{ borderRadius: '50%', border: '2px solid var(--color-border)', background: '#181a1b', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
      priority
    />
  );

  // For SSR safety
  useEffect(() => { setMounted(true); }, []);

  if (!userInfo) return null;

  if (escalated) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(120deg, #10281f 0%, #184d36 50%, #0a1f1a 100%)', animation: 'bgMove 16s ease-in-out infinite alternate', position: 'relative', overflow: 'hidden' }}>
        <section style={{ maxWidth: 540, width: '100%', boxSizing: 'border-box', padding: '36px 40px', borderRadius: 24, background: 'linear-gradient(135deg, rgba(10,24,18,0.98) 60%, rgba(18,36,28,0.98) 100%)', boxShadow: '0 0 32px 4px rgba(80,200,180,0.18), 0 8px 40px rgba(0,0,0,0.22)', border: '2px solid #2aff8f', borderColor: 'rgba(42,255,143,0.18)', backdropFilter: 'blur(2px)', position: 'relative' }}>
          <h2 style={{ color: '#2aff8f', fontWeight: 800 }}>Your request has been escalated.</h2>
          <p style={{ color: '#eafff0' }}>Our team will contact you soon. Thank you!</p>
          <p style={{ color: '#eafff0', marginTop: 18, fontSize: 16 }}>
            Have a look at our <a href="https://tecbot.co.za" target="_blank" rel="noopener noreferrer" style={{ color: '#2aff8f', textDecoration: 'underline', fontWeight: 600 }}>website</a> or log another ticket below.
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 28, marginBottom: 18 }}>
            <button style={{ background: 'linear-gradient(90deg, #1de982 0%, #0fa36b 100%)', color: '#fff', border: '1.5px solid #1de982', borderRadius: 8, fontWeight: 700, fontSize: 16, padding: '10px 24px', cursor: 'pointer' }} onClick={() => router.push('/support')}>Log another ticket</button>
          </div>
        </section>
      </main>
    );
  }

  if (exited) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(120deg, #10281f 0%, #184d36 50%, #0a1f1a 100%)', animation: 'bgMove 16s ease-in-out infinite alternate', position: 'relative', overflow: 'hidden' }}>
        <section style={{ maxWidth: 540, width: '100%', boxSizing: 'border-box', padding: '36px 40px', borderRadius: 24, background: 'linear-gradient(135deg, rgba(10,24,18,0.98) 60%, rgba(18,36,28,0.98) 100%)', boxShadow: '0 0 32px 4px rgba(80,200,180,0.18), 0 8px 40px rgba(0,0,0,0.22)', border: '2px solid #2aff8f', borderColor: 'rgba(42,255,143,0.18)', backdropFilter: 'blur(2px)', position: 'relative' }}>
          <h2 style={{ color: '#2aff8f', fontWeight: 800 }}>Thank you for using our support portal!</h2>
          {!reviewSubmitted ? (
            <form onSubmit={handleReviewSubmit} style={{ marginTop: 24 }} aria-label="Review Form">
              <label style={{ color: '#eafff0', fontWeight: 600 }}>Leave a review:</label><br />
              <div style={{ margin: '12px 0' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} style={{ fontSize: 28, cursor: 'pointer', color: review.rating >= star ? '#2aff8f' : '#444' }} onClick={() => setReview((r) => ({ ...r, rating: star }))} aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}>&#9733;</span>
                ))}
              </div>
              <textarea
                value={review.comment}
                onChange={e => setReview((r) => ({ ...r, comment: e.target.value }))}
                placeholder="Your feedback..."
                style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 8, border: '1.5px solid #2aff8f', background: 'var(--color-bg-alt)', color: '#eafff0', fontSize: 15 }}
                aria-label="Review comment"
              />
              <button type="submit" style={{ marginTop: 16, background: 'linear-gradient(90deg, #145c36 0%, #1de982 100%)', color: '#eafff0', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 16, padding: '10px 24px', cursor: 'pointer' }}>Submit Review</button>
            </form>
          ) :
            <p style={{ color: '#2aff8f', marginTop: 24 }}>Thank you for your feedback!</p>
          }
          <button style={{ marginTop: 32, background: 'linear-gradient(90deg, #2aff8f 0%, #1de982 100%)', color: '#0a1f1a', border: '1.5px solid #2aff8f', borderRadius: 8, fontWeight: 700, fontSize: 16, padding: '10px 24px', cursor: 'pointer' }} onClick={() => router.push('/support')}>Log another ticket</button>
        </section>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(120deg, #10281f 0%, #184d36 50%, #0a1f1a 100%)',
      animation: 'bgMove 16s ease-in-out infinite alternate',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <section style={{
        maxWidth: 900,
        width: '75vw',
        padding: 36,
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(10,24,18,0.98) 60%, rgba(18,36,28,0.98) 100%)',
        boxShadow: '0 0 32px 4px rgba(80,200,180,0.18), 0 8px 40px rgba(0,0,0,0.22)',
        border: '2px solid #2aff8f',
        borderColor: 'rgba(42,255,143,0.18)',
        backdropFilter: 'blur(2px)',
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
      }}>
        <h2 style={{ color: '#2aff8f', marginBottom: 8, fontWeight: 800, fontSize: 28 }}>Hello, {userInfo.name.split(' ')[0] || 'there'}! <span style={{ fontWeight: 400, color: '#1de982', fontSize: 20 }}>I&apos;m your AI chatbot. How can I help you today?</span></h2>
        <div style={{ marginBottom: 18, color: '#eafff0', fontSize: 16, background: 'rgba(24,80,60,0.7)', borderRadius: 10, padding: 18, border: '1.5px solid #2aff8f', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><b>Name:</b> {userInfo.name}</div>
          <div><b>Email:</b> {userInfo.email}</div>
          <div><b>Phone:</b> {userInfo.phone}</div>
          <div><b>Category:</b> {userInfo.category}</div>
        </div>
        <div style={{ marginBottom: 18, color: '#eafff0', fontWeight: 600, fontSize: 16, background: 'rgba(10,24,18,0.7)', borderRadius: 8, padding: 12, border: '1.5px solid #2aff8f' }}>
          <b>Original Message:</b><br />
          {userInfo.message}
        </div>
        <audio ref={audioRef} src="/notification.mp3" preload="auto" style={{ display: 'none' }} />
        <div
          style={{
            minHeight: 180,
            maxHeight: fullscreen ? '100vh' : 340,
            overflowY: 'auto',
            background: 'rgba(10,24,18,0.7)',
            borderRadius: 12,
            padding: 16,
            border: '1.5px solid #2aff8f',
            marginBottom: 18,
            boxShadow: '0 2px 8px rgba(42,255,143,0.10)',
            position: fullscreen ? 'fixed' : 'relative',
            zIndex: fullscreen ? 2000 : 'auto',
            width: fullscreen ? '100vw' : 'auto',
            height: fullscreen ? '100vh' : 'auto',
            left: fullscreen ? 0 : 0,
            top: fullscreen ? 0 : 0,
            right: fullscreen ? 0 : undefined,
            bottom: fullscreen ? 0 : undefined,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'stretch',
            transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
          }}
          aria-label="AI Chat Transcript"
        >
          {fullscreen && mounted ? createPortal(
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: '#0a1f1a',
                zIndex: 3000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
              }}
            >
              <div
                style={{
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(10,24,18,0.97)',
                  borderRadius: 0,
                  boxShadow: 'none',
                  border: 'none',
                  padding: 0,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0 0 0', width: '100%', maxWidth: '100vw', margin: 0 }}>
                  <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: 340, overflowY: 'auto', paddingRight: 20, paddingLeft: 0 }}>
                      {messages.map((msg, idx) => (
                        <div
                          key={idx}
                          style={{
                            marginBottom: 18,
                            display: 'flex',
                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                            alignItems: 'flex-end',
                            animation: 'fadeInChat 0.5s cubic-bezier(.4,0,.2,1)',
                            gap: 14
                          }}
                        >
                          <span
                            style={{
                              animation: 'avatarBounce 0.5s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 38,
                              minHeight: 38
                            }}
                          >
                            {msg.role === 'user' ? userAvatar : aiAvatar}
                          </span>
                          <span
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                              position: 'relative',
                              maxWidth: 420
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                background: msg.role === 'user'
                                  ? 'linear-gradient(90deg, #2aff8f 0%, #1de982 100%)'
                                  : 'linear-gradient(90deg, #1de982 0%, #0fa36b 100%)',
                                color: '#eafff0',
                                padding: '10px 18px',
                                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                boxShadow: msg.role === 'user'
                                  ? '0 2px 12px 0 rgba(42,255,143,0.22)'
                                  : '0 2px 16px 0 rgba(15,163,107,0.22)',
                                fontWeight: 500,
                                fontSize: 16,
                                wordBreak: 'break-word',
                                border: msg.role === 'user' ? '1.5px solid #2aff8f' : '1.5px solid #0fa36b',
                                transition: 'background 0.2s, color 0.2s, transform 0.1s',
                                cursor: 'pointer',
                                position: 'relative',
                              }}
                              aria-label={msg.role === 'user' ? 'You' : 'AI'}
                              tabIndex={0}
                              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              onFocus={ev => ev.currentTarget.style.boxShadow = '0 0 0 2px #2aff8f'}
                              onBlur={ev => ev.currentTarget.style.boxShadow = 'none'}
                              title={msg.role === 'user' ? 'You' : 'AI'}
                            >
                              {msg.role === 'ai' && msg.fallback && (
                                <span style={{ marginLeft: 8, color: '#ffb300', fontWeight: 600, fontSize: 13, background: '#222', borderRadius: 6, padding: '2px 8px', border: '1px solid #ffb300' }}>
                                  Generic response
                                </span>
                              )}
                              {msg.role === 'ai' ? (
                                <ReactMarkdown
                                  components={{
                                    code({inline, children, ...props}: React.ComponentPropsWithoutRef<'code'> & {inline?: boolean}) {
                                      return !inline ? (
                                        <pre style={{ background: '#0a1f1a', color: '#2aff8f', borderRadius: 8, padding: 12, margin: '8px 0', overflowX: 'auto', fontSize: 15 }}>
                                          <code {...props}>{children}</code>
                                        </pre>
                                      ) : (
                                        <code style={{ background: '#184d36', color: '#2aff8f', borderRadius: 4, padding: '2px 6px', fontSize: 15 }} {...props}>{children}</code>
                                      );
                                    },
                                    a(props: React.ComponentPropsWithoutRef<'a'>) {
                                      return <a style={{ color: '#2aff8f', textDecoration: 'underline' }} {...props} />;
                                    },
                                    li(props: React.ComponentPropsWithoutRef<'li'>) {
                                      return <li style={{ marginLeft: 16, marginBottom: 4 }} {...props} />;
                                    },
                                  }}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              ) : msg.content}
                              <button
                                onClick={() => handleCopy(msg.content, idx)}
                                aria-label="Copy message"
                                style={{
                                  position: 'absolute',
                                  right: msg.role === 'user' ? 'auto' : -38,
                                  left: msg.role === 'user' ? -38 : 'auto',
                                  top: 8,
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#1de982',
                                  fontSize: 18,
                                  padding: 0,
                                  outline: 'none',
                                  transition: 'color 0.2s',
                                  zIndex: 2
                                }}
                                tabIndex={0}
                                title="Copy to clipboard"
                              >
                                {copiedIdx === idx ? (
                                  <span style={{ fontSize: 15, color: '#2aff8f' }}>✓</span>
                                ) : (
                                  <span>📋</span>
                                )}
                              </button>
                              {copiedIdx === idx && (
                                <span style={{ position: 'absolute', top: -22, right: msg.role === 'user' ? 'auto' : 0, left: msg.role === 'user' ? 0 : 'auto', background: '#2aff8f', color: '#0a1f1a', borderRadius: 6, fontSize: 12, padding: '2px 8px', fontWeight: 600, zIndex: 2 }}>Copied!</span>
                              )}
                            </span>
                            <span style={{ fontSize: 12, color: '#1de982', margin: msg.role === 'user' ? '0 8px 0 0' : '0 0 0 8px', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', minWidth: 56, textAlign: msg.role === 'user' ? 'right' : 'left', marginTop: 6 }}>
                              {formatTime(new Date()).replace("'", "&apos;")}
                            </span>
                          </span>
                        </div>
                      ))}
                      {loading && (
                        <div style={{ margin: '10px 0', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-block', background: 'var(--color-bg)', color: 'var(--color-text-muted)', padding: '8px 16px', borderRadius: 16 }}>
                            <span className="spinner" style={{ display: 'inline-block', width: 18, height: 18, border: '2.5px solid #2aff8f', borderTop: '2.5px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 10, verticalAlign: 'middle' }} />
                            <span style={{ fontWeight: 500 }}>AI is typing…</span>
                          </span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </div>
                </div>
                <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, padding: '24px 0 32px 0', maxWidth: 900, margin: '0 auto', width: '100%' }} aria-label="AI Chat Input">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    style={{ flex: 1, padding: 18, borderRadius: 8, border: '1.5px solid #184d36', background: 'rgba(24,80,60,0.7)', color: '#eafff0', fontSize: 19, fontWeight: 500, outline: 'none', transition: 'border 0.2s, box-shadow 0.2s' }}
                    placeholder={loading ? 'AI is thinking...' : 'Type your message...'}
                    disabled={loading}
                    aria-label="Type your message"
                    onFocus={ev => ev.currentTarget.style.border = '1.5px solid #2aff8f'}
                    onBlur={ev => ev.currentTarget.style.border = '1.5px solid #184d36'}
                    onKeyDown={ev => {
                      if (ev.key === 'Enter' && !ev.shiftKey && !loading && input.trim()) {
                        ev.preventDefault();
                        (ev.target as HTMLInputElement).form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                      }
                    }}
                  />
                  <button type="submit" style={{
                    padding: '18px 32px',
                    background: 'linear-gradient(90deg, #145c36 0%, #1de982 100%)',
                    color: '#eafff0',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 20,
                    boxShadow: '0 0 12px 2px rgba(30,233,130,0.18), 0 1px 8px 0 rgba(20,92,54,0.18)',
                    letterSpacing: 0.5,
                    transition: 'background 0.2s, color 0.2s, transform 0.1s',
                  }}
                    disabled={loading} aria-busy={loading}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Send
                  </button>
                </form>
                <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: 8 }}>
                  <button
                    onClick={() => setFullscreen(f => !f)}
                    aria-label={fullscreen ? 'Exit fullscreen' : 'Go fullscreen'}
                    style={{
                      background: 'rgba(42,255,143,0.12)',
                      color: '#2aff8f',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 22,
                      padding: '10px 16px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 4px rgba(42,255,143,0.10)',
                      transition: 'background 0.2s, color 0.2s, transform 0.1s',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {fullscreen ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 15H5V19" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 15H19V19" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 5V9H15" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 9V5H9" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 9V5H19" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 9H5V5" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 15H19V19" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 15V19H5" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          ) : (
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: 340, overflowY: 'auto', paddingRight: 0, paddingLeft: 0 }}>
              {/* Chat messages go here */}
              <div style={{ flex: 1, paddingRight: 0, paddingLeft: 0 }}>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: 18,
                      display: 'flex',
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      animation: 'fadeInChat 0.5s cubic-bezier(.4,0,.2,1)',
                      gap: 14
                    }}
                  >
                    <span
                      style={{
                        animation: 'avatarBounce 0.5s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 38,
                        minHeight: 38
                      }}
                    >
                      {msg.role === 'user' ? userAvatar : aiAvatar}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        position: 'relative',
                        maxWidth: 420
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          background: msg.role === 'user'
                            ? 'linear-gradient(90deg, #2aff8f 0%, #1de982 100%)'
                            : 'linear-gradient(90deg, #1de982 0%, #0fa36b 100%)',
                          color: '#eafff0',
                          padding: '10px 18px',
                          borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          boxShadow: msg.role === 'user'
                            ? '0 2px 12px 0 rgba(42,255,143,0.22)'
                            : '0 2px 16px 0 rgba(15,163,107,0.22)',
                          fontWeight: 500,
                          fontSize: 16,
                          wordBreak: 'break-word',
                          border: msg.role === 'user' ? '1.5px solid #2aff8f' : '1.5px solid #0fa36b',
                          transition: 'background 0.2s, color 0.2s, transform 0.1s',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        aria-label={msg.role === 'user' ? 'You' : 'AI'}
                        tabIndex={0}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        onFocus={ev => ev.currentTarget.style.boxShadow = '0 0 0 2px #2aff8f'}
                        onBlur={ev => ev.currentTarget.style.boxShadow = 'none'}
                        title={msg.role === 'user' ? 'You' : 'AI'}
                      >
                        {msg.role === 'ai' && msg.fallback && (
                          <span style={{ marginLeft: 8, color: '#ffb300', fontWeight: 600, fontSize: 13, background: '#222', borderRadius: 6, padding: '2px 8px', border: '1px solid #ffb300' }}>
                            Generic response
                          </span>
                        )}
                        {msg.role === 'ai' ? (
                          <ReactMarkdown
                            components={{
                              code({inline, children, ...props}: React.ComponentPropsWithoutRef<'code'> & {inline?: boolean}) {
                                return !inline ? (
                                  <pre style={{ background: '#0a1f1a', color: '#2aff8f', borderRadius: 8, padding: 12, margin: '8px 0', overflowX: 'auto', fontSize: 15 }}>
                                    <code {...props}>{children}</code>
                                  </pre>
                                ) : (
                                  <code style={{ background: '#184d36', color: '#2aff8f', borderRadius: 4, padding: '2px 6px', fontSize: 15 }} {...props}>{children}</code>
                                );
                              },
                              a(props: React.ComponentPropsWithoutRef<'a'>) {
                                return <a style={{ color: '#2aff8f', textDecoration: 'underline' }} {...props} />;
                              },
                              li(props: React.ComponentPropsWithoutRef<'li'>) {
                                return <li style={{ marginLeft: 16, marginBottom: 4 }} {...props} />;
                              },
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : msg.content}
                        <button
                          onClick={() => handleCopy(msg.content, idx)}
                          aria-label="Copy message"
                          style={{
                            position: 'absolute',
                            right: msg.role === 'user' ? 'auto' : -38,
                            left: msg.role === 'user' ? -38 : 'auto',
                            top: 8,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#1de982',
                            fontSize: 18,
                            padding: 0,
                            outline: 'none',
                            transition: 'color 0.2s',
                            zIndex: 2
                          }}
                          tabIndex={0}
                          title="Copy to clipboard"
                        >
                          {copiedIdx === idx ? (
                            <span style={{ fontSize: 15, color: '#2aff8f' }}>✓</span>
                          ) : (
                            <span>📋</span>
                          )}
                        </button>
                        {copiedIdx === idx && (
                          <span style={{ position: 'absolute', top: -22, right: msg.role === 'user' ? 'auto' : 0, left: msg.role === 'user' ? 0 : 'auto', background: '#2aff8f', color: '#0a1f1a', borderRadius: 6, fontSize: 12, padding: '2px 8px', fontWeight: 600, zIndex: 2 }}>Copied!</span>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: '#1de982', margin: msg.role === 'user' ? '0 8px 0 0' : '0 0 0 8px', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', minWidth: 56, textAlign: msg.role === 'user' ? 'right' : 'left', marginTop: 6 }}>
                        {formatTime(new Date()).replace("'", "&apos;")}
                      </span>
                    </span>
                  </div>
                ))}
                {loading && (
                  <div style={{ margin: '10px 0', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', background: 'var(--color-bg)', color: 'var(--color-text-muted)', padding: '8px 16px', borderRadius: 16 }}>
                      <span className="spinner" style={{ display: 'inline-block', width: 18, height: 18, border: '2.5px solid #2aff8f', borderTop: '2.5px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 10, verticalAlign: 'middle' }} />
                      <span style={{ fontWeight: 500 }}>AI is typing…</span>
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, marginTop: 8, marginBottom: 8, alignItems: 'center' }} aria-label="AI Chat Input">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  style={{ flex: 1, padding: 14, borderRadius: 8, border: '1.5px solid #184d36', background: 'rgba(24,80,60,0.7)', color: '#eafff0', fontSize: 17, fontWeight: 500, outline: 'none', transition: 'border 0.2s, box-shadow 0.2s' }}
                  placeholder={loading ? 'AI is thinking...' : 'Type your message...'}
                  disabled={loading}
                  aria-label="Type your message"
                  onFocus={ev => ev.currentTarget.style.border = '1.5px solid #2aff8f'}
                  onBlur={ev => ev.currentTarget.style.border = '1.5px solid #184d36'}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' && !ev.shiftKey && !loading && input.trim()) {
                      ev.preventDefault();
                      (ev.target as HTMLInputElement).form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }
                  }}
                />
                <button type="submit" style={{
                  padding: '14px 22px',
                  background: 'linear-gradient(90deg, #145c36 0%, #1de982 100%)',
                  color: '#eafff0',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 18,
                  boxShadow: '0 0 12px 2px rgba(30,233,130,0.18), 0 1px 8px 0 rgba(20,92,54,0.18)',
                  letterSpacing: 0.5,
                  transition: 'background 0.2s, color 0.2s, transform 0.1s',
                  marginRight: 0,
                }}
                  disabled={loading} aria-busy={loading}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreen(f => !f)}
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Go fullscreen'}
                  style={{
                    background: 'rgba(42,255,143,0.12)',
                    color: '#2aff8f',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 22,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(42,255,143,0.10)',
                    transition: 'background 0.2s, color 0.2s, transform 0.1s',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 0,
                  }}
                >
                  {fullscreen ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 15H5V19" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 15H19V19" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 5V9H15" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 9V5H9" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 9V5H19" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 9H5V5" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 15H19V19" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 15V19H5" stroke="#2aff8f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24, alignItems: 'center', justifyContent: 'flex-start' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16, color: urgency === 'urgent' ? '#ff4e4e' : '#eafff0', cursor: 'pointer', marginRight: 8 }}>
            <input
              type="radio"
              checked={urgency === 'urgent'}
              onChange={() => setUrgency('urgent')}
              style={{ accentColor: '#ff4e4e', width: 18, height: 18, marginRight: 6 }}
              name="urgency"
              aria-checked={urgency === 'urgent'}
            />
            Urgent
          </label>
          <button style={{ background: 'linear-gradient(90deg, #2aff8f 0%, #1de982 100%)', color: '#0a1f1a', border: '1.5px solid #2aff8f', borderRadius: 8, fontWeight: 700, fontSize: 16, padding: '10px 24px', cursor: 'pointer', transition: 'background 0.2s, transform 0.1s', boxShadow: '0 2px 8px 0 rgba(42,255,143,0.12)' }} onClick={handleEscalate} disabled={loading}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Request help from a person
          </button>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, alignItems: 'center', justifyContent: 'flex-start' }}>
          <button style={{ background: 'linear-gradient(90deg, #0fa36b 0%, #1de982 100%)', color: '#fff', border: '1.5px solid #0fa36b', borderRadius: 8, fontWeight: 700, fontSize: 16, padding: '10px 24px', cursor: 'pointer', transition: 'background 0.2s, transform 0.1s', boxShadow: '0 2px 8px 0 rgba(15,163,107,0.12)' }} onClick={() => router.push('/support')}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Log another ticket
          </button>
          <button style={{ background: 'linear-gradient(90deg, #1de982 0%, #0fa36b 100%)', color: '#fff', border: '1.5px solid #1de982', borderRadius: 8, fontWeight: 700, fontSize: 16, padding: '10px 24px', cursor: 'pointer', transition: 'background 0.2s, transform 0.1s', boxShadow: '0 2px 8px 0 rgba(15,163,107,0.12)' }} onClick={() => setExited(true)
            } onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Exit – I got the help I needed
          </button>
        </div>
        {error && <div style={{ color: 'var(--color-error)', marginBottom: 10 }}>{error}</div>}
      </section>
    </main>
  );
} 