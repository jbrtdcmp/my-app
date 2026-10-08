import { useState } from 'react';
import { SAMPLE_ALERTS, type Alert } from '../data';
import { EmptyState } from '../components/ui';
import { IconAlerts } from '../components/Icons';
import type { AppRole } from '../navigation/roleRoutes';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ride: { label: 'Ride Update', color: 'text-orange', bg: 'bg-orange-light' },
  community: { label: 'Community', color: 'text-ink', bg: 'bg-warm' },
  weather: { label: 'Weather', color: 'text-sea-deep', bg: 'bg-sea/10' },
  market: { label: 'Market Day', color: 'text-success', bg: 'bg-success-bg' },
  fiesta: { label: 'Fiesta', color: 'text-warning', bg: 'bg-warning/10' },
  port: { label: 'Port Schedule', color: 'text-ink-soft', bg: 'bg-warm' },
};

function AlertItem({ alert, onRead }: { alert: Alert; onRead: (id: string) => void }) {
  const config = TYPE_CONFIG[alert.type];
  return (
    <div
      onClick={() => onRead(alert.id)}
      className={`bg-surface rounded-2xl border p-4 cursor-pointer transition-all duration-200 sidecar-card ${
        !alert.isRead ? 'border-orange/30 shadow-sm' : 'border-border'
      }`}
    >
      <div className="flex items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className={`text-sm font-semibold text-ink leading-snug ${!alert.isRead ? 'font-semibold' : 'font-medium'}`}>
              {alert.title}
            </p>
            {!alert.isRead && (
              <span className="w-2.5 h-2.5 rounded-full bg-orange flex-shrink-0 mt-1"/>
            )}
          </div>
          <p className="text-xs text-ink-soft leading-relaxed mb-2 line-clamp-2">{alert.message}</p>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>{config.label}</span>
            {alert.municipality && (
              <span className="text-ink-soft">· {alert.municipality}</span>
            )}
            <span className="text-ink-soft ml-auto">{alert.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Alerts({ role }: { role: AppRole }) {
  const [alerts, setAlerts] = useState(SAMPLE_ALERTS);
  const unreadCount = alerts.filter(a => !a.isRead).length;

  const markRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  };

  const unread = alerts.filter(a => !a.isRead);
  const read = alerts.filter(a => a.isRead);

  return (
    <div className="flex-1 overflow-y-auto bg-warm">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink mb-1">{role === 'admin' ? 'System alerts' : 'Alerts'}</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-orange font-medium">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-orange font-medium mt-1 px-3 py-1.5 rounded-full border border-orange/30 hover:bg-orange-light transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="px-4 pb-6 space-y-6">
        {/* Unread */}
        {unread.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-3">New</p>
            <div className="space-y-3">
              {unread.map(a => <AlertItem key={a.id} alert={a} onRead={markRead}/>)}
            </div>
          </div>
        )}

        {/* Read */}
        {read.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-3">Earlier</p>
            <div className="space-y-3 opacity-75">
              {read.map(a => <AlertItem key={a.id} alert={a} onRead={markRead}/>)}
            </div>
          </div>
        )}

        {alerts.length === 0 && <EmptyState title="No alerts yet" description="You're all caught up!" icon={<IconAlerts size={24}/>}/>}
      </div>
    </div>
  );
}
