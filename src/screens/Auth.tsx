import { useEffect, useRef, useState } from 'react';
import {
  IconAlertCircle,
  IconCamera,
  IconCheck,
  IconDriver,
  IconProfile,
  IconX,
} from '../components/Icons';
import type { AuthPayload } from '../services/api';
import { AppButton, AppInput, AppSelect, FormField, Screen, Stack } from '../components/ui';

type Role = 'passenger' | 'driver';
type AuthMode = 'login' | 'register';
type AuthField = 'name' | 'phone' | 'email' | 'password' | 'confirmPassword' | 'plateNumber' | 'bodyNumber' | 'licenseNumber' | 'todaName' | 'municipality';

interface AuthProps {
  onAuth: (role: Role, payload: AuthPayload) => Promise<void>;
  notice?: string;
  onBack?: () => void;
  initialMode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
}

const municipalities = ['Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza'];

function AuthLayout({ mode, onBack, children }: { mode: AuthMode; onBack?: () => void; children: React.ReactNode }) {
  const title = mode === 'login' ? 'Welcome back' : 'Create your account';
  const subtitle = mode === 'login' ? 'Sign in to book or manage your rides.' : 'Join PASAKJA to book or provide local rides.';
  return (
    <Screen className="auth-screen">
      <section className={mode === 'register' ? 'auth-form-shell auth-form-shell--register' : 'auth-form-shell'}>
        <header className="auth-heading">
          {onBack && (
            <button type="button" className="auth-back-button" aria-label="Back to onboarding" onClick={onBack}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg>
            </button>
          )}
          <div className="auth-logo-mark" aria-hidden="true">P</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
        {children}
      </section>
    </Screen>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.9 10.9 0 0 1 12 5c5 0 8.5 4.5 9 7-.2 1-1 2.1-2.1 3.1M6.2 6.2C4.1 7.6 2.4 9.7 2 12c.5 2.5 4 7 10 7 1.3 0 2.5-.2 3.5-.7"/></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="auth-field-error" role="alert"><IconAlertCircle size={14}/><span>{message}</span></p>;
}

export default function Auth({ onAuth, notice, onBack, initialMode = 'login', onModeChange }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [role, setRole] = useState<Role>('passenger');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(() => new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [municipality, setMunicipality] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const fieldsRef = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [idPhotoUrl, setIdPhotoUrl] = useState('');
  const [idPhotoError, setIdPhotoError] = useState('');
  const [form, setForm] = useState({
    phone: '', password: '', name: '', email: '',
    plateNumber: '', bodyNumber: '', licenseNumber: '', todaName: '',
  });

  useEffect(() => () => {
    if (idPhotoUrl) URL.revokeObjectURL(idPhotoUrl);
  }, [idPhotoUrl]);

  const validateField = (field: string, values = form, confirmation = confirmPassword, selectedMunicipality = municipality): string => {
    const value = field === 'municipality'
      ? selectedMunicipality.trim()
      : field === 'confirmPassword'
        ? confirmation
        : values[field as keyof typeof values]?.trim() ?? '';
    if (field === 'phone' && mode === 'login') {
      if (!value) return 'Enter a phone number or email';
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const validPhone = /^\+?[0-9][0-9\s()-]{6,17}$/.test(value);
      return validEmail || validPhone ? '' : 'Enter a valid phone number or email';
    }
    if (field === 'name' && !value) return 'Enter your full name';
    if (field === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email';
    if (field === 'phone' && !value) return 'Enter a valid phone number';
    if (field === 'phone' && value && !/^\+?[0-9]{7,18}$/.test(value.replace(/[^0-9+]/g, ''))) return 'Enter a valid phone number';
    if (field === 'municipality' && !value) return 'Select your municipality';
    if (field === 'password' && value.length < 8) return 'At least 8 characters';
    if (field === 'confirmPassword' && confirmation !== form.password) return "Passwords don't match";
    if (field === 'plateNumber' && !value) return 'Plate number is required';
    if (field === 'bodyNumber' && !value) return 'Body number is required';
    if (field === 'licenseNumber' && !value) return 'License number is required';
    if (field === 'todaName' && !value) return 'Select your TODA';
    return '';
  };

  const changeField = (field: string, value: string) => {
    setAuthError('');
    const nextForm = field in form ? { ...form, [field]: value } : form;
    if (field in form) setForm(nextForm);
    if (field === 'confirmPassword') setConfirmPassword(value);
    if (field === 'municipality') setMunicipality(value);
    if (fieldErrors[field] || touchedFields.has(field) || submitAttempted) {
      const nextConfirmation = field === 'confirmPassword' ? value : confirmPassword;
      const nextMunicipality = field === 'municipality' ? value : municipality;
      const error = validateField(field, nextForm, nextConfirmation, nextMunicipality);
      setFieldErrors(current => ({ ...current, [field]: error }));
      if (field === 'password' && (touchedFields.has('confirmPassword') || submitAttempted)) {
        setFieldErrors(current => ({
          ...current,
          password: error,
          confirmPassword: validateField('confirmPassword', nextForm, confirmPassword, nextMunicipality),
        }));
      }
    }
  };

  const handleBlur = (field: AuthField) => {
    setTouchedFields(current => new Set(current).add(field));
    setFieldErrors(current => ({
      ...current,
      [field]: validateField(field),
    }));
  };

  const handlePhoto = (file?: File) => {
    setIdPhotoError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setIdPhotoError('Choose an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setIdPhotoError('Image must be 2 MB or smaller');
      return;
    }
    if (idPhotoUrl) URL.revokeObjectURL(idPhotoUrl);
    setIdPhoto(file);
    setIdPhotoUrl(URL.createObjectURL(file));
    setFieldErrors(current => ({ ...current, idPhoto: '' }));
  };

  const removePhoto = () => {
    if (idPhotoUrl) URL.revokeObjectURL(idPhotoUrl);
    setIdPhoto(null);
    setIdPhotoUrl('');
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (submitAttempted) setFieldErrors(current => ({ ...current, idPhoto: 'Upload your ID photo' }));
  };

  const switchMode = () => {
    const nextMode = mode === 'login' ? 'register' : 'login';
    setMode(nextMode);
    onModeChange?.(nextMode);
    setFieldErrors({});
    setTouchedFields(new Set());
    setSubmitAttempted(false);
    setAuthError('');
    setConfirmPassword('');
  };

  const submit = async () => {
    if (isSubmitting) return;
    setAuthError('');
    setSubmitAttempted(true);
    const fields: string[] = mode === 'login' ? ['phone', 'password'] : [
      'name', 'phone', 'email', 'municipality', 'password', 'confirmPassword',
      ...(role === 'driver' ? ['plateNumber', 'bodyNumber', 'licenseNumber', 'todaName', 'idPhoto'] : []),
    ];
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const message = field === 'idPhoto'
        ? (idPhoto ? '' : 'Upload your ID photo')
        : validateField(field);
      if (message) errors[field] = message;
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const firstField = fields.find(field => errors[field]);
      if (firstField) requestAnimationFrame(() => {
        const element = firstField === 'idPhoto' ? photoInputRef.current : fieldsRef.current[firstField];
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element?.focus();
      });
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await onAuth(role, { mode, role, ...form });
    } catch (error) {
      setAuthError(mode === 'login'
        ? 'We couldn’t sign you in with those details. Check them and try again.'
        : (error instanceof Error ? error.message : 'Unable to create your account. Please try again.'));
      if (mode === 'register' && error && typeof error === 'object' && 'details' in error && error.details && typeof error.details === 'object') {
        setFieldErrors(Object.fromEntries(Object.keys(error.details).map(field => [field, 'Check this field'])));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordStrength = [
    form.password.length >= 8,
    /[a-z]/.test(form.password) && /[A-Z]/.test(form.password),
    /\d/.test(form.password),
    /[^A-Za-z0-9]/.test(form.password),
  ].filter(Boolean).length;

  const field = (name: AuthField) => ({
    ref: (element: HTMLInputElement | HTMLSelectElement | null) => { fieldsRef.current[name] = element; },
    onBlur: () => handleBlur(name),
    'aria-invalid': Boolean(fieldErrors[name]),
    'aria-describedby': fieldErrors[name] ? `auth-${name}-error` : undefined,
  });

  return (
    <AuthLayout mode={mode} onBack={onBack}>
      <form className="auth-form-card" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
        {mode === 'register' && (
          <fieldset className="auth-role-field">
            <legend className="auth-fieldset-label">I am a...</legend>
            <div className="auth-role-options" role="radiogroup" aria-label="Account type">
              {(['passenger', 'driver'] as Role[]).map(selectedRole => (
                <label key={selectedRole} className={`auth-role-option${role === selectedRole ? ' auth-role-option--selected' : ''}`}>
                  <input
                    className="auth-role-option__radio"
                    type="radio"
                    name="accountRole"
                    value={selectedRole}
                    checked={role === selectedRole}
                    disabled={isSubmitting}
                    onChange={() => {
                      setRole(selectedRole);
                      setAuthError('');
                      setFieldErrors(current => {
                        const next = { ...current };
                        if (selectedRole === 'passenger') {
                          for (const key of ['plateNumber', 'bodyNumber', 'licenseNumber', 'todaName', 'idPhoto']) delete next[key];
                        }
                        return next;
                      });
                    }}
                  />
                  {selectedRole === 'passenger' ? <IconProfile size={20}/> : <IconDriver size={20}/>}
                  <span className="auth-role-option__copy">
                    <strong>{selectedRole === 'passenger' ? 'Passenger' : 'Driver'}</strong>
                    <small>{selectedRole === 'passenger' ? 'Book rides' : 'Accept rides'}</small>
                  </span>
                  {role === selectedRole && <IconCheck size={16} className="auth-role-option__check"/>}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Stack gap="md" className="auth-field-stack">
          {mode === 'register' && (
            <div className="auth-two-columns">
              <FormField id="auth-name" label="Full name" error={fieldErrors.name}>
                <AppInput
                  {...field('name')}
                  id="auth-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={event => changeField('name', event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Juan dela Cruz"
                  className="auth-input"
                />
              </FormField>
              <FormField id="auth-phone" label="Phone number" error={fieldErrors.phone}>
                <div className="auth-phone-control">
                  <span className="auth-phone-prefix" aria-hidden="true">+63</span>
                  <AppInput
                    {...field('phone')}
                    id="auth-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel-national"
                    value={form.phone}
                    onChange={event => changeField('phone', event.target.value)}
                    disabled={isSubmitting}
                    placeholder="9XX XXX XXXX"
                    className="auth-input"
                  />
                </div>
              </FormField>
            </div>
          )}

          {mode === 'login' && (
            <FormField id="auth-phone" label="Phone number or email" error={fieldErrors.phone}>
              <AppInput
                {...field('phone')}
                id="auth-phone"
                name="phone"
                type="text"
                autoComplete="username"
                value={form.phone}
                onChange={event => changeField('phone', event.target.value)}
                disabled={isSubmitting}
                placeholder="Phone or email"
                className="auth-input"
              />
            </FormField>
          )}

          {mode === 'register' && (
            <>
              <FormField id="auth-email" label="Email (optional)" error={fieldErrors.email}>
                <AppInput
                  {...field('email')}
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={event => changeField('email', event.target.value)}
                  disabled={isSubmitting}
                  placeholder="juan@email.com"
                  className="auth-input"
                />
              </FormField>
              <FormField id="auth-municipality" label="Municipality" error={fieldErrors.municipality}>
                <AppSelect
                  {...field('municipality')}
                  id="auth-municipality"
                  name="municipality"
                  value={municipality}
                  onChange={event => changeField('municipality', event.target.value)}
                  disabled={isSubmitting}
                  className="auth-input"
                >
                  <option value="">Select your municipality</option>
                  {municipalities.map(name => <option key={name} value={name}>{name}</option>)}
                </AppSelect>
              </FormField>
            </>
          )}

          {mode === 'register' ? (
            <div className="auth-two-columns">
              <FormField id="auth-password" label="Password" helper="At least 8 characters" error={fieldErrors.password}>
                <div className="auth-password-wrap">
                  <AppInput
                    {...field('password')}
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={event => changeField('password', event.target.value)}
                    disabled={isSubmitting}
                    placeholder="At least 8 characters"
                    className="auth-input auth-password-input"
                  />
                  <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                    <EyeIcon hidden={showPassword}/>
                  </button>
                </div>
                <div className="auth-password-strength" aria-label={`Password strength: ${passwordStrength} of 4`}>
                  {[0, 1, 2, 3].map(segment => <span key={segment} className={segment < passwordStrength ? 'auth-password-strength__segment is-active' : 'auth-password-strength__segment'}/>)}
                </div>
              </FormField>
              <FormField id="auth-confirmPassword" label="Confirm password" error={fieldErrors.confirmPassword}>
                <div className="auth-password-wrap">
                  <AppInput
                    id="auth-confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    ref={element => { fieldsRef.current.confirmPassword = element; }}
                    onBlur={() => handleBlur('confirmPassword')}
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    aria-describedby={fieldErrors.confirmPassword ? 'auth-confirmPassword-error' : undefined}
                    onChange={event => changeField('confirmPassword', event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Re-enter your password"
                    className="auth-input auth-password-input"
                  />
                  <button type="button" className="auth-password-toggle" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword(value => !value)}>
                    <EyeIcon hidden={showConfirmPassword}/>
                  </button>
                </div>
              </FormField>
            </div>
          ) : (
            <FormField id="auth-password" label="Password" error={fieldErrors.password}>
              <div className="auth-password-wrap">
                <AppInput
                  {...field('password')}
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={event => changeField('password', event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Password"
                  className="auth-input auth-password-input"
                />
                <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                  <EyeIcon hidden={showPassword}/>
                </button>
              </div>
              <button type="button" className="auth-forgot-link">Forgot password?</button>
            </FormField>
          )}

          {mode === 'register' && role === 'driver' && (
            <section className="auth-driver-section" aria-label="Driver details">
              <h2>Driver details</h2>
              <div className="auth-two-columns">
                <FormField id="auth-plateNumber" label="Plate number" error={fieldErrors.plateNumber}>
                  <AppInput {...field('plateNumber')} id="auth-plateNumber" value={form.plateNumber} onChange={event => changeField('plateNumber', event.target.value)} disabled={isSubmitting} placeholder="SDS-0000" className="auth-input"/>
                </FormField>
                <FormField id="auth-bodyNumber" label="Body number" error={fieldErrors.bodyNumber}>
                  <AppInput {...field('bodyNumber')} id="auth-bodyNumber" value={form.bodyNumber} onChange={event => changeField('bodyNumber', event.target.value)} disabled={isSubmitting} placeholder="XXX-000" className="auth-input"/>
                </FormField>
              </div>
              <FormField id="auth-todaName" label="TODA name" error={fieldErrors.todaName}>
                <AppSelect {...field('todaName')} id="auth-todaName" value={form.todaName} onChange={event => changeField('todaName', event.target.value)} disabled={isSubmitting} className="auth-input">
                  <option value="">Select your TODA</option>
                  <option value="Carrascal TODA">Carrascal TODA</option>
                  <option value="Cantilan Tricycle Operators Assoc.">Cantilan Tricycle Operators Assoc.</option>
                  <option value="Madrid TODA Federation">Madrid TODA Federation</option>
                  <option value="Carmen TODA">Carmen TODA</option>
                  <option value="Lanuza Tricycle Operators Coop.">Lanuza Tricycle Operators Coop.</option>
                </AppSelect>
              </FormField>
              <FormField id="auth-licenseNumber" label="License number" error={fieldErrors.licenseNumber}>
                <AppInput {...field('licenseNumber')} id="auth-licenseNumber" value={form.licenseNumber} onChange={event => changeField('licenseNumber', event.target.value)} disabled={isSubmitting} placeholder="N02-00-000000" className="auth-input"/>
              </FormField>
              <FormField id="auth-vehicleType" label="Vehicle type">
                <AppSelect id="auth-vehicleType" value={vehicleType} onChange={event => setVehicleType(event.target.value)} disabled={isSubmitting} className="auth-input">
                  <option value="">Select vehicle type</option>
                  <option value="tricycle">Tricycle</option>
                </AppSelect>
              </FormField>
              <div className="auth-photo-field">
                <label className="field-label" htmlFor="auth-id-photo">ID photo</label>
                <input
                  id="auth-id-photo"
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="auth-file-input"
                  onChange={event => handlePhoto(event.target.files?.[0])}
                  disabled={isSubmitting}
                  aria-describedby={idPhotoError || fieldErrors.idPhoto ? 'auth-idPhoto-error' : undefined}
                  aria-invalid={Boolean(idPhotoError || fieldErrors.idPhoto)}
                />
                <div className="auth-photo-actions">
                  {idPhotoUrl
                    ? <img src={idPhotoUrl} alt="Selected ID photo preview" className="auth-photo-preview"/>
                    : <div className="auth-photo-placeholder"><IconCamera size={20}/></div>}
                  <div>
                    <button type="button" className="auth-photo-button" onClick={() => photoInputRef.current?.click()} disabled={isSubmitting}>{idPhoto ? 'Replace' : 'Upload ID photo'}</button>
                    {idPhoto && <button type="button" className="auth-photo-remove" onClick={removePhoto} disabled={isSubmitting}><IconX size={14}/>Remove</button>}
                    <p className="field-helper">Images only, max 2 MB</p>
                  </div>
                </div>
                <FieldError id="auth-idPhoto-error" message={idPhotoError || fieldErrors.idPhoto}/>
              </div>
              <p className="auth-review-note">Your account will be reviewed by an admin before you can go online.</p>
            </section>
          )}
        </Stack>

        {notice && <p className="auth-notice" role="status">{notice}</p>}
        {authError && <div className="auth-error-alert" role="alert"><IconAlertCircle size={16}/><span>{authError}</span></div>}
        {mode === 'register' && <p className="auth-terms">By creating an account, you agree to PASAKJA’s terms and privacy policy.</p>}
        <AppButton type="button" size="large" disabled={isSubmitting} onClick={() => void submit()} className="auth-submit-button">
          {isSubmitting
            ? <><span className="btn-spinner" aria-hidden="true"/>{mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
            : mode === 'login' ? 'Log In' : 'Create account'}
        </AppButton>
        <p className="auth-footer">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button type="button" className="auth-footer-link" onClick={switchMode}>{mode === 'login' ? 'Sign up' : 'Sign in'}</button>
        </p>
      </form>
    </AuthLayout>
  );
}
