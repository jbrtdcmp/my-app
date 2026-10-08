import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { IconAlertCircle } from './Icons';

type ScaleGap = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// Screen owns page insets and safe-area clearance; use variants when persistent bars are present.
export function Screen({ className = '', withTabs = false, withSticky = false, ...props }: HTMLAttributes<HTMLElement> & { withTabs?: boolean; withSticky?: boolean }) {
  return <main className={`app-screen${withTabs ? ' app-screen--with-tabs' : ''}${withSticky ? ' app-screen--with-sticky' : ''} ${className}`} {...props}/>;
}

// Section separates major page groups by the shared 24px role.
export function Section({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`app-section ${className}`} {...props}/>;
}

// SectionTitle groups a heading with its content at the shared 8px title gap.
export function SectionTitle({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`app-section__title-content ${className}`} {...props}/>;
}

// Stack spaces siblings vertically using only a named spacing token.
export function Stack({ gap = 'md', className = '', ...props }: HTMLAttributes<HTMLDivElement> & { gap?: ScaleGap }) {
  return <div className={`app-stack app-stack--${gap} ${className}`} {...props}/>;
}

// Inline wraps items and uses only a named spacing token between siblings.
export function Inline({ gap = 'sm', className = '', ...props }: HTMLAttributes<HTMLDivElement> & { gap?: ScaleGap }) {
  return <div className={`app-inline app-inline--${gap} ${className}`} {...props}/>;
}

// Grid keeps a stable tokenized gap at every breakpoint.
export function Grid({ gap = 'md', className = '', ...props }: HTMLAttributes<HTMLDivElement> & { gap?: ScaleGap }) {
  return <div className={`app-grid app-grid--${gap} ${className}`} {...props}/>;
}

// Sticky actions sit above the safe area; pair with Screen's withSticky variant.
export function StickyActionBar({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`app-sticky-action-bar ${className}`} {...props}/>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'default' | 'large';

export const AppButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }>(
  ({ variant = 'primary', size = 'default', className = '', ...props }, ref) =>
    <button ref={ref} className={`app-button app-button--${variant} app-button--${size} ${className}`} {...props}/>,
);
AppButton.displayName = 'AppButton';

export const AppIconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  ({ label, className = '', ...props }, ref) => <button ref={ref} type="button" aria-label={label} className={`app-icon-button ${className}`} {...props}/>,
);
AppIconButton.displayName = 'AppIconButton';

export const AppInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => <input ref={ref} className={`app-input ${className}`} {...props}/>,
);
AppInput.displayName = 'AppInput';

export const AppSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...props }, ref) => <select ref={ref} className={`app-select ${className}`} {...props}/>,
);
AppSelect.displayName = 'AppSelect';

export const AppTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => <textarea ref={ref} className={`app-textarea ${className}`} {...props}/>,
);
AppTextarea.displayName = 'AppTextarea';

export function FormField({ id, label, helper, error, children }: { id: string; label: string; helper?: string; error?: string; children: ReactNode }) {
  return <div className="form-field"><label className="field-label" htmlFor={id}>{label}</label>{children}{helper && <p className="field-helper">{helper}</p>}{error && <p id={`${id}-error`} className="field-error" role="alert"><IconAlertCircle size={14}/><span>{error}</span></p>}</div>;
}

export function AppCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`app-card ${className}`}>{children}</section>;
}

export function StatCard({ label, value, className = '', icon, unit = '', color = '', sub }: { label: string; value: ReactNode; className?: string; icon?: ReactNode; unit?: string; color?: string; sub?: string }) {
  return <AppCard className={`app-stat-card ${className}`}>
    {(icon || sub) && <div className="app-stat-card__top">{icon && <span className="app-stat-card__icon">{icon}</span>}{sub && <AppBadge className="app-stat-card__sub">{sub}</AppBadge>}</div>}
    <strong className={`app-stat-card__value ${color}`}>{unit}{value}</strong>
    <span className="app-stat-card__label">{label}</span>
  </AppCard>;
}

