import type { ReactNode } from 'react';
import { Logo } from '../components/Logo';

// Bump this (and TERMS_VERSION in api/features_service.php) when either document changes,
// so new sign-ups record which version they accepted.
export const TERMS_VERSION = '2026-11-21';
const EFFECTIVE_DATE = '21 November 2026';

// Set at build time in .env: who runs PASAKJA and how people reach them.
const OPERATOR = (import.meta.env.VITE_OPERATOR_NAME as string | undefined)?.trim() || 'the PASAKJA administrator';
const CONTACT = (import.meta.env.VITE_SUPPORT_CONTACT as string | undefined)?.trim() || '';
const contactLine = CONTACT ? `${OPERATOR} at ${CONTACT}` : `${OPERATOR} through your TODA office or a PASAKJA admin`;

export type LegalDocument = 'privacy' | 'terms';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="legal-page__section"><h2>{title}</h2>{children}</section>;
}

function PrivacyNotice() {
  return <>
    <Section title="Who runs PASAKJA">
      <p>PASAKJA is a free tricycle booking service for Carrascal, Cantilan, Madrid, Carmen and Lanuza in Surigao del Sur. It is run by {OPERATOR}, who decides how your personal information is used and keeps it safe. Questions and requests go to {contactLine}.</p>
    </Section>
    <Section title="What we collect">
      <ul>
        <li><strong>Your account:</strong> name, mobile number, email (optional), home town, password (stored only in scrambled form, never readable), and a profile photo if you add one.</li>
        <li><strong>Drivers also give:</strong> plate number, body number, TODA, license number, vehicle type, and a photo of their driver’s license or ID.</li>
        <li><strong>Location:</strong> the pickup point and destination you choose, your phone’s location when you book or send an SOS, and a driver’s location while they are online and during each ride (a trail of positions is saved with the ride).</li>
        <li><strong>Rides:</strong> times, places, fare, status, notes to the driver, ratings and comments.</li>
        <li><strong>Safety:</strong> SOS alerts with their location, and links you create to share a live trip.</li>
        <li><strong>Technical:</strong> sign-in attempts with your network address (kept for one day to stop password guessing), your sign-in session (it ends when you log out or after 30 days), and your browser’s notification address if you turn notifications on.</li>
      </ul>
    </Section>
    <Section title="Why we use it">
      <p>To create your account and keep it secure, match your booking with a nearby driver, show routes and fares, let passenger and driver find and contact each other during a ride, keep ride history, ratings and earnings, check drivers before they are approved, respond to SOS alerts and complaints, send you ride notices, and prepare ride summaries for the TODA and town.</p>
    </Section>
    <Section title="Who can see it">
      <ul>
        <li><strong>Passengers</strong> see their driver’s name, phone number, plate and body number, TODA, rating, and location during the ride.</li>
        <li><strong>Drivers</strong> see a passenger’s name, pickup point, destination and note — not the passenger’s phone number.</li>
        <li><strong>Anyone you send a shared trip link to</strong> sees the trip status, pickup and destination, and the driver’s name, plate and position, only while the ride is active and for at most 24 hours.</li>
        <li><strong>PASAKJA admins</strong> see account and ride records, license photos (every view is recorded), and SOS alerts, so they can approve drivers, handle complaints and respond to emergencies.</li>
      </ul>
      <p>We do not sell or rent your information, and PASAKJA has no advertising.</p>
    </Section>
    <Section title="Services we rely on">
      <ul>
        <li>Our web host stores the PASAKJA database.</li>
        <li>Map images load from OpenStreetMap, which sees your network address and the map area you view.</li>
        <li>For street routes and place names, our server sends map coordinates — never your name or number — to OpenStreetMap-based services (OSRM and Nominatim).</li>
        <li>Notifications, if you turn them on, pass in encrypted form through your browser’s push service (Google, Apple or Mozilla).</li>
      </ul>
    </Section>
    <Section title="How long we keep it">
      <p>We keep your information while your account exists. When you delete your account in Profile, your name, phone number, email, profile photo and license photo are erased and you are signed out everywhere. Ride records stay without your name, because the other person in the ride and the TODA still need them for safety and records.</p>
    </Section>
    <Section title="How we protect it">
      <p>Connections use HTTPS, passwords are stored only in scrambled form, repeated wrong passwords are blocked for a while, only admins can open license photos, and admin actions are logged. No system is perfectly secure, so please keep your password private and tell us if you notice anything wrong.</p>
    </Section>
    <Section title="Your rights">
      <p>Under the Data Privacy Act of 2012 you may ask what information we hold about you, see your details and ride history in the app, correct them with Edit in Profile, delete your account in Profile, and withdraw your consent by deleting your account. You may also file a complaint with the National Privacy Commission.</p>
    </Section>
    <Section title="Changes">
      <p>If this notice changes, the app will show the new version and ask you to agree to it.</p>
    </Section>
  </>;
}

