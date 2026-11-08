import { EmptyState } from '../components/ui';
import { IconAlerts } from '../components/Icons';
import type { AppRole } from '../navigation/roleRoutes';

// PASAKJA has no notifications read endpoint yet, so there is no real feed to
// render. This screen stays honest: heading plus an empty state, no fake alerts
// and no dead "mark all as read" control.
export default function Alerts({ role }: { role: AppRole }) {
  return (
    <div className="flex-1 overflow-y-auto bg-warm">
      <header className="page-header">
        <h1>{role === 'admin' ? 'System alerts' : 'Alerts'}</h1>
        <p>Ride updates and community notices for your town.</p>
      </header>
      <div className="px-4 pb-6">
        <EmptyState title="No alerts yet" description="You're all caught up!" icon={<IconAlerts size={24}/>}/>
      </div>
    </div>
  );
}
