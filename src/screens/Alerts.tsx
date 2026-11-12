import { useCallback, useEffect, useState } from 'react';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { IconAlerts } from '../components/Icons';
import { alertPresentation } from '../components/alertPresentation';
import { getAlerts, type AlertItem } from '../services/api';
import { formatWhen } from '../services/time';
import type { AppRole } from '../navigation/roleRoutes';

const REFRESH_MS = 30000;

// One feed: community notices an admin published for this town (or every town)
// plus this person's own notices (ride updates, SOS and password-reset alerts for admins).
export default function Alerts({ role }: { role: AppRole }) {
  const [items, setItems] = useState<AlertItem[] | null>(null);
  const [town, setTown] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await getAlerts();
      setItems(result.items);
      setTown(result.municipality);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load alerts.');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const scope = role === 'admin' ? 'Community notices for every town, plus SOS and account requests.' : town ? `Notices for ${town} and every town, plus your ride updates.` : 'Notices for every town, plus your ride updates.';

  return (
    <div className="flex-1 overflow-y-auto bg-warm">
      <div className="page-width px-4 pt-4 pb-6 space-y-3">
        <p className="text-sm text-ink-soft">{scope}</p>
        {error && <ErrorState message={error} action={<button type="button" className="text-link" onClick={() => void load()}>Retry</button>}/>}
        {items === null && !error && <div className="space-y-3" aria-label="Loading alerts">{[0, 1, 2].map(index => <Skeleton key={index} className="h-24 rounded-2xl"/>)}</div>}
        {items !== null && items.length === 0 && (
          <EmptyState
            title="No alerts yet"
            description={role === 'admin' ? 'Published notices, SOS alerts and password-reset requests will appear here.' : 'Ride updates and community notices for your town will appear here.'}
            icon={<IconAlerts size={24}/>}
          />
        )}
        {items?.map(item => {
          const { icon, tone } = alertPresentation(item.type);
          return (
            <article key={item.key} className="alert-item">
              <span className={`alert-item__icon alert-item__icon--${tone}`}>{icon}</span>
              <div className="min-w-0 flex-1">
                <div className="alert-item__head">
                  <h2 className="alert-item__title">{item.title}</h2>
                  <time className="alert-item__time" dateTime={item.created_at}>{formatWhen(item.created_at)}</time>
                </div>
                <p className="alert-item__message">{item.message}</p>
                {item.kind === 'community' && <span className="alert-item__town">{item.municipality ?? 'All towns'}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