const STATUS_PRESENTATION: Record<string, { label: string; tone: string }> = {
  finding: { label: 'Finding driver', tone: 'finding' },
  pending: { label: 'Pending', tone: 'finding' },
  arriving: { label: 'Driver arriving', tone: 'arriving' },
  accepted: { label: 'Accepted', tone: 'accepted' },
  verified: { label: 'Verified', tone: 'accepted' },
  active: { label: 'Active', tone: 'accepted' },
  'sos-active': { label: 'Active', tone: 'cancelled' },
  resolved: { label: 'Resolved', tone: 'completed' },
  in_progress: { label: 'In progress', tone: 'in-progress' },
  boarded: { label: 'In progress', tone: 'in-progress' },
  completed: { label: 'Completed', tone: 'completed' },
  cancelled: { label: 'Cancelled', tone: 'cancelled' },
  rejected: { label: 'Rejected', tone: 'cancelled' },
  suspended: { label: 'Suspended', tone: 'cancelled' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const normalized = status.toLowerCase().replace(/[\s-]+/g, '_');
  const presentation = STATUS_PRESENTATION[normalized] ?? { label: status.replace(/[_-]/g, ' '), tone: 'neutral' };
  return <span className={`status-badge status-badge--${presentation.tone}`}>{label ?? presentation.label}</span>;
}

export function EmptyState({ title, description, icon, action }: { title: string; description: string; icon?: ReactNode; action?: ReactNode }) {
  return <section className="empty-state-card empty-state">
    {icon && <div className="empty-state-card__icon">{icon}</div>}
    <h2>{title}</h2>
    <p>{description}</p>
    {action}
  </section>;
}

export function ErrorState({ message, action, className = '' }: { message: string; action?: ReactNode; className?: string }) {
  return <div role="alert" className={`error-state ${className}`}><IconAlertCircle size={16}/><span>{message}</span>{action}</div>;
}

export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={`skeleton-block ${className}`} {...props}/>;
}

export function AppBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`app-badge ${className}`}>{children}</span>;
}

export function ListRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`list-row ${className}`}>{children}</div>;
}

export function BottomSheet({ children, className = '', onToggle }: { children: ReactNode; className?: string; onToggle?: () => void }) {
  return <section className={`app-bottom-sheet ${className}`}>{onToggle && <button type="button" className="sheet-handle" onClick={onToggle} aria-label="Toggle details"><span/></button>}{children}</section>;
}

export function ConfirmDialog({ title, children, onCancel, onConfirm, confirmLabel = 'Confirm' }: { title: string; children: ReactNode; onCancel: () => void; onConfirm: () => void; confirmLabel?: string }) {
  return <div className="dialog-backdrop fixed inset-0 z-50 flex items-end justify-center p-4 md:items-center"><section className="dialog-card" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2><div className="dialog-card__body text-sm text-ink-soft">{children}</div><div className="flex gap-2"><AppButton type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancel</AppButton><AppButton type="button" variant="danger" className="flex-1" onClick={onConfirm}>{confirmLabel}</AppButton></div></section></div>;
}

export function TopBar({ title, leading, trailing }: { title: string; leading?: ReactNode; trailing?: ReactNode }) {
  return <header className="app-navigation-bar flex items-center justify-between border-b border-border bg-surface"><span>{leading}</span><h1 className="app-navigation-bar__title">{title}</h1><span>{trailing}</span></header>;
}

export function BottomTabBar({ tabs, active, onSelect }: { tabs: { id: string; label: string; icon?: ReactNode; badge?: ReactNode }[]; active: string; onSelect: (id: string) => void }) {
  return <nav aria-label="Main navigation" className="bottom-navigation flex bg-surface pb-safe">{tabs.map(tab => <button key={tab.id} type="button" aria-current={active === tab.id ? 'page' : undefined} className="bottom-navigation__tab relative flex flex-1 flex-col items-center justify-center gap-1" onClick={() => onSelect(tab.id)}>{tab.icon}{tab.badge && <span className="absolute right-1/2 top-0 translate-x-4">{tab.badge}</span>}<span className="text-xs">{tab.label}</span></button>)}</nav>;
}

export function AppShell({ navigation, header, children, footer }: { navigation: ReactNode; header: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return <div className="app-shell">{navigation}<div className="app-shell__main">{header}{children}{footer}</div></div>;
}

export function DataTable<T>({ columns, rows, getRowKey }: {
  columns: { key: string; label: string; render: (row: T) => ReactNode }[];
  rows: T[];
  getRowKey: (row: T) => string | number;
}) {
  return <div className="data-table-wrap"><table className="data-table">
    <thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={getRowKey(row)}>{columns.map(column => <td key={column.key} data-label={column.label}>{column.render(row)}</td>)}</tr>)}</tbody>
  </table></div>;
}
