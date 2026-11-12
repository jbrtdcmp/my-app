import { useEffect, useMemo, useState } from 'react';
import { ErrorState, Skeleton } from '../../components/ui';
import { getAdminFares, saveDiscounts, saveIntertownFare, saveMunicipalityFare, type AdminFares, type MunicipalityFare } from '../../services/api';
import { formatWhen } from '../../services/time';

const TOWNS = ['Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza'];
const EXAMPLE_KM = 3;

type TownDraft = Record<'base_fare' | 'included_km' | 'per_km_rate' | 'special_trip_multiplier', string>;
type Status = { kind: 'saved' | 'error'; text: string } | null;

// Same rule as api/fare_service.php: base fare covers the first km, then a rate per km, rounded up to the next ₱5.
function exampleFare(draft: TownDraft): number | null {
  const base = Number(draft.base_fare);
  const included = Number(draft.included_km);
  const perKm = Number(draft.per_km_rate);
  if (![base, included, perKm].every(Number.isFinite)) return null;
  const total = base + Math.max(0, EXAMPLE_KM - included) * perKm;
  return Math.ceil(total / 5) * 5;
}

function toDraft(rule: MunicipalityFare): TownDraft {
  return { base_fare: String(rule.base_fare), included_km: String(rule.included_km), per_km_rate: String(rule.per_km_rate), special_trip_multiplier: String(rule.special_trip_multiplier) };
}

function savedLabel(placeholder: boolean, updatedAt: string) {
  return placeholder ? 'Sample rate — confirm with the TODA/LGU, then save' : `Saved ${formatWhen(updatedAt)}`;
}

function NumberField({ label, prefix, suffix, value, onChange, step = '0.5' }: { label: string; prefix?: string; suffix?: string; value: string; onChange: (value: string) => void; step?: string }) {
  return (
    <label className="fare-field">
      <span className="fare-field__label">{label}</span>
      <span className="fare-field__control">
        {prefix && <span className="fare-field__affix">{prefix}</span>}
        <input type="number" inputMode="decimal" min="0" step={step} value={value} onChange={event => onChange(event.target.value)} aria-label={label}/>
        {suffix && <span className="fare-field__affix">{suffix}</span>}
      </span>
    </label>
  );
}

