"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const categories = [
  'Website changes & support',
  'Email issues & mailbox setup',
  'Social media requests',
  'Administrative requests (invoicing, accounts, etc.)',
];

export default function SupportPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    category: '',
    message: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setApiError(null);
    const newErrors: { [key: string]: string } = {};
    if (!form.name.trim()) newErrors.name = 'Full name is required.';
    if (!form.email.trim()) newErrors.email = 'Email is required.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) newErrors.email = 'Invalid email.';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required.';
    if (!form.category) newErrors.category = 'Please select a category.';
    if (!form.message.trim()) newErrors.message = 'Message is required.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setLoading(true);
    try {
      sessionStorage.setItem('supportForm', JSON.stringify(form));
      router.push('/support/ai');
    } catch (err) {
      setApiError('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        maxWidth: 540,
        width: '100%',
        boxSizing: 'border-box',
        padding: '36px 32px',
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(10,24,18,0.98) 60%, rgba(18,36,28,0.98) 100%)',
        boxShadow: '0 0 32px 4px rgba(80,200,180,0.18), 0 8px 40px rgba(0,0,0,0.22)',
        border: '2px solid #2aff8f',
        borderColor: 'rgba(42,255,143,0.18)',
        backdropFilter: 'blur(2px)',
        position: 'relative',
      }}>
        <h2 style={{ color: '#2aff8f', marginBottom: 18, fontWeight: 800, fontSize: 28 }}>Submit a Support Ticket</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 16, marginBottom: 8 }}>Our AI assistant will help you first. If you need a human, you can escalate at any time.</p>
        <form onSubmit={handleSubmit} style={{ padding: '0 8px' }}>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="name" style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!errors.name}
              value={form.name}
              onChange={handleChange}
              style={{ width: '95%', padding: 14, marginTop: 6, background: 'var(--color-bg-alt)', color: 'var(--color-text)', border: errors.name ? '2px solid var(--color-error)' : '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 17, fontWeight: 500, outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'border 0.2s' }}
              disabled={loading}
            />
            {errors.name && <div style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 2 }}>{errors.name}</div>}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="email" style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>Email</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              aria-required="true"
              aria-invalid={!!errors.email}
              value={form.email}
              onChange={handleChange}
              style={{ width: '95%', padding: 14, marginTop: 6, background: 'var(--color-bg-alt)', color: 'var(--color-text)', border: errors.email ? '2px solid var(--color-error)' : '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 17, fontWeight: 500, outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'border 0.2s' }}
              disabled={loading}
            />
            {errors.email && <div style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 2 }}>{errors.email}</div>}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="phone" style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              autoComplete="tel"
              aria-required="true"
              aria-invalid={!!errors.phone}
              value={form.phone}
              onChange={handleChange}
              style={{ width: '95%', padding: 14, marginTop: 6, background: 'var(--color-bg-alt)', color: 'var(--color-text)', border: errors.phone ? '2px solid var(--color-error)' : '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 17, fontWeight: 500, outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'border 0.2s' }}
              disabled={loading}
            />
            {errors.phone && <div style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 2 }}>{errors.phone}</div>}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="category" style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>Category</label>
            <select
              id="category"
              name="category"
              aria-required="true"
              aria-invalid={!!errors.category}
              value={form.category}
              onChange={handleChange}
              style={{ width: '95%', padding: 14, marginTop: 6, background: 'var(--color-bg-alt)', color: 'var(--color-text)', border: errors.category ? '2px solid var(--color-error)' : '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 17, fontWeight: 500, outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'border 0.2s' }}
              disabled={loading}
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {errors.category && <div style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 2 }}>{errors.category}</div>}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="message" style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>Describe your issue or what you need help with</label>
            <textarea
              id="message"
              name="message"
              aria-required="true"
              aria-invalid={!!errors.message}
              value={form.message}
              onChange={handleChange}
              style={{ width: '95%', padding: 14, marginTop: 6, background: 'var(--color-bg-alt)', color: 'var(--color-text)', border: errors.message ? '2px solid var(--color-error)' : '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 17, fontWeight: 500, outline: 'none', minHeight: 90, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'border 0.2s' }}
              disabled={loading}
            />
            {errors.message && <div style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 2 }}>{errors.message}</div>}
          </div>
          {apiError && <div style={{ color: 'var(--color-error)', marginBottom: 8 }}>{apiError}</div>}
          <button
            type="submit"
            style={{
              marginTop: 24,
              width: '100%',
              background: 'linear-gradient(90deg, #145c36 0%, #1de982 100%)',
              color: '#eafff0',
              border: 'none',
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 18,
              boxShadow: '0 0 12px 2px rgba(30,233,130,0.18), 0 1px 8px 0 rgba(20,92,54,0.18)',
              letterSpacing: 0.5,
              transition: 'background 0.2s, color 0.2s, transform 0.1s',
            }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </section>
      <style>{`
        @keyframes bgMove {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
      `}</style>
    </main>
  );
} 