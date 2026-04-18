import React, { useState } from 'react';
import PriceHistory from './PriceHistory.jsx';

function fmtPrice(p) {
  if (p == null) return '—';
  return `$${Math.round(p / 1000).toLocaleString()}k`;
}

export default function ListingCard({ listing, verdict, history, onVerdict }) {
  const [busy, setBusy] = useState(false);
  const photo = listing.photos?.[0];
  const sources = listing.sources || [{ name: listing.sourceName, url: listing.url }];

  const click = async (v) => {
    if (busy) return;
    setBusy(true);
    try { await onVerdict(listing, v); }
    finally { setBusy(false); }
  };

  return (
    <article className="card">
      {photo ? (
        <a href={listing.url} target="_blank" rel="noreferrer">
          <img className="card-photo" src={photo} alt="" loading="lazy" />
        </a>
      ) : (
        <div className="card-photo" />
      )}
      <div className="card-body">
        <p className="card-price">{fmtPrice(listing.price)}</p>
        <p className="card-address">{listing.address}</p>
        <div className="card-meta">
          {listing.beds != null && <span>{listing.beds} bd</span>}
          {listing.baths != null && <span>{listing.baths} ba</span>}
          {listing.sqft != null && <span>{Number(listing.sqft).toLocaleString()} sqft</span>}
          {listing.lotSize != null && <span>{Number(listing.lotSize).toLocaleString()} lot</span>}
          {listing.yearBuilt != null && <span>built {listing.yearBuilt}</span>}
        </div>
        {listing.flags?.length > 0 && (
          <p className="card-flags">⚠ {listing.flags.join(' · ')}</p>
        )}
        <div className="card-sources">
          {sources.filter((s) => s.url).map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
          ))}
        </div>
        {history?.length > 1 && <PriceHistory history={history} />}
        <div className="card-actions">
          <button
            className={`btn up${verdict === 'up' ? ' active' : ''}`}
            disabled={busy}
            onClick={() => click('up')}
          >👍 Like</button>
          <button
            className={`btn down${verdict === 'down' ? ' active' : ''}`}
            disabled={busy}
            onClick={() => click('down')}
          >👎 Pass</button>
        </div>
      </div>
    </article>
  );
}