export default function FareEditor() {
  const [fares, setFares] = useState<AdminFares | null>(null);
  const [loadError, setLoadError] = useState('');
  const [townDrafts, setTownDrafts] = useState<Record<string, TownDraft>>({});
  const [pairDrafts, setPairDrafts] = useState<Record<string, string>>({});
  const [discountDraft, setDiscountDraft] = useState({ student: '', senior: '', pwd: '' });
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState('');

  const applyFares = (next: AdminFares) => {
    setFares(next);
    setTownDrafts(Object.fromEntries(next.municipalities.map(rule => [rule.municipality, toDraft(rule)])));
    setPairDrafts(Object.fromEntries(next.intertown.map(pair => [[pair.origin, pair.destination].sort().join('|'), String(pair.fixed_fare)])));
    setDiscountDraft({ student: String(next.discounts.student), senior: String(next.discounts.senior), pwd: String(next.discounts.pwd) });
  };

  useEffect(() => {
    let active = true;
    getAdminFares().then(next => { if (active) applyFares(next); }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load fares.'); });
    return () => { active = false; };
  }, []);

  // Every pair of towns, so missing between-town fares can be added too.
  const pairs = useMemo(() => {
    const list: { key: string; origin: string; destination: string }[] = [];
    TOWNS.forEach((origin, index) => TOWNS.slice(index + 1).forEach(destination => list.push({ key: [origin, destination].sort().join('|'), origin, destination })));
    return list;
  }, []);
  const storedPair = (key: string) => fares?.intertown.find(pair => [pair.origin, pair.destination].sort().join('|') === key);

  const run = async (key: string, action: () => Promise<AdminFares>, success: string) => {
    setSaving(key);
    setStatus(current => ({ ...current, [key]: null }));
    try {
      applyFares(await action());
      setStatus(current => ({ ...current, [key]: { kind: 'saved', text: success } }));
    } catch (error) {
      setStatus(current => ({ ...current, [key]: { kind: 'error', text: error instanceof Error ? error.message : 'Could not save.' } }));
    } finally {
      setSaving('');
    }
  };

  if (loadError) return <ErrorState message={loadError}/>;
  if (!fares) return <div className="space-y-3">{[0, 1, 2].map(index => <Skeleton key={index} className="h-32 rounded-2xl"/>)}</div>;

  const statusLine = (key: string) => {
    const current = status[key];
    return current ? <p role="status" className={current.kind === 'saved' ? 'fare-status fare-status--saved' : 'fare-status fare-status--error'}>{current.text}</p> : null;
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="fares-within">
        <div>
          <h4 id="fares-within" className="fare-heading">Rides within a town</h4>
          <p className="text-sm text-ink-soft">The base fare covers the first kilometres; each extra kilometre adds the rate. Totals round up to the next ₱5. Pakyaw (special trips) multiply the fare.</p>
        </div>
        {fares.municipalities.map(rule => {
          const draft = townDrafts[rule.municipality] ?? toDraft(rule);
          const changed = JSON.stringify(draft) !== JSON.stringify(toDraft(rule));
          const example = exampleFare(draft);
          const update = (field: keyof TownDraft) => (value: string) => setTownDrafts(current => ({ ...current, [rule.municipality]: { ...draft, [field]: value } }));
          return (
            <article key={rule.municipality} className="fare-card">
              <div className="fare-card__head">
                <h5>{rule.municipality}</h5>
                <span className={rule.is_placeholder ? 'fare-tag fare-tag--sample' : 'fare-tag'}>{savedLabel(rule.is_placeholder, rule.updated_at)}</span>
              </div>
              <div className="fare-card__fields">
                <NumberField label="Base fare" prefix="₱" value={draft.base_fare} onChange={update('base_fare')}/>
                <NumberField label="Km included" suffix="km" value={draft.included_km} onChange={update('included_km')}/>
                <NumberField label="Each extra km" prefix="₱" value={draft.per_km_rate} onChange={update('per_km_rate')}/>
                <NumberField label="Pakyaw" suffix="×" step="0.05" value={draft.special_trip_multiplier} onChange={update('special_trip_multiplier')}/>
              </div>
              <div className="fare-card__foot">
                <span className="text-sm text-ink-soft">{example === null ? 'Enter numbers to see an example.' : `A ${EXAMPLE_KM} km ride costs ₱${example}.`}</span>
                <button type="button" disabled={!changed || saving === rule.municipality} onClick={() => void run(rule.municipality, () => saveMunicipalityFare(rule.municipality, {
                  base_fare: Number(draft.base_fare), included_km: Number(draft.included_km), per_km_rate: Number(draft.per_km_rate), special_trip_multiplier: Number(draft.special_trip_multiplier),
                }), `${rule.municipality} fare saved. New bookings use it now.`)} className="btn-secondary btn-small">{saving === rule.municipality ? 'Saving…' : 'Save'}</button>
              </div>
              {statusLine(rule.municipality)}
            </article>
          );
        })}
      </section>

      <section className="space-y-3" aria-labelledby="fares-between">
        <div>
          <h4 id="fares-between" className="fare-heading">Rides between towns</h4>
          <p className="text-sm text-ink-soft">A fixed fare each way. Pairs without a fare can’t be booked yet.</p>
        </div>
        <div className="fare-card fare-card--list">
          {pairs.map(pair => {
            const stored = storedPair(pair.key);
            const value = pairDrafts[pair.key] ?? '';
            const changed = value !== '' && value !== String(stored?.fixed_fare ?? '');
            return (
              <div key={pair.key} className="fare-pair">
                <div className="min-w-0">
                  <p className="fare-pair__towns">{pair.origin} – {pair.destination}</p>
                  <p className={stored ? (stored.is_placeholder ? 'fare-pair__note fare-pair__note--sample' : 'fare-pair__note') : 'fare-pair__note fare-pair__note--missing'}>
                    {stored ? savedLabel(stored.is_placeholder, stored.updated_at) : 'Not set — this trip can’t be booked'}
                  </p>
                  {statusLine(pair.key)}
                </div>
                <div className="fare-pair__edit">
                  <NumberField label={`${pair.origin} to ${pair.destination} fare`} prefix="₱" step="5" value={value} onChange={next => setPairDrafts(current => ({ ...current, [pair.key]: next }))}/>
                  <button type="button" disabled={!changed || saving === pair.key} onClick={() => void run(pair.key, () => saveIntertownFare(pair.origin, pair.destination, Number(value)), 'Saved.')} className="btn-secondary btn-small">{saving === pair.key ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="fares-discounts">
        <div>
          <h4 id="fares-discounts" className="fare-heading">Discounts</h4>
          <p className="text-sm text-ink-soft">Percent off for passengers who choose a discount when booking. Philippine law sets 20% for seniors, PWDs and students.</p>
        </div>
        <article className="fare-card">
          <div className="fare-card__fields fare-card__fields--three">
            <NumberField label="Student" suffix="%" step="1" value={discountDraft.student} onChange={value => setDiscountDraft(current => ({ ...current, student: value }))}/>
            <NumberField label="Senior" suffix="%" step="1" value={discountDraft.senior} onChange={value => setDiscountDraft(current => ({ ...current, senior: value }))}/>
            <NumberField label="PWD" suffix="%" step="1" value={discountDraft.pwd} onChange={value => setDiscountDraft(current => ({ ...current, pwd: value }))}/>
          </div>
          <div className="fare-card__foot">
            <span/>
            <button type="button" disabled={saving === 'discounts' || JSON.stringify(discountDraft) === JSON.stringify({ student: String(fares.discounts.student), senior: String(fares.discounts.senior), pwd: String(fares.discounts.pwd) })}
              onClick={() => void run('discounts', () => saveDiscounts({ student: Number(discountDraft.student), senior: Number(discountDraft.senior), pwd: Number(discountDraft.pwd) }), 'Discounts saved.')} className="btn-secondary btn-small">{saving === 'discounts' ? 'Saving…' : 'Save'}</button>
          </div>
          {statusLine('discounts')}
        </article>
      </section>
    </div>
  );
}
