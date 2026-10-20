import { EmptyState } from '../components/ui';
import { IconAlerts } from '../components/Icons';
import type { AppRole } from '../navigation/roleRoutes';

// PASAKJA has no notifications read endpoint yet, so there is no real feed to
// render. This screen stays honest: heading plus an empty state, no fake alerts
// and no dead "mark all as read" control.
export default function Alerts({ role }: { role: AppRole }) {
  return (
    <div className="flex-1 overflow-y-auto bg-warm">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-ink mb-1">{role === 'admin' ? 'System alerts' : 'Alerts'}</h1>
      </div>
      <div className="px-4 pb-6">
        <EmptyState title="No alerts yet" description="You're all caught up!" icon={<IconAlerts size={24}/>}/>
      </div>
    </div>
  );
}