function TermsOfUse() {
  return <>
    <Section title="What PASAKJA is">
      <p>PASAKJA is a free service that connects passengers with TODA tricycle drivers in Carrascal, Cantilan, Madrid, Carmen and Lanuza. Drivers are not employees of PASAKJA; each ride is between the passenger and the driver.</p>
    </Section>
    <Section title="Your account">
      <ul>
        <li>Use your real name and your own mobile number, and keep one account per person.</li>
        <li>Keep your password private; you are responsible for what is done with your account.</li>
        <li>If you are under 18, use PASAKJA only with your parent’s or guardian’s permission.</li>
      </ul>
    </Section>
    <Section title="For passengers">
      <ul>
        <li>Book only rides you will take, and be at the pickup point when the driver arrives.</li>
        <li>Pay the driver the fare shown in the app, in cash.</li>
        <li>For a student, senior citizen or PWD discount, show the driver a valid ID.</li>
        <li>Cancel in the app if your plans change.</li>
      </ul>
    </Section>
    <Section title="For drivers">
      <ul>
        <li>You must have a valid driver’s license, a registered tricycle and TODA membership, and be approved by a PASAKJA admin.</li>
        <li>Follow traffic laws and your TODA’s rules, and charge only the fare shown in the app.</li>
        <li>Go online only when you can take rides, and keep your location on while online.</li>
      </ul>
    </Section>
    <Section title="Fares">
      <p>Fares for each town are set by PASAKJA admins following the rates of the TODA and the town, and the fare is shown before you book. Map routes and arrival times are estimates.</p>
    </Section>
    <Section title="Safety and SOS">
      <p>The SOS button alerts PASAKJA admins. It does not replace calling 911 or your town’s hotlines: if you are in danger, call them first. We cannot promise that an admin will see an alert right away.</p>
    </Section>
    <Section title="Not allowed">
      <p>Fake bookings, using another person’s number or account, harassment, threats, discrimination, false SOS alerts, and any attempt to break into or overload the system. Admins may suspend an account that breaks these rules; you will see the reason when you sign in.</p>
    </Section>
    <Section title="Availability">
      <p>PASAKJA runs on free services, so it may sometimes be slow or unavailable, and features may change. It is provided as it is, without a guarantee that it will always work.</p>
    </Section>
    <Section title="Changes and contact">
      <p>If these terms change, the app will show the new version and ask you to agree to it. Questions go to {contactLine}.</p>
    </Section>
  </>;
}

// Public pages at /privacy and /terms, readable without signing in.
export default function Legal({ doc }: { doc: LegalDocument }) {
  const title = doc === 'privacy' ? 'Privacy Notice' : 'Terms of Use';
  return <main className="legal-page">
    <article className="legal-page__card">
      <header className="legal-page__header">
        <div>
          <p className="eyebrow">PASAKJA</p>
          <h1>{title}</h1>
          <p className="legal-page__date">Effective {EFFECTIVE_DATE}</p>
        </div>
        <Logo width={32}/>
      </header>
      {doc === 'privacy' ? <PrivacyNotice/> : <TermsOfUse/>}
      <footer className="legal-page__footer">
        <a href={doc === 'privacy' ? '/terms' : '/privacy'}>{doc === 'privacy' ? 'Terms of Use' : 'Privacy Notice'}</a>
        <a href="/">Open PASAKJA</a>
      </footer>
    </article>
  </main>;
}
