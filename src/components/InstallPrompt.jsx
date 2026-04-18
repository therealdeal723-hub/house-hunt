import React, { useState } from 'react';
import { isIos, isStandalone, enablePushNotifications } from '../pwa/register.js';

export default function InstallPrompt({ onPatSaved }) {
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState(null);
  const needsHomeScreen = isIos() && !isStandalone();

  const save = (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setMsg({ kind: 'error', text: 'Please paste a token.' });
      return;
    }
    onPatSaved(token.trim());
  };

  const enablePush = async () => {
    try {
      setMsg(null);
      await enablePushNotifications();
      setMsg({ kind: 'ok', text: 'Notifications enabled. First push arrives at 6 PM PT.' });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    }
  };

  return (
    <div className="install">
      <h1>House Hunt</h1>
      {needsHomeScreen && (
        <>
          <p>To install on iPhone:</p>
          <ol>
            <li>Tap the Share button.</li>
            <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
            <li>Open the app from your home screen (not Safari).</li>
          </ol>
        </>
      )}
      <form onSubmit={save}>
        <label>
          GitHub personal access token (fine-grained, repo-only, issues read+write, contents read)
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="github_pat_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <button type="submit" className="primary">Save token</button>
      </form>
      <button type="button" className="primary" onClick={enablePush} style={{ marginTop: '1rem' }}>
        Enable notifications
      </button>
      {msg && (
        <p className={msg.kind === 'error' ? 'error' : ''} style={{ marginTop: '1rem' }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
