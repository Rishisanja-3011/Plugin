import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/axios';
import IconGlyph from '../../components/IconGlyph/IconGlyph';
import './EmailInbox.css';

export default function EmailInbox() {
  const [email, setEmail] = useState('');
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.get('/auth/email-inbox', { params: { email } });
      setMessages(res.data.messages ?? []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not fetch inbox');
      setMessages(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (email) handleCheck({ preventDefault: () => {} });
  };

  return (
    <motion.main
      className="email-inbox page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container page-content">
        <div className="ei-header">
          <div className="ei-header__icon"><IconGlyph glyph={'\u{1F4E7}'} className="mono-icon mono-icon--lg" /></div>
          <h1 className="ei-header__title">Email Inbox</h1>
          <p className="ei-header__subtitle">
            Check your OTP messages here. Enter the email you used on the forgot password page.
          </p>
        </div>

        <form className="ei-search" onSubmit={handleCheck}>
          <input
            type="email"
            className="ei-search__input"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <button type="submit" className="ei-search__btn" disabled={loading}>
            {loading ? 'Checking...' : 'Check Inbox'}
          </button>
        </form>
        {error && <p className="ei-error">{error}</p>}

        <AnimatePresence mode="wait">
          {messages !== null && (
            <motion.div
              key="results"
              className="ei-results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="ei-toolbar">
                <span className="ei-toolbar__count">
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </span>
                <button type="button" className="ei-toolbar__refresh" onClick={handleRefresh}>
                  Refresh
                </button>
              </div>

              {messages.length === 0 ? (
                <div className="ei-empty">
                  <div className="ei-empty__icon"><IconGlyph glyph={'\u{1F4ED}'} className="mono-icon mono-icon--lg" /></div>
                  <h3 className="ei-empty__title">No messages</h3>
                  <p className="ei-empty__text">
                    No OTP has been sent to this email yet. Go to the forgot password page and request one first.
                  </p>
                </div>
              ) : (
                <div className="ei-messages">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      className="ei-message"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="ei-message__header">
                        <span className="ei-message__from">PLUGIN &lt;noreply@plugin.com&gt;</span>
                        <span className="ei-message__time">
                          {msg.time ? new Date(msg.time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}
                        </span>
                      </div>
                      <h4 className="ei-message__subject">{msg.subject}</h4>
                      <div className="ei-message__body">
                        <p>{msg.body?.split('\n').map((line, j) => (
                          <span key={j}>{line}<br /></span>
                        ))}</p>
                      </div>
                      <div className="ei-message__otp-box">
                        <span className="ei-message__otp-label">Your OTP Code</span>
                        <span className="ei-message__otp-code">{msg.otp}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.main>
  );
}

