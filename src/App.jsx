import React, { useEffect, useMemo, useState } from 'react';
import { loadAllData } from './data-loader.js';
import { getPat, setPat, postVerdict } from './github-client.js';
import ListingCard from './components/ListingCard.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';

const LAST_VISIT_KEY = 'hh:lastVisit';
const TABS = ['New', 'Liked', 'Watching'];

export default function App() {
  const [tab, setTab] = useState('New');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pat, setPatState] = useState(() => getPat());
  const [lastVisit, setLastVisit] = useState(() => localStorage.getItem(LAST_VISIT_KEY));
  const [verdictsLocal, setVerdictsLocal] = useState({});

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadAllData(pat)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [pat]);

  useEffect(() => {
    const now = new Date().toISOString();
    return () => { localStorage.setItem(LAST_VISIT_KEY, now); };
  }, []);

  const verdicts = useMemo(() => ({ ...(data?.verdicts || {}), ...verdictsLocal }), [data, verdictsLocal]);

  const handleVerdict = async (listing, verdict) => {
    const prev = verdicts[listing.addressKey];
    setVerdictsLocal((m) => ({ ...m, [listing.addressKey]: { verdict, ts: new Date().toISOString() } }));
    try {
      await postVerdict({
        addressKey: listing.addressKey,
        verdict,
        address: listing.address,
        url: listing.url,
        ts: new Date().toISOString()
      });
    } catch (err) {
      console.error('verdict post failed', err);
      setVerdictsLocal((m) => {
        const next = { ...m };
        if (prev) next[listing.addressKey] = prev;
        else delete next[listing.addressKey];
        return next;
      });
      alert(`Couldn't save verdict: ${err.message}`);
    }
  };

  if (!pat) {
    return <InstallPrompt onPatSaved={(t) => { setPat(t); setPatState(t); }} />;
  }

  if (error) {
    return (
      <div className="app">
        <header className="app-header"><h1>House Hunt</h1></header>
        <main className="empty">
          <p className="error">Error loading data: {error}</p>
          <button onClick={() => { setPat(''); setPatState(''); }}>Re-enter PAT</button>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app">
        <header className="app-header"><h1>House Hunt</h1></header>
        <main className="empty"><p>Loading…</p></main>
      </div>
    );
  }

  const listings = data.listings || [];
  const priceHistory = data.priceHistory || {};
  const lastVisitTs = lastVisit ? new Date(lastVisit).getTime() : 0;

  const newSince = listings.filter((l) => {
    if (!l.firstSeen) return false;
    return new Date(l.firstSeen).getTime() > lastVisitTs;
  });
  const liked = listings.filter((l) => verdicts[l.addressKey]?.verdict === 'up');
  const watching = liked;

  const shown =
    tab === 'New' ? (newSince.length ? newSince : listings) :
    tab === 'Liked' ? liked :
    watching;

  return (
    <div className="app">
      <header className="app-header">
        <h1>House Hunt</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab${t === tab ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
              {t === 'New' && newSince.length > 0 && <span className="badge">{newSince.length}</span>}
              {t === 'Liked' && liked.length > 0 && <span className="badge">{liked.length}</span>}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {shown.length === 0 ? (
          <div className="empty"><p>Nothing here yet.</p></div>
        ) : (
          shown.map((l) => (
            <ListingCard
              key={l.addressKey}
              listing={l}
              verdict={verdicts[l.addressKey]?.verdict}
              history={priceHistory[l.addressKey]}
              onVerdict={handleVerdict}
            />
          ))
        )}
      </main>
      <footer className="app-footer">
        <button className="link" onClick={() => { setPat(''); setPatState(''); }}>
          Reset PAT
        </button>
      </footer>
    </div>
  );
}
