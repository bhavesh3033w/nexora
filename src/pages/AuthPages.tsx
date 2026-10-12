import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, Sparkles, Users, GraduationCap, CalendarDays, CheckCircle2, ScrollText } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { Banner } from '../components/ui';
import { load } from '../lib/storage';
import type { Role } from '../types';

const Pw = ({ id, label, reg, error, auto }: { id: string; label: string; reg: object; error?: string; auto: string }) => {
  const [show, setShow] = useState(false);
  return (<label className="f" htmlFor={id}>{label}<span className="pw"><input id={id} className="input" type={show ? 'text' : 'password'} autoComplete={auto} aria-invalid={!!error} {...reg} />
    <button type="button" className="icon-btn" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
    {error && <span className="err-text">{error}</span>}</label>);
};
const loginSchema = z.object({ email: z.string().email('Enter a valid email address'), password: z.string().min(1, 'Password is required'), remember: z.boolean().optional() });
type LoginVals = z.infer<typeof loginSchema>;

/** Shared form body. Role is fixed by the page (portal) — there is no role selector. */
function LoginForm({ portal }: { portal: Role }) {
  const { login } = useAuth(); const nav = useNavigate(); const loc = useLocation();
  const remKey = 'nexora.rememberEmail.' + portal; // email only — never the password
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginVals>({ resolver: zodResolver(loginSchema), defaultValues: { email: load(remKey, ''), remember: !!load(remKey, '') } });
  const [msg, setMsg] = useState<{ k: 'error' | 'ok'; t: string } | null>(null);
  const denied = (loc.state as { denied?: boolean } | null)?.denied;
  const go = async (v: LoginVals) => {
    setMsg(null);
    try {
      await login(portal, v.email, v.password);
      if (v.remember) localStorage.setItem(remKey, JSON.stringify(v.email)); else localStorage.removeItem(remKey);
      setMsg({ k: 'ok', t: 'Signed in. Redirecting…' });
      // the user workspace gate sends first-time users to /onboarding once the server's saved preferences are loaded
      setTimeout(() => nav(portal === 'admin' ? '/admin/dashboard' : '/app', { replace: true }), 350);
    } catch (e) { setMsg({ k: 'error', t: e instanceof Error ? e.message : 'Sign-in failed. Please try again.' }); }
  };
  return (
    <form className="col" onSubmit={handleSubmit(go)} noValidate aria-label={portal === 'admin' ? 'Admin sign in' : 'User sign in'}>
      {denied && <Banner kind="error">Your account does not have access to that area. Please sign in with the correct portal.</Banner>}
      <label className="f" htmlFor={portal + '-email'}>Email<input id={portal + '-email'} className="input" type="email" autoComplete="username" aria-invalid={!!errors.email} {...register('email')} />{errors.email && <span className="err-text">{errors.email.message}</span>}</label>
      <Pw id={portal + '-pw'} label="Password" auto="current-password" reg={register('password')} error={errors.password?.message} />
      <div className="row between wrap"><label className="row small"><input type="checkbox" className="check" {...register('remember')} /> Remember email</label><Link className="lk" to={`/forgot-password?portal=${portal}`}>Forgot password?</Link></div>
      {msg && <Banner kind={msg.k}>{msg.t}</Banner>}
      <button className="btn primary" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign In'}</button>
    </form>
  );
}
const Back = () => <Link className="lk row small" to="/"><ArrowLeft size={14} /> Back to main website</Link>;

export function AdminLogin() {
  return (
    <div className="warm-scene auth"><div className="aurora admin" aria-hidden><i /><i /><i /></div>
      <section className="panel layer"><div className="glass form">
        <div className="brand"><span className="logo" style={{ background: 'linear-gradient(135deg,var(--btn-a),var(--btn-b))' }}><ShieldCheck size={16} /></span>Nexora Admin</div>
        <div><h1 style={{ fontSize: '1.7em' }}>Administrator sign in</h1><p className="muted">Authorized personnel only. Activity is monitored.</p></div>
        <LoginForm portal="admin" />
        <div className="row between wrap small"><Link className="lk" to="/user/login">Looking for the User Workspace? →</Link><Link className="lk" to="/admin/register">Account setup</Link></div><Back />
      </div></section>
      <aside className="art layer" aria-hidden><div className="glass col" style={{ padding: 24, width: 380, transform: 'perspective(900px) rotateY(-8deg)' }}>
        <div className="row"><Lock size={16} /><b>Administration</b></div>
        {['Role-based access enforced by the server', 'Privileged actions are audited', 'No administrative data is shown before sign-in'].map(t => <div key={t} className="glass row" style={{ padding: 12 }}><ScrollText size={16} /><span className="small">{t}</span></div>)}</div></aside>
    </div>
  );
}
export function UserLogin() {
  return (
    <div className="warm-scene auth flip"><div className="aurora" aria-hidden><i /><i /><i /></div>
      <aside className="art layer" aria-hidden><div style={{ position: 'relative', width: 380, height: 380 }}>
        {[[CalendarDays, 'Your meetings', 0, 0], [Users, 'Your messages', 120, 110], [GraduationCap, 'Your learning', 20, 230]].map(([I, t, x, y], i) => { const Ic = I as typeof Users; return (
          <div key={i} className="glass row" style={{ position: 'absolute', left: x as number, top: y as number, padding: 16, animation: `floaty ${6 + i}s ease-in-out infinite` }}><Ic size={18} color="#8F7466" /><b>{t as string}</b></div>); })}</div></aside>
      <section className="panel layer"><div className="glass form">
        <div className="brand"><span className="logo"><Sparkles size={16} /></span>Nexora User Workspace</div>
        <div><h1 style={{ fontSize: '1.7em' }}>Welcome back</h1><p className="muted">Your workspace is ready when you are.</p></div>
        <LoginForm portal="user" />
        <div className="row between wrap small"><span>New here? <Link className="lk" to="/user/register">Create an account</Link></span><Link className="lk" to="/admin/login">Admin Portal →</Link></div><Back />
      </div></section>
    </div>
  );
}

const regSchema = z.object({ name: z.string().min(2, 'Enter your full name'), email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters').regex(/[A-Z]/, 'Include an uppercase letter').regex(/[0-9]/, 'Include a number'), confirm: z.string() })
  .refine(v => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
export function UserRegister() {
  const { register: signUp } = useAuth(); const nav = useNavigate(); const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof regSchema>>({ resolver: zodResolver(regSchema) });
  const go = async (v: z.infer<typeof regSchema>) => { setErr(''); try { await signUp(v.name, v.email, v.password); nav('/onboarding', { replace: true }); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not create the account.'); } };
  return (
    <div className="warm-scene auth flip"><div className="aurora" aria-hidden><i /><i /><i /></div>
      <aside className="art layer" aria-hidden><div className="glass col" style={{ padding: 28, maxWidth: 360 }}>{['Tell us how you work (14 quick questions)', 'We shape the workspace around you', 'Say what you need — it adapts'].map(t => <div key={t} className="row"><CheckCircle2 color="#2DD4BF" /> {t}</div>)}</div></aside>
      <section className="panel layer"><form className="glass form" onSubmit={handleSubmit(go)} noValidate aria-label="Create account">
        <div className="brand"><span className="logo"><Sparkles size={16} /></span>Nexora User Workspace</div><h1 style={{ fontSize: '1.7em' }}>Create your account</h1>
        <label className="f" htmlFor="rn">Full name<input id="rn" className="input" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />{errors.name && <span className="err-text">{errors.name.message}</span>}</label>
        <label className="f" htmlFor="re">Email<input id="re" type="email" className="input" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />{errors.email && <span className="err-text">{errors.email.message}</span>}</label>
        <Pw id="rp" label="Password" auto="new-password" reg={register('password')} error={errors.password?.message} />
        <Pw id="rc" label="Confirm password" auto="new-password" reg={register('confirm')} error={errors.confirm?.message} />
        {err && <Banner kind="error">{err}</Banner>}
        <button className="btn primary" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create Account'}</button>
        <div className="row between wrap small"><span>Have an account? <Link className="lk" to="/user/login">Sign in</Link></span><Link className="lk" to="/admin/login">Admin Portal →</Link></div><Back />
      </form></section>
    </div>
  );
}
export function AdminRegister() {
  return (
    <div className="warm-scene center-screen"><div className="aurora admin" aria-hidden><i /><i /><i /></div>
      <div className="glass form layer" style={{ padding: 28, width: 'min(480px,92vw)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="brand"><span className="logo"><ShieldCheck size={16} /></span>Nexora Admin</div><h1 style={{ fontSize: '1.6em' }}>Administrator setup is invitation-only</h1>
        <p className="muted">Public registration never grants administrative access. Administrator accounts are provisioned by the backend through an authorized invitation or a verified administrative process.</p>
        <fieldset disabled style={{ border: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, opacity: .6 }}><label className="f">Invitation code<input className="input" placeholder="Not available yet" /></label><button className="btn primary">Redeem invitation</button></fieldset>
        <div className="row between small"><Link className="lk" to="/admin/login">← Admin sign in</Link><Link className="lk" to="/">Main website</Link></div>
      </div></div>
  );
}
export function ForgotPassword() {
  const [sp] = useSearchParams(); const portal = sp.get('portal') === 'admin' ? 'admin' : 'user';
  return (
    <div className="warm-scene center-screen"><div className="aurora" aria-hidden><i /><i /><i /></div>
      <div className="glass layer" style={{ padding: 28, width: 'min(440px,92vw)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ fontSize: '1.5em' }}>Reset your password</h1>
        <Banner kind="info">Password reset is not available yet — the backend has no password-reset endpoint, so no email can be sent. Please contact your administrator.</Banner>
        <fieldset disabled style={{ border: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, opacity: .6 }}><label className="f">Email<input className="input" type="email" /></label><button className="btn primary">Send reset link</button></fieldset>
        <Link className="lk" to={`/${portal}/login`}>← Back to sign in</Link>
      </div></div>
  );
}
export const NotFound = () => <div className="warm-scene center-screen"><div className="layer col" style={{ textAlign: 'center' }}><h1>Page not found</h1><Link className="btn primary" to="/">Back to Nexora</Link></div></div>;
