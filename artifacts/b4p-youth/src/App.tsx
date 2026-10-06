import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type * as React from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Bell, BookOpen, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Compass, ExternalLink,
  FileText, Filter, Globe2, HeartHandshake, LayoutDashboard, Mail, MapPin, Menu, MessageSquare,
  Search, Settings, ShieldCheck, Sparkles, Users, X, CheckCircle2, Plus, Pencil, Trash2,
  UserRound, LogOut, RefreshCw, Send, GraduationCap, Megaphone,
} from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  useHealthCheck, getHealthCheckQueryKey, useGetDashboard, getGetDashboardQueryKey,
  useGetMyProfile, getGetMyProfileQueryKey, useListMyApplications, getListMyApplicationsQueryKey,
  useListOpportunities, getListOpportunitiesQueryKey, useGetOpportunity, getGetOpportunityQueryKey,
  useListPrograms, getListProgramsQueryKey, useGetProgram, getGetProgramQueryKey,
  useListEvents, getListEventsQueryKey, useGetEvent, getGetEventQueryKey,
  useListMyNotifications, getListMyNotificationsQueryKey, useGetAbout, getGetAboutQueryKey,
  useGetAdminDashboard, getGetAdminDashboardQueryKey, useListUsers, getListUsersQueryKey,
  useGetUser, getGetUserQueryKey, useListAdminOpportunities, getListAdminOpportunitiesQueryKey,
  useListAdminPrograms, getListAdminProgramsQueryKey, useListAdminApplications,
  getListAdminApplicationsQueryKey, useListAdminEvents, getListAdminEventsQueryKey,
  useListEventRegistrations, getListEventRegistrationsQueryKey, useListContactMessages,
  getListContactMessagesQueryKey, useGetAdminSettings, getGetAdminSettingsQueryKey,
  useUpdateMyProfile, useSubmitProgramApplication, useRegisterForEvent,
  useMarkMyNotificationRead, useSendContactMessage, useUpdateUserStatus,
  useCreateOpportunity, useUpdateOpportunity, useDeleteOpportunity, useCreateProgram,
  useUpdateProgram, useDeleteProgram, useUpdateApplication, useCreateEvent, useUpdateEvent,
  useDeleteEvent, usePublishNotification, useUpdateContactMessage, useUpdateAdminSettings,
} from '@workspace/api-client-react';
import type {
  Opportunity, Program, Event as B4PEvent, UserProfile, OrganizationSettings,
  AdminUser, AdminApplication, ContactMessage, ProgramApplication, OpportunityCategory,
  ApplicationStatus,
} from '@workspace/api-client-react';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: '#1d6252', colorForeground: '#163d35', colorMutedForeground: '#687e75', colorDanger: '#bd5549', colorBackground: '#fffdf7', colorInput: '#fbf8ef', colorInputForeground: '#163d35', colorNeutral: '#ded9cb', fontFamily: 'DM Sans', borderRadius: '0.8rem' },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fffdf7] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#163d35] font-bold', headerSubtitle: 'text-[#687e75]', socialButtonsBlockButtonText: 'text-[#163d35]',
    formFieldLabel: 'text-[#163d35] font-semibold', footerActionLink: 'text-[#1d6252] font-semibold',
    footerActionText: 'text-[#687e75]', dividerText: 'text-[#687e75]', identityPreviewEditButton: 'text-[#1d6252]',
    formFieldSuccessText: 'text-[#1d6252]', alertText: 'text-[#163d35]', logoBox: 'rounded-xl',
    logoImage: 'object-contain', socialButtonsBlockButton: 'rounded-xl border-[#ded9cb]',
    formButtonPrimary: 'rounded-xl bg-[#1d6252] hover:bg-[#174c40]', formFieldInput: 'rounded-xl border-[#ded9cb] bg-[#fbf8ef]',
    footerAction: 'text-[#687e75]', dividerLine: 'bg-[#ded9cb]', alert: 'rounded-xl', otpCodeFieldInput: 'rounded-lg',
    formFieldRow: 'gap-2', main: 'text-[#163d35]',
  },
};

const appNav = [
  { href: '/dashboard', label: 'Home base', icon: LayoutDashboard },
  { href: '/applications', label: 'My applications', icon: FileText },
  { href: '/opportunities', label: 'Opportunities', icon: Compass },
  { href: '/programs', label: 'Programs', icon: BookOpen },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/notifications', label: 'Updates', icon: Bell },
];
const adminNav = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Young people', icon: Users },
  { href: '/admin/opportunities', label: 'Opportunities', icon: BriefcaseBusiness },
  { href: '/admin/programs', label: 'Programs', icon: BookOpen },
  { href: '/admin/applications', label: 'Applications', icon: FileText },
  { href: '/admin/events', label: 'Events', icon: CalendarDays },
  { href: '/admin/registrations', label: 'Registrations', icon: CheckCircle2 },
  { href: '/admin/notifications', label: 'Announcements', icon: Megaphone },
  { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];
const fmtDate = (d?: string | null) => d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date to be announced';
const shortDate = (d?: string | null) => d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : 'Coming soon';
const txt = (v: unknown) => typeof v === 'string' ? v : '';
const errorStatus = (error: any) => error?.status ?? error?.response?.status ?? error?.cause?.status;

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== id) qc.clear();
    prevUserIdRef.current = id;
  }), [addListener, qc]);
  return null;
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'line' | 'plain'; 'data-testid'?: string }) {
  const styles = { primary: 'bg-primary text-primary-foreground hover:bg-[#174c40]', soft: 'bg-[#e7eee8] text-primary hover:bg-[#dbe8de]', line: 'border border-border bg-card text-foreground hover:bg-muted', plain: 'text-muted-foreground hover:text-foreground hover:bg-muted' };
  return <button data-testid={props['data-testid'] ?? `button-${String(children).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none ${styles[variant]} ${className}`}>{children}</button>;
}
function Loading({ label = 'Gathering things for you…' }: { label?: string }) {
  return <div className="rounded-2xl border border-border bg-card p-8 text-center" role="status"><div className="mx-auto mb-3 h-8 w-8 animate-pulse rounded-full bg-[#dfe9df]" /><p className="text-sm text-muted-foreground">{label}</p></div>;
}
function ErrorState({ retry, message = 'We could not load this just now.' }: { retry?: () => void; message?: string }) {
  return <div className="rounded-2xl border border-[#e7c9be] bg-[#fff8f1] p-7 text-center"><CircleHelp className="mx-auto mb-3 text-accent" size={24} /><p className="font-semibold">{message}</p><p className="mt-1 text-sm text-muted-foreground">Your place is still here. Give it another try.</p>{retry && <Button variant="line" className="mt-4" onClick={retry}><RefreshCw size={15} /> Try again</Button>}</div>;
}
function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#c9d5ca] bg-[#f2f5ef] px-7 py-12 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary"><Sparkles size={20} /></div><h3 className="font-display text-xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{text}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
function SectionHead({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{eyebrow && <div className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#a6604c]">{eyebrow}</div>}<h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-[2.6rem]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action}</div>;
}
function Notice({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-[#ebd4b0] bg-[#fff7e9] px-4 py-3 text-sm text-[#76532b]">{children}</div>; }
function Pill({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'gold' | 'coral' | 'gray' }) {
  const map = { green: 'bg-[#e3eee6] text-[#245c4c]', gold: 'bg-[#fbefd7] text-[#805b21]', coral: 'bg-[#f7e6df] text-[#954b3d]', gray: 'bg-[#ecece4] text-[#626c64]' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${map[tone]}`}>{children}</span>;
}
function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" data-testid="link-brand" className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${light ? 'bg-secondary text-[#1b3b33]' : 'bg-primary text-[#fffaf0]'}`}><span className="font-display text-lg font-extrabold">B4</span></span><span className={`leading-tight ${light ? 'text-[#f7f4e8]' : 'text-[#173d34]'}`}><strong className="block font-display text-[17px] font-extrabold tracking-tight">B4P Youth</strong><small className={`text-[10px] font-medium tracking-wide ${light ? 'text-[#cad8ce]' : 'text-muted-foreground'}`}>A place to find your next step</small></span></Link>;
}

function AppShell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [path] = useLocation();
  const nav = admin ? adminNav : appNav;
  const { signOut } = useClerk();
  const { user } = useUser();
  return <div className="min-h-[100dvh] bg-background">
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#174c40] px-5 py-6 text-[#f6f3e8] transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between"><Brand light /><button aria-label="Close menu" data-testid="button-close-menu" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[#d6e2d8] lg:hidden"><X size={20} /></button></div>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.07] p-4"><div className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#c5d4c9]">{admin ? 'Foundation desk' : 'Your community'}</div><p className="text-sm font-semibold">{admin ? 'Build opportunities' : 'Make your next move'}</p><p className="mt-1 text-xs leading-5 text-[#c7d5ca]">{admin ? 'Keep real routes visible and moving.' : 'Find learning, work and ways to take part.'}</p></div>
      <nav aria-label="Main navigation" className="mt-7 flex-1 space-y-1">{nav.map(({ href, label, icon: Icon }) => {
        const active = href === '/admin' ? path === href : path === href || (href !== '/dashboard' && path.startsWith(`${href}/`));
        return <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${active ? 'bg-[#e7b65c] text-[#183f35]' : 'text-[#dce6dc] hover:bg-white/10'}`}><Icon size={17} strokeWidth={1.9} />{label}{active && <ChevronRight className="ml-auto" size={15} />}</Link>;
      })}</nav>
      <div className="border-t border-white/10 pt-4">
        {!admin && <Link href="/profile" data-testid="link-profile" className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${path === '/profile' ? 'bg-white/10' : 'text-[#dce6dc] hover:bg-white/10'}`}><UserRound size={17} />Your profile</Link>}
        {admin && <Link href="/about" data-testid="link-about-admin" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#dce6dc] hover:bg-white/10"><Globe2 size={17} />Public site</Link>}
        <button data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#dce6dc] hover:bg-white/10"><LogOut size={17} />Sign out</button>
      </div>
      <p className="mt-4 px-3 text-[10px] leading-4 text-[#b8c9bd]">Business for Peace Community Development Foundation</p>
    </aside>
    {open && <button aria-label="Close navigation" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-[#112e28]/45 lg:hidden" />}
    <div className="lg:pl-[272px]">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-[#f8f6ef]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3"><button onClick={() => setOpen(true)} aria-label="Open menu" data-testid="button-open-menu" className="rounded-xl border border-border bg-card p-2 lg:hidden"><Menu size={19} /></button><span className="hidden text-xs font-semibold text-muted-foreground sm:inline">{admin ? 'Administration' : 'Youth portal'}</span><ChevronRight size={14} className="hidden text-[#a9afa6] sm:inline" /><span className="max-w-[160px] truncate text-sm font-bold sm:max-w-none">{user?.firstName ? `Hello, ${user.firstName}` : admin ? 'Community management' : 'Your next chapter'}</span></div>
          <div className="flex items-center gap-2"><Link href="/notifications" aria-label="Notifications" data-testid="link-notifications-top" className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted"><Bell size={18} /></Link><Link href="/profile" data-testid="link-account" className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e5ede5] text-xs font-bold text-primary">{user?.firstName?.[0] ?? 'Y'}</span><span className="hidden max-w-[110px] truncate text-xs font-semibold sm:block">{user?.firstName ?? 'My account'}</span><ChevronDown size={14} className="text-muted-foreground" /></Link></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 pb-14 pt-8 sm:px-8 lg:px-10">{children}</main>
      <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-5 text-xs text-muted-foreground sm:px-8 lg:px-10"><span>B4P Youth · For the next generation in Liberia</span><div className="flex gap-4"><Link href="/about" className="hover:text-primary">About</Link><Link href="/contact" className="hover:text-primary">Get in touch</Link></div></footer>
    </div>
  </div>;
}

function PublicShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const { isSignedIn } = useUser();
  return <div className="min-h-[100dvh] overflow-hidden bg-[#f8f6ef]">
    <header className="relative z-20 mx-auto flex max-w-[1320px] items-center justify-between px-5 py-5 sm:px-8">
      <Brand />
      <nav className="hidden items-center gap-8 text-sm font-semibold text-[#3d5f53] md:flex"><Link href="/opportunities" className="hover:text-primary">Opportunities</Link><Link href="/programs" className="hover:text-primary">Programs</Link><Link href="/events" className="hover:text-primary">Events</Link><Link href="/about" className="hover:text-primary">Our work</Link></nav>
      <div className="hidden items-center gap-3 md:flex">{isSignedIn ? <Link href="/dashboard" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Go to my home base <ArrowRight size={15} className="ml-1 inline" /></Link> : <><Link href="/sign-in" className="px-3 py-2 text-sm font-bold text-primary">Sign in</Link><Link href="/sign-up" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Create account</Link></>}</div>
      <button className="rounded-xl border border-border p-2 md:hidden" aria-label="Open navigation" data-testid="button-public-menu" onClick={() => setMenu(!menu)}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
    </header>
    {menu && <nav className="relative z-20 mx-4 -mt-1 space-y-1 rounded-2xl border border-border bg-card p-4 shadow-lg md:hidden"><Link onClick={() => setMenu(false)} href="/opportunities" className="block rounded-lg p-3">Opportunities</Link><Link onClick={() => setMenu(false)} href="/programs" className="block rounded-lg p-3">Programs</Link><Link onClick={() => setMenu(false)} href="/events" className="block rounded-lg p-3">Events</Link><Link onClick={() => setMenu(false)} href="/about" className="block rounded-lg p-3">Our work</Link><div className="flex gap-2 border-t border-border pt-3"><Link onClick={() => setMenu(false)} href={isSignedIn ? '/dashboard' : '/sign-in'} className="flex-1 rounded-xl bg-primary p-3 text-center text-sm font-bold text-primary-foreground">{isSignedIn ? 'My home base' : 'Sign in'}</Link><Link onClick={() => setMenu(false)} href="/sign-up" className="flex-1 rounded-xl bg-[#e7eee8] p-3 text-center text-sm font-bold text-primary">Join B4P Youth</Link></div></nav>}
    {children}
    <footer className="border-t border-[#e4dfd2] bg-[#f8f6ef]"><div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div><Brand /><p className="mt-3 max-w-sm text-xs leading-5 text-muted-foreground">A community home base from Business for Peace Community Development Foundation.</p></div><div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#466457]"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/opportunities">Opportunities</Link><Link href="/programs">Programs</Link><Link href="/events">Events</Link></div></div></footer>
  </div>;
}

function PublicHome() {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60_000 } });
  const opp = useListOpportunities(undefined, { query: { queryKey: getListOpportunitiesQueryKey() } });
  const programs = useListPrograms(undefined, { query: { queryKey: getListProgramsQueryKey() } });
  const events = useListEvents(undefined, { query: { queryKey: getListEventsQueryKey() } });
  return <PublicShell><main className="page-enter">
    <section className="relative mx-auto grid max-w-[1320px] items-center gap-8 px-5 pb-16 pt-10 sm:px-8 md:grid-cols-[1.04fr_.96fr] md:pb-24 md:pt-16">
      <div className="relative z-10"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d6dfd4] bg-[#eff4ec] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-primary"><span className="h-2 w-2 rounded-full bg-[#d99c43]" />A home base for what comes next</div>
        <h1 className="font-display max-w-[700px] text-[3.25rem] font-extrabold leading-[.99] tracking-[-.055em] text-[#153d33] sm:text-[4.4rem] lg:text-[5.4rem]">Your next step<br />starts <span className="relative inline-block text-[#b65f4b]">right here.<svg aria-hidden="true" className="absolute -bottom-1 left-0 w-full" viewBox="0 0 240 14" fill="none"><path d="M4 9C57 2 166 1 235 8" stroke="#e2b158" strokeWidth="5" strokeLinecap="round" /></svg></span></h1>
        <p className="mt-6 max-w-[540px] text-base leading-7 text-[#536d60] sm:text-lg">Real opportunities, practical programs and community events for young people and women in Liberia. Find something that fits. Take the next step with confidence.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/opportunities" data-testid="link-explore-opportunities" className="inline-flex items-center justify-center gap-3 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5">Explore opportunities <ArrowUpRight size={17} /></Link><Link href="/sign-up" data-testid="link-create-account" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cbd6ca] bg-card px-5 py-3.5 text-sm font-bold text-primary hover:bg-[#eef3ec]">Create your free account <ArrowRight size={16} /></Link></div>
        <div className="mt-8 flex items-center gap-4 text-xs text-[#61766b]"><ShieldCheck size={17} className="text-primary" /><span>Trusted by B4P Foundation · Made for real local pathways</span></div>
      </div>
      <div className="relative mx-auto w-full max-w-[550px]">
        <div className="absolute -right-3 -top-5 h-40 w-40 rounded-full bg-[#e5bd70]/30 blur-2xl" /><div className="absolute -bottom-5 -left-3 h-36 w-36 rounded-full bg-[#b7d0bc]/50 blur-2xl" />
        <div className="relative overflow-hidden rounded-[2rem] border border-[#d9d8c7] bg-[#e7ecde] p-4 shadow-[0_20px_70px_-42px_rgba(22,61,50,.45)]">
          <div className="relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[1.5rem] bg-[#dfe9d8] p-5 sm:min-h-[440px] sm:p-7">
            <div className="absolute inset-0 opacity-70" aria-hidden="true"><div className="absolute -right-12 -top-8 h-[340px] w-[340px] rounded-full border-[1px] border-[#94ad99]/50" /><div className="absolute -right-2 top-0 h-[280px] w-[280px] rounded-full border border-[#94ad99]/45" /><div className="absolute right-8 top-8 h-[220px] w-[220px] rounded-full border border-[#94ad99]/40" /></div>
            <div className="relative flex justify-between"><div className="rounded-full bg-[#f8f6ef]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-primary">Opportunity board</div><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f8f6ef] text-primary"><Compass size={19} /></span></div>
            <div className="relative space-y-3">
              <div className="rotate-[-2deg] rounded-2xl border border-[#e2dfd1] bg-[#fffdf7] p-4 shadow-md sm:p-5"><div className="flex items-start justify-between"><span className="rounded-full bg-[#f7e7d8] px-2.5 py-1 text-[10px] font-bold text-[#94513f]">TRAINING</span><ArrowUpRight size={16} className="text-primary" /></div><p className="mt-3 font-display text-lg font-bold text-[#173f35]">Build skills that travel</p><p className="mt-1 text-xs text-muted-foreground">Practical learning · Monrovia</p></div>
              <div className="ml-8 rotate-[2deg] rounded-2xl border border-[#e2dfd1] bg-[#f8f0df] p-4 shadow-md sm:p-5"><div className="flex items-center justify-between"><span className="rounded-full bg-[#e5ecd9] px-2.5 py-1 text-[10px] font-bold text-primary">YOUR NEXT STEP</span><span className="text-xs font-semibold text-[#8a6b35]">Start here</span></div><p className="mt-3 font-display text-lg font-bold text-[#173f35]">One good lead can change things.</p></div>
            </div>
            <div className="relative flex items-center gap-2 text-xs font-semibold text-[#536d60]"><HeartHandshake size={16} />Built around young people, not paperwork.</div>
          </div>
        </div>
        <div className="absolute -bottom-4 -left-5 hidden items-center gap-3 rounded-2xl border border-[#e6dfcf] bg-card px-4 py-3 shadow-lg sm:flex"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#faefd9] text-[#a66d29]"><Sparkles size={17} /></span><div><p className="text-xs font-bold text-[#244a3d]">New routes, in one place</p><p className="text-[10px] text-muted-foreground">Fresh leads from the community</p></div></div>
      </div>
    </section>
    <section className="border-y border-[#dedfd2] bg-[#eeefe5]"><div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-0 px-5 sm:grid-cols-3 sm:px-8">{[{num:'01',title:'Find the right fit',copy:'Browse work, training and scholarships with local details.'},{num:'02',title:'Take a clear next step',copy:'Apply, register or follow the link. No guesswork.'},{num:'03',title:'Keep track',copy:'Your profile and updates stay together in one trusted place.'}].map((item)=><div key={item.num} className="flex gap-4 border-b border-[#d8dbce] py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-6 sm:py-7 sm:first:pl-0 sm:last:border-0"><span className="font-display text-2xl font-extrabold text-[#bd7958]">{item.num}</span><div><h3 className="font-display text-base font-bold">{item.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.copy}</p></div></div>)}</div></section>
    <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
      <div className="mb-8 flex items-end justify-between gap-3"><div><div className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#a6604c]">Open doors</div><h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">A good place to begin.</h2><p className="mt-2 text-sm text-muted-foreground">Real leads and programs from the B4P community.</p></div><Link href="/opportunities" className="hidden items-center gap-2 text-sm font-bold text-primary sm:flex">See all opportunities <ArrowRight size={15} /></Link></div>
      {opp.isLoading ? <div className="grid gap-4 md:grid-cols-3"><Loading /><Loading /><Loading /></div> : opp.isError ? <ErrorState retry={() => opp.refetch()} /> : !opp.data?.length ? <Empty title="New opportunities are on their way" text="Check back soon, or create an account so you can keep an eye on new openings." action={<Link href="/sign-up" className="text-sm font-bold text-primary">Join the community <ArrowRight size={15} className="inline" /></Link>} /> : <div className="grid gap-4 md:grid-cols-3">{opp.data.slice(0, 3).map((o)=><OpportunityCard key={o.id} item={o} />)}</div>}
    </section>
    <section className="bg-[#173f35] text-[#f6f2e7]"><div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[.75fr_1.25fr] md:items-center md:py-20"><div><div className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#e5b762]">Room to grow</div><h2 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">Programs that turn<br />curiosity into capability.</h2><p className="mt-4 max-w-md text-sm leading-6 text-[#cfdbd0]">Focused support, practical skills and opportunities to shape the future of your community.</p><Link href="/programs" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#e8b65d] px-4 py-3 text-sm font-bold text-[#173f35]">Explore programs <ArrowRight size={16} /></Link></div>
      {programs.isLoading ? <Loading /> : programs.isError ? <ErrorState retry={() => programs.refetch()} /> : <div className="grid gap-3 sm:grid-cols-2">{(programs.data ?? []).slice(0, 2).map((p,i)=><Link key={p.id} href={`/programs/${p.id}`} className={`group rounded-2xl border border-white/15 p-5 transition-colors hover:bg-white/10 ${i===0?'bg-[#285c4d]':'bg-[#234e42]'}`}><div className="mb-8 flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4b65e] text-[#173f35]"><GraduationCap size={20} /></span><ArrowUpRight className="text-[#d8e2d8]" size={18} /></div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#e4bd77]">Program</p><h3 className="mt-2 font-display text-xl font-bold">{p.name}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#d1ddd1]">{p.description}</p></Link>)}</div>}
    </div></section>
    <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20"><div className="grid gap-8 md:grid-cols-[.9fr_1.1fr] md:items-center"><div className="rounded-[2rem] bg-[#e7eade] p-7 sm:p-10"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-[#a55e49]"><CalendarDays size={22} /></div><p className="mt-7 text-[11px] font-bold uppercase tracking-[.16em] text-[#a6604c]">Come be part of it</p><h2 className="mt-2 font-display text-3xl font-extrabold">Community happens in person.</h2><p className="mt-3 text-sm leading-6 text-[#5e7165]">Meet people, share ideas and make a difference at events happening near you.</p><Link href="/events" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">Find an event <ArrowRight size={15} /></Link></div><div>{events.isLoading ? <Loading /> : events.isError ? <ErrorState retry={() => events.refetch()} /> : events.data?.length ? <div className="divide-y divide-[#e3dfd2]">{events.data.slice(0,3).map((e)=><Link href={`/events/${e.id}`} key={e.id} className="flex items-center gap-4 py-4"><div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#e7eee8] text-primary"><span className="text-[9px] font-bold uppercase">{new Date(e.date).toLocaleDateString('en',{month:'short'})}</span><b className="font-display text-xl">{new Date(e.date).getDate()}</b></div><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{e.title}</h3><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} />{e.location}</p></div><ArrowRight size={16} className="text-muted-foreground" /></Link>)}</div> : <Empty title="No events on the calendar yet" text="Keep an eye out for the next gathering." />}</div></div></section>
    <section className="mx-5 mb-16 overflow-hidden rounded-[2rem] bg-[#e8b65d] sm:mx-8 md:mb-20"><div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 px-6 py-9 sm:px-10 md:flex-row md:items-center md:py-12"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#67502a]">Your future is worth showing up for</p><h2 className="mt-2 max-w-xl font-display text-3xl font-extrabold leading-tight text-[#193e34] sm:text-4xl">Make this the place you check first.</h2></div><Link href="/sign-up" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#173f35] px-5 py-3.5 text-sm font-bold text-[#fbf6e8]">Join B4P Youth <ArrowRight size={16} /></Link></div></section>
  </main></PublicShell>;
}

function OpportunityCard({ item }: { item: Opportunity }) {
  return <Link href={`/opportunities/${item.id}`} data-testid={`card-opportunity-${item.id}`} className="group flex min-h-[224px] flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-[#aac0ad] hover:shadow-[0_14px_35px_-26px_rgba(23,63,53,.45)]"><div className="flex items-start justify-between gap-3"><Pill tone={item.category==='Scholarships'?'gold':item.category==='Jobs'?'green':'coral'}>{item.category}</Pill><ArrowUpRight size={17} className="text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></div><h3 className="mt-4 font-display text-xl font-bold leading-snug">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.organization}</p><p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p><div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4"><span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={13} />{item.location}</span><span className="text-xs font-semibold text-[#9a593f]">{item.deadline ? `Apply by ${shortDate(item.deadline)}` : 'Open now'}</span></div></Link>;
}
function ProgramCard({ item }: { item: Program }) {
  return <Link href={`/programs/${item.id}`} data-testid={`card-program-${item.id}`} className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg">{item.coverImage ? <img src={item.coverImage} alt="" className="h-40 w-full object-cover" /> : <div className="relative flex h-40 items-center justify-center overflow-hidden bg-[#e3eadf]"><div className="absolute -right-4 -top-16 h-48 w-48 rounded-full border border-[#b6c9b7]" /><div className="absolute -right-1 -top-8 h-36 w-36 rounded-full border border-[#b6c9b7]" /><GraduationCap className="relative text-primary" size={35} /></div>}<div className="p-5"><div className="flex items-center justify-between"><Pill>Program</Pill><span className="text-xs text-muted-foreground">{item.applicationDeadline ? `Closes ${shortDate(item.applicationDeadline)}` : 'Applications open'}</span></div><h3 className="mt-4 font-display text-xl font-bold">{item.name}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p><div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin size={13} />{item.location}</span><span className="font-bold text-primary">See details <ArrowRight size={13} className="ml-1 inline" /></span></div></div></Link>;
}
function EventCard({ item }: { item: B4PEvent }) {
  return <Link href={`/events/${item.id}`} data-testid={`card-event-${item.id}`} className="group flex overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg"><div className="flex w-[92px] shrink-0 flex-col items-center justify-center bg-[#e7eee8] p-3 text-primary"><span className="text-[10px] font-bold uppercase tracking-wider">{new Date(item.date).toLocaleDateString('en',{month:'short'})}</span><b className="font-display text-3xl">{new Date(item.date).getDate()}</b><span className="text-[10px] font-semibold">{new Date(item.date).getFullYear()}</span></div><div className="min-w-0 flex-1 p-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a6604c]"><CalendarDays size={12} />Community event</div><h3 className="mt-2 font-display text-lg font-bold leading-snug">{item.title}</h3><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} />{item.location}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p></div><div className="hidden items-center px-4 text-muted-foreground sm:flex"><ArrowRight size={17} /></div></Link>;
}

function ListPage({ type }: { type: 'opportunities' | 'programs' | 'events' }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const key = type;
  const oppParams = { search: search || undefined, category: category ? category as OpportunityCategory : undefined };
  const programParams = { search: search || undefined };
  const eventParams = { search: search || undefined };
  const opp = useListOpportunities(oppParams, { query: { enabled: key === 'opportunities', queryKey: getListOpportunitiesQueryKey(oppParams) } });
  const programs = useListPrograms(programParams, { query: { enabled: key === 'programs', queryKey: getListProgramsQueryKey(programParams) } });
  const events = useListEvents(eventParams, { query: { enabled: key === 'events', queryKey: getListEventsQueryKey(eventParams) } });
  const query = key === 'opportunities' ? opp : key === 'programs' ? programs : events;
  const data = query.data as any[] | undefined;
  const title = key === 'opportunities' ? 'Opportunities' : key === 'programs' ? 'Programs' : 'Events';
  const description = key === 'opportunities' ? 'Open doors for learning, work and getting involved.' : key === 'programs' ? 'Programs designed to help you build skills and move forward.' : 'Gatherings, workshops and moments to shape things together.';
  return <AppShell><div className="page-enter"><SectionHead eyebrow="Find your next step" title={title} description={description} />
    <div className="mb-6 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input data-testid={`input-search-${key}`} value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${key}…`} className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>{key==='opportunities' && <label className="relative flex items-center gap-2 rounded-xl border border-border bg-card px-4"><Filter size={15} className="text-muted-foreground" /><select data-testid="select-category" value={category} onChange={e=>setCategory(e.target.value)} className="h-12 bg-transparent pr-2 text-sm outline-none"><option value="">All categories</option>{['Jobs','Internships','Scholarships','Fellowships','Trainings','Grants','Volunteer'].map(v=><option key={v}>{v}</option>)}</select></label>}</div>
    {query.isLoading ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !data?.length ? <Empty title={search ? 'No matches yet' : `Nothing listed in ${key} right now`} text={search ? 'Try a different word or clear the search.' : 'New opportunities are added as they become available. Come back soon.'} /> : key==='opportunities' ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(data as Opportunity[]).map(item=><OpportunityCard key={item.id} item={item} />)}</div> : key==='programs' ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{(data as Program[]).map(item=><ProgramCard key={item.id} item={item} />)}</div> : <div className="grid gap-4 xl:grid-cols-2">{(data as B4PEvent[]).map(item=><EventCard key={item.id} item={item} />)}</div>}
  </div></AppShell>;
}

function AuthRequired({ children, profileSetup = true }: { children: ReactNode; profileSetup?: boolean }) {
  const { isLoaded, isSignedIn } = useUser();
  const profile = useGetMyProfile({ query: { enabled: !!isSignedIn && profileSetup, queryKey: getGetMyProfileQueryKey() } });
  if (!isLoaded) return <div className="grid min-h-[60vh] place-items-center"><Loading label="Opening your home base…" /></div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (profileSetup && profile.isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loading label="Checking your profile…" /></div>;
  if (profileSetup && profile.isError && errorStatus(profile.error) === 404) return <Redirect to="/profile" />;
  return <>{children}</>;
}
function HomeRedirect() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <PublicHome />;
  return isSignedIn ? <Redirect to="/dashboard" /> : <PublicHome />;
}
function ProfileForm({ existing, onDone }: { existing?: UserProfile; onDone?: () => void }) {
  const update = useUpdateMyProfile();
  const qc = useQueryClient();
  const [values,setValues] = useState({ fullName: existing?.fullName ?? '', phone: existing?.phone ?? '', gender: existing?.gender ?? '', country: existing?.country ?? 'Liberia', county: existing?.county ?? '', city: existing?.city ?? '', dateOfBirth: existing?.dateOfBirth ?? '', educationLevel: existing?.educationLevel ?? '', interests: existing?.interests?.join(', ') ?? '' });
  const set = (key: keyof typeof values, value: string) => setValues(v=>({...v,[key]:value}));
  const save = (e: FormEvent) => { e.preventDefault(); update.mutate({ data: { ...values, interests: values.interests.split(',').map(s=>s.trim()).filter(Boolean) } }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }); await qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); onDone?.(); } }); };
  return <form onSubmit={save} className="rounded-2xl border border-border bg-card p-5 sm:p-7"><div className="mb-5"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a6604c]">{existing ? 'Keep it current' : 'One quick setup'}</p><h2 className="mt-1 font-display text-2xl font-extrabold">Tell us a little about you.</h2><p className="mt-1 text-sm text-muted-foreground">Your details help us surface opportunities that make sense for you.</p></div>{update.isError && <Notice>We could not save your profile. Please check your details and try again.</Notice>}<div className="grid gap-4 sm:grid-cols-2">{[['fullName','Full name','text'],['phone','Phone number','tel'],['gender','Gender','text'],['country','Country','text'],['county','County','text'],['city','City or town','text'],['dateOfBirth','Date of birth','date'],['educationLevel','Education level','text']].map(([key,label,type])=><label key={key} className="space-y-1.5 text-xs font-semibold text-[#426154]">{label}<input data-testid={`input-profile-${key}`} type={type} required={['fullName','phone','country'].includes(key)} value={values[key as keyof typeof values]} onChange={e=>set(key as keyof typeof values,e.target.value)} className="h-11 w-full rounded-xl border border-border bg-[#fbf9f2] px-3 text-sm font-normal text-foreground outline-none focus:border-primary" /></label>)}</div><label className="mt-4 block space-y-1.5 text-xs font-semibold text-[#426154]">Interests <span className="font-normal text-muted-foreground">(separate with commas)</span><input data-testid="input-profile-interests" value={values.interests} onChange={e=>set('interests',e.target.value)} placeholder="Business, technology, community work" className="h-11 w-full rounded-xl border border-border bg-[#fbf9f2] px-3 text-sm font-normal text-foreground outline-none focus:border-primary" /></label><div className="mt-6 flex justify-end"><Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : existing ? 'Save changes' : 'Save and continue'} <ArrowRight size={16} /></Button></div></form>;
}
function DashboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const profile = useGetMyProfile({ query: { enabled: !!isSignedIn, queryKey: getGetMyProfileQueryKey() } });
  const dashboard = useGetDashboard({ query: { enabled: !!isSignedIn, queryKey: getGetDashboardQueryKey() } });
  const applications = useListMyApplications({ query: { enabled: !!isSignedIn, queryKey: getListMyApplicationsQueryKey() } });
  if (!isLoaded) return <AppShell><Loading /></AppShell>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (profile.isLoading || dashboard.isLoading) return <AppShell><Loading /></AppShell>;
  if (errorStatus(profile.error) === 404 || errorStatus(dashboard.error) === 404) return <AppShell><div className="mx-auto max-w-3xl"><ProfileForm onDone={()=>{ profile.refetch(); dashboard.refetch(); }} /></div></AppShell>;
  if (profile.isError || dashboard.isError) return <AppShell><ErrorState retry={()=>{profile.refetch();dashboard.refetch();}} /></AppShell>;
  const d = dashboard.data;
  if (!d) return <AppShell><Loading /></AppShell>;
  return <AppShell><div className="page-enter">
    <div className="relative mb-7 overflow-hidden rounded-[1.75rem] bg-[#174c40] p-6 text-[#f7f3e7] sm:p-9"><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" /><div className="absolute -right-8 -top-12 h-52 w-52 rounded-full border border-white/10" /><div className="relative"><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#edc36d]"><Sparkles size={13} />Welcome to your home base</div><h1 className="font-display text-3xl font-extrabold sm:text-4xl">Good to have you here, {d.profile.fullName.split(' ')[0]}.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#d0ddd1]">A new opportunity might be just the nudge you need. Here’s what’s happening around you.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/opportunities" className="inline-flex items-center gap-2 rounded-xl bg-[#e8b65d] px-4 py-3 text-sm font-bold text-[#173f35]">Explore opportunities <ArrowRight size={16} /></Link><Link href="/profile" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-[#f7f3e7] hover:bg-white/10">Update my profile</Link></div></div></div>
    <div className="mb-9 grid gap-4 md:grid-cols-[1fr_1fr_1fr]"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Profile progress</span><span className="font-display text-xl font-extrabold text-primary">{d.profileCompletion.percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e9e8de]"><div className="h-full rounded-full bg-[#d9a446]" style={{width:`${d.profileCompletion.percent}%`}} /></div><Link href="/profile" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Add the missing details <ArrowRight size={13} /></Link></div><div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f6edda] text-[#9d6a29]"><FileText size={20} /></span><div><b className="font-display text-2xl">{applications.data?.length ?? d.applications.length}</b><p className="text-xs text-muted-foreground">Applications in progress</p></div><Link href="/programs" aria-label="Explore programs" className="ml-auto rounded-lg p-2 text-primary hover:bg-muted"><ArrowUpRight size={16} /></Link></div><div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7eee8] text-primary"><Compass size={20} /></span><div><b className="font-display text-2xl">{d.featuredOpportunities.length}</b><p className="text-xs text-muted-foreground">Fresh opportunities to explore</p></div><Link href="/opportunities" aria-label="See opportunities" className="ml-auto rounded-lg p-2 text-primary hover:bg-muted"><ArrowUpRight size={16} /></Link></div></div>
    <div className="mb-9 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a6604c]">Picked for you</p><h2 className="mt-1 font-display text-2xl font-extrabold">Worth a closer look</h2></div><Link href="/opportunities" className="text-xs font-bold text-primary">All opportunities <ArrowRight size={14} className="ml-1 inline" /></Link></div>
    {!d.featuredOpportunities.length ? <Empty title="We’re looking for the next good lead" text="New opportunities will appear here when they are shared with the community." /> : <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.featuredOpportunities.slice(0,3).map(o=><OpportunityCard key={o.id} item={o} />)}</div>}
    <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]"><section><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a6604c]">Grow with support</p><h2 className="mt-1 font-display text-2xl font-extrabold">Programs to explore</h2></div><Link href="/programs" className="text-xs font-bold text-primary">View all <ArrowRight size={13} className="ml-1 inline" /></Link></div>{d.featuredPrograms.length ? <div className="space-y-3">{d.featuredPrograms.slice(0,3).map(p=><Link key={p.id} href={`/programs/${p.id}`} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:border-[#aac0ad]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7eee8] text-primary"><GraduationCap size={20} /></span><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{p.name}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{p.location} · {p.applicationDeadline ? `Apply by ${shortDate(p.applicationDeadline)}` : 'Applications open'}</p></div><ArrowRight size={16} className="text-muted-foreground" /></Link>)}</div> : <Empty title="Programs coming soon" text="There will be new ways to learn and grow here." />}</section>
      <section><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a6604c]">Keep up</p><h2 className="mt-1 font-display text-2xl font-extrabold">Around the community</h2></div>{d.upcomingEvents.length ? <div className="space-y-3">{d.upcomingEvents.slice(0,3).map(e=><EventCard key={e.id} item={e} />)}</div> : <Empty title="No upcoming events" text="When something is planned, you’ll find it here." />}</section></div>
  </div></AppShell>;
}

function DetailPage({ type }: { type: 'opportunities' | 'programs' | 'events' }) {
  const [path] = useLocation();
  const { isSignedIn } = useUser();
  const id = Number(path.split('/').filter(Boolean).at(-1));
  const opp = useGetOpportunity(id, { query: { enabled: Number.isFinite(id) && id > 0, queryKey: getGetOpportunityQueryKey(id) } });
  const program = useGetProgram(id, { query: { enabled: Number.isFinite(id) && id > 0, queryKey: getGetProgramQueryKey(id) } });
  const event = useGetEvent(id, { query: { enabled: Number.isFinite(id) && id > 0, queryKey: getGetEventQueryKey(id) } });
  const qc=useQueryClient(); const submit=useSubmitProgramApplication(); const register=useRegisterForEvent();
  const [motivation,setMotivation]=useState('');
  const profile=useGetMyProfile({query:{enabled:!!isSignedIn && type !== 'opportunities',queryKey:getGetMyProfileQueryKey()}});
  const item = type==='opportunities' ? opp.data : type==='programs' ? program.data : event.data;
  const query=type==='opportunities'?opp:type==='programs'?program:event;
  if(query.isLoading) return <AppShell><Loading /></AppShell>;
  if(query.isError || !item) return <AppShell><ErrorState retry={()=>query.refetch()} message="This page isn’t available right now." /></AppShell>;
  if (isSignedIn && type !== 'opportunities' && profile.isLoading) return <AppShell><Loading label="Checking your profile…" /></AppShell>;
  if (isSignedIn && type !== 'opportunities' && profile.isError && errorStatus(profile.error) === 404) return <AppShell><div className="mx-auto max-w-3xl"><ProfileForm onDone={()=>profile.refetch()} /></div></AppShell>;
  const renderApply = () => {
    if (type==='opportunities') return (item as Opportunity).applicationUrl ? <a href={(item as Opportunity).applicationUrl!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Continue to application <ExternalLink size={15} /></a> : <Notice>Contact the organization for application details.</Notice>;
    if (type==='events') return <Button disabled={register.isPending} onClick={()=>register.mutate({id}, {onSuccess:()=>{qc.invalidateQueries({queryKey:getGetDashboardQueryKey()});}})}>{register.isPending?'Registering…':'Register for this event'} <ArrowRight size={15} /></Button>;
    return <form onSubmit={e=>{e.preventDefault();submit.mutate({id,data:{motivation}}, {onSuccess:()=>{setMotivation('');qc.invalidateQueries({queryKey:getListMyApplicationsQueryKey()});qc.invalidateQueries({queryKey:getGetDashboardQueryKey()});}});}} className="space-y-3"><label className="block text-xs font-bold">Why are you interested? <textarea required minLength={20} maxLength={5000} value={motivation} onChange={e=>setMotivation(e.target.value)} placeholder="Share what draws you to this program…" className="mt-2 min-h-32 w-full rounded-xl border border-border bg-[#fbf9f2] p-3 text-sm font-normal outline-none focus:border-primary" /></label>{submit.isError && <Notice>We could not submit your application. You may already have an application in progress.</Notice>}<Button type="submit" disabled={submit.isPending}>{submit.isPending?'Sending application…':'Apply to this program'} <ArrowRight size={15} /></Button></form>;
  };
  const authAction = (type==='programs'||type==='events') && !isSignedIn ? <Link href="/sign-in" className="text-sm font-bold text-primary">Sign in to {type==='events'?'register':'apply'} <ArrowRight size={14} className="ml-1 inline" /></Link> : renderApply();
  return <AppShell><div className="page-enter mx-auto max-w-4xl"><Link href={`/${type}`} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={15} />Back to {type}</Link><div className="rounded-[1.75rem] border border-border bg-card p-6 sm:p-9">{type==='opportunities' ? <><Pill>{(item as Opportunity).category}</Pill><h1 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">{(item as Opportunity).title}</h1><p className="mt-2 font-semibold text-[#587263]">{(item as Opportunity).organization}</p><div className="mt-5 flex flex-wrap gap-2"><Pill tone="gray"><MapPin size={12} className="mr-1" />{(item as Opportunity).location}</Pill><Pill tone="gold"><Clock3 size={12} className="mr-1" />Deadline: {fmtDate((item as Opportunity).deadline)}</Pill></div><div className="prose prose-sm mt-8 max-w-none text-[#425e52]"><h2>About this opportunity</h2><p className="whitespace-pre-wrap">{(item as Opportunity).description}</p><h2>What you’ll need</h2><p className="whitespace-pre-wrap">{(item as Opportunity).requirements || 'See the application details for requirements.'}</p></div></> : type==='programs' ? <><Pill>Program</Pill><h1 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">{(item as Program).name}</h1><p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground"><MapPin size={14} />{(item as Program).location}</p><div className="prose prose-sm mt-8 max-w-none text-[#425e52]"><h2>About the program</h2><p className="whitespace-pre-wrap">{(item as Program).description}</p><h2>What you’ll work toward</h2><p className="whitespace-pre-wrap">{(item as Program).objectives}</p><h2>Who can apply</h2><p className="whitespace-pre-wrap">{(item as Program).eligibility}</p></div><div className="mt-7 rounded-2xl bg-[#f1f3e9] p-5"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Make a move</p>{authAction}</div></> : <><Pill>Community event</Pill><h1 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">{(item as B4PEvent).title}</h1><div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><CalendarDays size={15} />{fmtDate((item as B4PEvent).date)}</span><span className="flex items-center gap-1.5"><Clock3 size={15} />{(item as B4PEvent).time}</span><span className="flex items-center gap-1.5"><MapPin size={15} />{(item as B4PEvent).location}</span></div><p className="mt-7 whitespace-pre-wrap text-sm leading-7 text-[#425e52]">{(item as B4PEvent).description}</p><div className="mt-7 rounded-2xl bg-[#f1f3e9] p-5"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Save your place</p>{authAction}{register.isSuccess&&<p className="mt-3 text-sm font-semibold text-primary">You’re registered. We’ll see you there.</p>}</div></>}</div></div></AppShell>;
}

function ProfilePage() {
  const q=useGetMyProfile({query:{queryKey:getGetMyProfileQueryKey()}});
  if(q.isLoading)return <AppShell><Loading /></AppShell>;
  if(q.isError&&errorStatus(q.error)===404)return <AppShell><div className="mx-auto max-w-3xl"><ProfileForm /></div></AppShell>;
  if(q.isError)return <AppShell><ErrorState retry={()=>q.refetch()} /></AppShell>;
  return <AppShell><div className="mx-auto max-w-3xl"><ProfileForm existing={q.data} /></div></AppShell>;
}
function ApplicationsPage() {
  const q = useListMyApplications({ query: { queryKey: getListMyApplicationsQueryKey() } });
  return <AppShell><div className="page-enter">
    <SectionHead eyebrow="Your next steps" title="My applications" description="Keep track of every program application and its latest status." />
    {q.isLoading ? <Loading /> : q.isError ? <ErrorState retry={() => q.refetch()} /> : !q.data?.length
      ? <Empty title="No applications yet" text="When you apply to a B4P program, its status will appear here." action={<Link href="/programs" className="text-sm font-bold text-primary">Explore programs <ArrowRight size={14} className="ml-1 inline" /></Link>} />
      : <div className="space-y-3">{q.data.map((application: ProgramApplication) => <article key={application.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><Link href={`/programs/${application.programId}`} className="font-display text-lg font-bold hover:text-primary">{application.programName}</Link><p className="mt-1 text-xs text-muted-foreground">Submitted {fmtDate(application.submittedAt)}</p></div>
        <Pill tone={application.status === 'Accepted' ? 'green' : application.status === 'Rejected' ? 'coral' : application.status === 'Submitted' ? 'gold' : 'gray'}>{application.status}</Pill>
        {application.adminNote && <p className="text-sm text-muted-foreground sm:max-w-xs">{application.adminNote}</p>}
      </article>)}</div>}
  </div></AppShell>;
}
function NotificationsPage() {
  const q=useListMyNotifications({query:{queryKey:getListMyNotificationsQueryKey()}});
  const read=useMarkMyNotificationRead(); const qc=useQueryClient();
  return <AppShell><SectionHead eyebrow="Keep in the loop" title="Your updates" description="Announcements, new listings and changes to your applications." />
    {q.isLoading?<Loading />:q.isError?<ErrorState retry={()=>q.refetch()} />:!q.data?.length?<Empty title="No updates to catch up on" text="When something new happens, it will appear here." />:<div className="space-y-3">{q.data.map(n=><article key={n.id} data-testid={`notification-${n.id}`} className={`flex gap-4 rounded-2xl border p-5 ${n.readAt?'border-border bg-card':'border-[#c8d9cc] bg-[#f1f5ef]'}`}><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e4eee5] text-primary"><Bell size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-bold">{n.title}</h2>{!n.readAt&&<Pill>New</Pill>}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{n.body}</p><p className="mt-2 text-[11px] text-muted-foreground">{fmtDate(n.createdAt)}</p></div>{!n.readAt&&<Button data-testid={`button-read-${n.id}`} variant="plain" className="self-start px-2" aria-label="Mark as read" disabled={read.isPending} onClick={()=>read.mutate({id:n.id,data:{read:true}},{onSuccess:()=>qc.invalidateQueries({queryKey:getListMyNotificationsQueryKey()})})}><Check size={17} /></Button>}</article>)}</div>}
  </AppShell>;
}
function AboutPage() {
  const q=useGetAbout({query:{queryKey:getGetAboutQueryKey()}});
  return <PublicShell><main className="mx-auto max-w-[1100px] px-5 py-12 sm:px-8 sm:py-20"><div className="max-w-3xl"><p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-[#a6604c]">Who we are</p><h1 className="font-display text-4xl font-extrabold leading-tight sm:text-6xl">Peace grows when people have a way forward.</h1><p className="mt-5 text-lg leading-8 text-[#536d60]">Business for Peace Community Development Foundation works with communities to create practical pathways for young people and women.</p></div>{q.isLoading?<div className="mt-10"><Loading /></div>:q.isError?<div className="mt-10"><ErrorState retry={()=>q.refetch()} /></div>:<div className="mt-12 grid gap-5 md:grid-cols-2">{[{label:'Our mission',value:q.data?.mission},{label:'Our vision',value:q.data?.vision},{label:'Focus areas',value:q.data?.focusAreas?.join(' · ')},{label:'Empowerment',value:q.data?.empowermentInfo}].map(it=><div key={it.label} className="rounded-2xl border border-border bg-card p-6"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a6604c]">{it.label}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#4f695d]">{it.value||'Information coming soon.'}</p></div>)}</div>}<div className="mt-12 rounded-[2rem] bg-[#174c40] p-7 text-[#f8f4e9] sm:p-10"><div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#edc36d]">A practical starting point</p><h2 className="mt-2 font-display text-3xl font-extrabold">Find the next step that fits you.</h2><p className="mt-2 text-sm text-[#cfdbd0]">Explore what’s open across the community.</p></div><Link href="/opportunities" className="inline-flex items-center gap-2 rounded-xl bg-[#e8b65d] px-5 py-3 text-sm font-bold text-[#173f35]">Explore opportunities <ArrowRight size={16} /></Link></div></div></main></PublicShell>;
}
function ContactPage() {
  const send=useSendContactMessage(); const [success,setSuccess]=useState(false);
  const [form,setForm]=useState({name:'',email:'',subject:'',message:''});
  const submit=(e:FormEvent)=>{e.preventDefault();send.mutate({data:form},{onSuccess:()=>{setSuccess(true);setForm({name:'',email:'',subject:'',message:''})}});};
  return <PublicShell><main className="mx-auto grid max-w-[1100px] gap-10 px-5 py-12 sm:px-8 sm:py-20 md:grid-cols-[.85fr_1.15fr]"><div><p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-[#a6604c]">Get in touch</p><h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">We’re listening.</h1><p className="mt-4 max-w-md text-base leading-7 text-[#536d60]">Questions about an opportunity, program or the B4P Youth community? Send a note. Our team will get back to you.</p><div className="mt-8 rounded-2xl bg-[#e9eee4] p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-primary"><Mail size={18} /></div><p className="mt-3 text-sm font-bold">A real person will read your message.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Please do not send sensitive personal or account information through this form.</p></div></div><form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 sm:p-8">{success&&<div className="mb-5 rounded-xl bg-[#e4eee5] p-3 text-sm font-semibold text-primary">Your message is on its way. Thanks for getting in touch.</div>}{send.isError&&<div className="mb-5"><Notice>Your message could not be sent. Please try again.</Notice></div>}<div className="grid gap-4 sm:grid-cols-2">{[['name','Your name','text'],['email','Email address','email']].map(([key,label,type])=><label key={key} className="space-y-1.5 text-xs font-semibold">{label}<input required type={type} value={form[key as keyof typeof form]} onChange={e=>setForm({...form,[key]:e.target.value})} className="h-11 w-full rounded-xl border border-border bg-[#fbf9f2] px-3 text-sm font-normal outline-none focus:border-primary" /></label>)}</div><label className="mt-4 block space-y-1.5 text-xs font-semibold">Subject<input required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} className="h-11 w-full rounded-xl border border-border bg-[#fbf9f2] px-3 text-sm font-normal outline-none focus:border-primary" /></label><label className="mt-4 block space-y-1.5 text-xs font-semibold">Message<textarea required minLength={5} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} className="min-h-36 w-full rounded-xl border border-border bg-[#fbf9f2] p-3 text-sm font-normal outline-none focus:border-primary" /></label><Button type="submit" className="mt-5" disabled={send.isPending}>{send.isPending?'Sending…':'Send message'} <Send size={15} /></Button></form></main></PublicShell>;
}

function AdminGate({ children }: { children: ReactNode }) {
  const { isLoaded,isSignedIn }=useUser();
  if(!isLoaded)return <div className="grid min-h-screen place-items-center"><Loading /></div>;
  if(!isSignedIn)return <Redirect to="/sign-in" />;
  return <>{children}</>;
}
function AccessError({ retry }: { retry?:()=>void }) { return <ErrorState retry={retry} message="You don’t have permission to view this workspace." />; }
function AdminOverview() {
  const q=useGetAdminDashboard({query:{queryKey:getGetAdminDashboardQueryKey()}});
  if(q.isLoading)return <AppShell admin><Loading /></AppShell>;
  if(q.isError)return <AppShell admin><AccessError retry={()=>q.refetch()} /></AppShell>;
  const d=q.data!;
  const stats=[['Young people',d.users,Users,'/admin/users'],['Live opportunities',d.publishedOpportunities,BriefcaseBusiness,'/admin/opportunities'],['Published programs',d.publishedPrograms,BookOpen,'/admin/programs'],['Upcoming events',d.upcomingEvents,CalendarDays,'/admin/events'],['Applications to review',d.pendingApplications,FileText,'/admin/applications'],['New messages',d.newMessages,Mail,'/admin/messages']] as const;
  return <AppShell admin><div className="page-enter"><SectionHead eyebrow="Foundation desk" title="Community overview" description="A clear look at what’s moving across B4P Youth." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{stats.map(([label,value,Icon,href],i)=><Link key={label} href={href} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 hover:border-[#acc4b0]"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${i%2?'bg-[#f8efdc] text-[#9d6a29]':'bg-[#e5eee5] text-primary'}`}><Icon size={20}/></span><div className="flex-1"><p className="text-xs font-semibold text-muted-foreground">{label}</p><b className="font-display text-2xl">{value}</b></div><ArrowUpRight size={16} className="text-muted-foreground"/></Link>)}</div><div className="mt-9"><SectionHead title="Recent applications" description="The latest applications submitted by young people." action={<Link href="/admin/applications" className="text-sm font-bold text-primary">Manage applications <ArrowRight size={14} className="ml-1 inline"/></Link>} />{d.recentApplications.length?<div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="hidden grid-cols-[1.2fr_1.3fr_.9fr_.8fr] gap-3 bg-[#f0f2e9] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid"><span>Applicant</span><span>Program</span><span>Submitted</span><span>Status</span></div>{d.recentApplications.map(a=><div key={a.id} className="grid gap-2 border-t border-border px-5 py-4 first:border-0 sm:grid-cols-[1.2fr_1.3fr_.9fr_.8fr] sm:items-center"><div><p className="text-sm font-bold">{a.applicantName}</p><p className="text-xs text-muted-foreground">{a.applicantEmail}</p></div><span className="text-sm">{a.programName}</span><span className="text-xs text-muted-foreground">{fmtDate(a.submittedAt)}</span><Pill tone={a.status==='Accepted'?'green':a.status==='Rejected'?'coral':'gold'}>{a.status}</Pill></div>)}</div>:<Empty title="No applications yet" text="New applications will show here for review." />}</div></div></AppShell>;
}

function useRefresh(...keys: (readonly unknown[])[]) {
  const qc=useQueryClient();
  return () => keys.forEach(queryKey=>{void qc.invalidateQueries({queryKey});});
}
function AdminUsers() {
  const [search,setSearch]=useState(''); const [selected,setSelected]=useState<number|undefined>();
  const q=useListUsers({search:search||undefined},{query:{queryKey:getListUsersQueryKey({search:search||undefined})}});
  const detail=useGetUser(selected ?? 0,{query:{enabled:!!selected,queryKey:getGetUserQueryKey(selected ?? 0)}});
  const status=useUpdateUserStatus(); const refresh=useRefresh(getListUsersQueryKey({search:search||undefined}));
  return <AppShell admin><SectionHead eyebrow="People" title="Young people" description="View profiles and manage access to the youth portal." /><SearchBox value={search} onChange={setSearch} placeholder="Search names, email, county…" />{q.isLoading?<Loading />:q.isError?<AccessError retry={()=>q.refetch()} />:!q.data?.length?<Empty title="No profiles found" text="Try a different search or check back as the community grows." />:<div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card"><TableHead cols={['Person','Location','Applications','Event registrations','Status']} />{q.data.map((u:AdminUser)=><div key={u.id} data-testid={`row-user-${u.id}`} className="grid gap-2 border-t border-border px-5 py-4 sm:grid-cols-[1.25fr_1fr_.65fr_.8fr_.65fr] sm:items-center"><button onClick={()=>setSelected(u.id)} className="text-left"><p className="text-sm font-bold text-primary">{u.fullName}</p><p className="text-xs text-muted-foreground">{u.email}</p></button><span className="text-xs text-muted-foreground">{[u.city,u.county,u.country].filter(Boolean).join(', ')||'—'}</span><span className="text-sm">{u.applicationCount}</span><span className="text-sm">{u.eventRegistrationCount}</span><div><Button variant={u.active?'soft':'line'} className="px-3 py-2 text-xs" disabled={status.isPending} onClick={()=>status.mutate({id:u.id,data:{active:!u.active}},{onSuccess:refresh})}>{u.active?'Active · pause':'Inactive · restore'}</Button></div></div>)}</div>}
    {selected&&<Modal title="Member profile" onClose={()=>setSelected(undefined)}>{detail.isLoading?<Loading />:detail.isError?<AccessError retry={()=>detail.refetch()} />:detail.data?<div className="space-y-3 text-sm"><div><b>{detail.data.fullName}</b><p className="text-muted-foreground">{detail.data.email}</p></div><p>{detail.data.phone}</p><p>{[detail.data.city,detail.data.county,detail.data.country].filter(Boolean).join(', ')}</p><p>Education: {detail.data.educationLevel||'Not shared'}</p><p>Interests: {detail.data.interests?.join(', ')||'Not shared'}</p></div>:null}</Modal>}
  </AppShell>;
}
function SearchBox({value,onChange,placeholder}:{value:string;onChange:(s:string)=>void;placeholder:string}){return <label className="relative block max-w-xl"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm outline-none focus:border-primary"/></label>}
function TableHead({cols}:{cols:string[]}){return <div className="hidden grid-cols-[1.2fr_1.2fr_1fr_.8fr] gap-3 bg-[#f0f2e9] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid" style={{gridTemplateColumns:`repeat(${cols.length},minmax(0,1fr))`}}>{cols.map(x=><span key={x}>{x}</span>)}</div>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <div className="fixed inset-0 z-[70] grid place-items-center bg-[#112e28]/50 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold">{title}</h2><button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-2 hover:bg-muted"><X size={18}/></button></div>{children}</section></div>}

function AdminOpportunities() {
  const q=useListAdminOpportunities({query:{queryKey:getListAdminOpportunitiesQueryKey()}});
  const create=useCreateOpportunity(),update=useUpdateOpportunity(),del=useDeleteOpportunity();
  const [modal,setModal]=useState<Opportunity|null|false>(false); const refresh=useRefresh(getListAdminOpportunitiesQueryKey(),getListOpportunitiesQueryKey());
  const save=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const data={title:txt(f.get('title')),category:txt(f.get('category')) as OpportunityCategory,organization:txt(f.get('organization')),description:txt(f.get('description')),requirements:txt(f.get('requirements')),location:txt(f.get('location')),deadline:txt(f.get('deadline'))||null,applicationUrl:txt(f.get('applicationUrl'))||null,published:f.get('published')==='on'};const done=()=>{refresh();setModal(false);};if(modal)update.mutate({id:modal.id,data},{onSuccess:done});else create.mutate({data},{onSuccess:done});};
  return <AppShell admin><SectionHead eyebrow="Content" title="Opportunities" description="Publish real leads for work, learning and participation." action={<Button onClick={()=>setModal(null)}><Plus size={16}/>New opportunity</Button>}/>{q.isLoading?<Loading/>:q.isError?<AccessError retry={()=>q.refetch()}/>:!q.data?.length?<Empty title="Your opportunity board starts here" text="Add a current lead so young people know where to take their next step." action={<Button onClick={()=>setModal(null)}><Plus size={15}/>Create opportunity</Button>}/>:<div className="space-y-3">{q.data.map((o:Opportunity)=><article key={o.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Pill>{o.category}</Pill><Pill tone={o.published?'green':'gray'}>{o.published?'Published':'Draft'}</Pill></div><h2 className="mt-2 font-display text-lg font-bold">{o.title}</h2><p className="text-xs text-muted-foreground">{o.organization} · {o.location} · Deadline {fmtDate(o.deadline)}</p></div><div className="flex gap-2"><Button variant="line" className="px-3" onClick={()=>setModal(o)}><Pencil size={15}/>Edit</Button><Button variant="plain" aria-label="Delete opportunity" onClick={()=>{if(confirm(`Delete “${o.title}”?`))del.mutate({id:o.id},{onSuccess:refresh});}}><Trash2 size={16}/></Button></div></article>)}</div>}
    {modal!==false&&<Modal title={modal?'Edit opportunity':'New opportunity'} onClose={()=>setModal(false)}><form onSubmit={save} className="space-y-3"><TextField name="title" label="Title" required defaultValue={modal?.title}/><div className="grid grid-cols-2 gap-3"><TextField name="organization" label="Organization" required defaultValue={modal?.organization}/><label className="text-xs font-semibold">Category<select name="category" defaultValue={modal?.category??'Jobs'} className="mt-1 h-10 w-full rounded-lg border border-border bg-[#fbf9f2] px-2 text-sm">{['Jobs','Internships','Scholarships','Fellowships','Trainings','Grants','Volunteer'].map(c=><option key={c}>{c}</option>)}</select></label></div><TextField name="location" label="Location" required defaultValue={modal?.location}/><TextField name="deadline" label="Deadline" type="date" defaultValue={modal?.deadline?.slice(0,10)}/><TextField name="applicationUrl" label="Application link" defaultValue={modal?.applicationUrl??''}/><TextArea name="description" label="Description" required defaultValue={modal?.description}/><TextArea name="requirements" label="Requirements" defaultValue={modal?.requirements}/><CheckField name="published" label="Publish this opportunity" defaultChecked={modal?.published??false}/><MutationButtons pending={create.isPending||update.isPending} error={create.isError||update.isError}/></form></Modal>}
  </AppShell>;
}
function AdminPrograms() {
  const q=useListAdminPrograms({query:{queryKey:getListAdminProgramsQueryKey()}});
  const create=useCreateProgram(),update=useUpdateProgram(),del=useDeleteProgram();
  const [modal,setModal]=useState<Program|null|false>(false);const refresh=useRefresh(getListAdminProgramsQueryKey(),getListProgramsQueryKey());
  const save=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const data={name:txt(f.get('name')),coverImage:txt(f.get('coverImage'))||null,description:txt(f.get('description')),objectives:txt(f.get('objectives')),eligibility:txt(f.get('eligibility')),location:txt(f.get('location')),startDate:txt(f.get('startDate'))||null,endDate:txt(f.get('endDate'))||null,applicationDeadline:txt(f.get('applicationDeadline'))||null,published:f.get('published')==='on'};const done=()=>{refresh();setModal(false);};if(modal)update.mutate({id:modal.id,data},{onSuccess:done});else create.mutate({data},{onSuccess:done});};
  return <AppShell admin><SectionHead eyebrow="Content" title="Programs" description="Keep practical learning and support visible to young people." action={<Button onClick={()=>setModal(null)}><Plus size={16}/>New program</Button>}/>{q.isLoading?<Loading/>:q.isError?<AccessError retry={()=>q.refetch()}/>:!q.data?.length?<Empty title="No programs published" text="Create a program page to share goals, eligibility and application dates." action={<Button onClick={()=>setModal(null)}><Plus size={15}/>Create program</Button>}/>:<div className="grid gap-4 md:grid-cols-2">{q.data.map((p:Program)=><article key={p.id} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between"><Pill tone={p.published?'green':'gray'}>{p.published?'Published':'Draft'}</Pill><div className="flex gap-1"><Button variant="plain" aria-label="Edit program" onClick={()=>setModal(p)}><Pencil size={15}/></Button><Button variant="plain" aria-label="Delete program" onClick={()=>{if(confirm(`Delete “${p.name}”?`))del.mutate({id:p.id},{onSuccess:refresh})}}><Trash2 size={15}/></Button></div></div><h2 className="mt-3 font-display text-xl font-bold">{p.name}</h2><p className="mt-1 text-xs text-muted-foreground">{p.location} · {p.applicationDeadline?`Deadline ${fmtDate(p.applicationDeadline)}`:'No deadline set'}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{p.description}</p></article>)}</div>}
    {modal!==false&&<Modal title={modal?'Edit program':'New program'} onClose={()=>setModal(false)}><form onSubmit={save} className="space-y-3"><TextField name="name" label="Program name" required defaultValue={modal?.name}/><TextField name="location" label="Location" required defaultValue={modal?.location}/><TextField name="coverImage" label="Cover image URL" defaultValue={modal?.coverImage??''}/><div className="grid grid-cols-2 gap-3"><TextField name="startDate" label="Start date" type="date" defaultValue={modal?.startDate?.slice(0,10)}/><TextField name="endDate" label="End date" type="date" defaultValue={modal?.endDate?.slice(0,10)}/></div><TextField name="applicationDeadline" label="Application deadline" type="date" defaultValue={modal?.applicationDeadline?.slice(0,10)}/><TextArea name="description" label="Description" required defaultValue={modal?.description}/><TextArea name="objectives" label="Objectives" defaultValue={modal?.objectives}/><TextArea name="eligibility" label="Eligibility" defaultValue={modal?.eligibility}/><CheckField name="published" label="Publish this program" defaultChecked={modal?.published??false}/><MutationButtons pending={create.isPending||update.isPending} error={create.isError||update.isError}/></form></Modal>}
  </AppShell>;
}
function AdminApplications() {
  const [search,setSearch]=useState('');const [status,setStatus]=useState('');
  const params={search:search||undefined,status:status?status as ApplicationStatus:undefined};
  const q=useListAdminApplications(params,{query:{queryKey:getListAdminApplicationsQueryKey(params)}});
  const update=useUpdateApplication();const refresh=useRefresh(getListAdminApplicationsQueryKey(params),getGetAdminDashboardQueryKey());
  return <AppShell admin><SectionHead eyebrow="Youth pathways" title="Applications" description="Review program applications and share a clear next step."/><div className="mb-4 flex flex-col gap-3 sm:flex-row"><SearchBox value={search} onChange={setSearch} placeholder="Search applicants or programs…"/><select value={status} onChange={e=>setStatus(e.target.value)} className="h-11 rounded-xl border border-border bg-card px-3 text-sm"><option value="">Every status</option>{['Submitted','Under Review','Accepted','Rejected'].map(s=><option key={s}>{s}</option>)}</select></div>{q.isLoading?<Loading/>:q.isError?<AccessError retry={()=>q.refetch()}/>:!q.data?.length?<Empty title="All caught up" text="There are no applications matching this view."/>:<div className="space-y-3">{q.data.map((a:AdminApplication)=><ApplicationAdminCard key={a.id} item={a} pending={update.isPending} onStatus={(s,n)=>update.mutate({id:a.id,data:{status:s as ApplicationStatus,adminNote:n||null}},{onSuccess:refresh})}/>)}</div>}</AppShell>;
}
function ApplicationAdminCard({item,pending,onStatus}:{item:AdminApplication;pending:boolean;onStatus:(s:string,n:string)=>void}) {const [note,setNote]=useState(item.adminNote??'');return <article className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><Pill tone={item.status==='Accepted'?'green':item.status==='Rejected'?'coral':'gold'}>{item.status}</Pill><span className="text-xs text-muted-foreground">{fmtDate(item.submittedAt)}</span></div><h2 className="mt-2 font-display text-lg font-bold">{item.applicantName}</h2><p className="text-xs text-muted-foreground">{item.applicantEmail} · {item.applicantLocation}</p><p className="mt-3 text-sm font-semibold">{item.programName}</p><p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.motivation}</p></div><select aria-label="Update application status" value={item.status} disabled={pending} onChange={e=>onStatus(e.target.value,note)} className="h-10 shrink-0 rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm"><option>Submitted</option><option>Under Review</option><option>Accepted</option><option>Rejected</option></select></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Internal note for applicant follow-up" className="h-10 flex-1 rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm"/><Button variant="line" disabled={pending} onClick={()=>onStatus(item.status,note)}>Save note</Button></div></article>}
function AdminEvents() {
  const q=useListAdminEvents({query:{queryKey:getListAdminEventsQueryKey()}});
  const create=useCreateEvent(),update=useUpdateEvent(),del=useDeleteEvent();
  const [modal,setModal]=useState<B4PEvent|null|false>(false);const refresh=useRefresh(getListAdminEventsQueryKey(),getListEventsQueryKey());
  const save=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const data={title:txt(f.get('title')),imageUrl:txt(f.get('imageUrl'))||null,date:txt(f.get('date')),time:txt(f.get('time')),location:txt(f.get('location')),description:txt(f.get('description')),published:f.get('published')==='on'};const done=()=>{refresh();setModal(false);};if(modal)update.mutate({id:modal.id,data},{onSuccess:done});else create.mutate({data},{onSuccess:done});};
  return <AppShell admin><SectionHead eyebrow="Gatherings" title="Events" description="Share what’s happening and help the community show up." action={<Button onClick={()=>setModal(null)}><Plus size={16}/>New event</Button>}/>{q.isLoading?<Loading/>:q.isError?<AccessError retry={()=>q.refetch()}/>:!q.data?.length?<Empty title="No events on the board" text="Create the next event and invite young people to join." action={<Button onClick={()=>setModal(null)}><Plus size={15}/>Create event</Button>}/>:<div className="space-y-3">{q.data.map((e:B4PEvent)=><article key={e.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center"><div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-[#e7eee8] text-primary"><span className="text-[9px] font-bold uppercase">{new Date(e.date).toLocaleDateString('en',{month:'short'})}</span><b className="font-display text-lg">{new Date(e.date).getDate()}</b></div><div className="flex-1"><div className="flex gap-2"><Pill tone={e.published?'green':'gray'}>{e.published?'Published':'Draft'}</Pill></div><h2 className="mt-1 font-display text-lg font-bold">{e.title}</h2><p className="text-xs text-muted-foreground">{e.time} · {e.location}</p></div><div className="flex gap-2"><Button variant="line" onClick={()=>setModal(e)}><Pencil size={14}/>Edit</Button><Button variant="plain" aria-label="Delete event" onClick={()=>{if(confirm(`Delete “${e.title}”?`))del.mutate({id:e.id},{onSuccess:refresh})}}><Trash2 size={15}/></Button></div></article>)}</div>}
    {modal!==false&&<Modal title={modal?'Edit event':'New event'} onClose={()=>setModal(false)}><form onSubmit={save} className="space-y-3"><TextField name="title" label="Event title" required defaultValue={modal?.title}/><div className="grid grid-cols-2 gap-3"><TextField name="date" label="Date" type="date" required defaultValue={modal?.date?.slice(0,10)}/><TextField name="time" label="Time" required defaultValue={modal?.time}/></div><TextField name="location" label="Location" required defaultValue={modal?.location}/><TextField name="imageUrl" label="Image URL" defaultValue={modal?.imageUrl??''}/><TextArea name="description" label="Description" required defaultValue={modal?.description}/><CheckField name="published" label="Publish this event" defaultChecked={modal?.published??false}/><MutationButtons pending={create.isPending||update.isPending} error={create.isError||update.isError}/></form></Modal>}</AppShell>;
}
function AdminRegistrations() {
  const [search,setSearch]=useState('');
  const q=useListEventRegistrations({search:search||undefined},{query:{queryKey:getListEventRegistrationsQueryKey({search:search||undefined})}});
  return <AppShell admin><SectionHead eyebrow="Events" title="Registrations" description="See who has signed up for community events."/><SearchBox value={search} onChange={setSearch} placeholder="Search attendee, event or email…"/>{q.isLoading?<Loading/>:q.isError?<AccessError retry={()=>q.refetch()}/>:!q.data?.length?<Empty title="No registrations yet" text="Registrations will appear when young people sign up for an event."/>:<div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card"><TableHead cols={['Attendee','Event','Event date','Registered','Contact']}/>{q.data.map(r=><div key={r.id} className="grid gap-1 border-t border-border px-5 py-4 first:border-0 sm:grid-cols-[1fr_1fr_.8fr_.8fr_1fr] sm:items-center"><div><p className="text-sm font-bold">{r.attendeeName}</p><p className="text-xs text-muted-foreground">{r.attendeeEmail}</p></div><span className="text-sm">{r.eventTitle}</span><span className="text-xs">{fmtDate(r.eventDate)}</span><span className="text-xs text-muted-foreground">{fmtDate(r.registeredAt)}</span><span className="text-xs text-muted-foreground">{r.attendeePhone}</span></div>)}</div>}</AppShell>;
}
function AdminNotifications() {
  const send=usePublishNotification();const [title,setTitle]=useState('');const [body,setBody]=useState('');
  return <AppShell admin><div className="mx-auto max-w-3xl"><SectionHead eyebrow="Community updates" title="Announcements" description="Send an important update to active young people in the community."/><form onSubmit={e=>{e.preventDefault();send.mutate({data:{title,body}},{onSuccess:()=>{setTitle('');setBody('')}})}} className="rounded-2xl border border-border bg-card p-6 sm:p-8">{send.isSuccess&&<div className="mb-5 rounded-xl bg-[#e4eee5] p-3 text-sm font-semibold text-primary">Announcement published to {send.data.recipients} people.</div>}{send.isError&&<div className="mb-5"><Notice>Your announcement could not be published. Please try again.</Notice></div>}<TextField name="title" label="Headline" required value={title} onChange={e=>setTitle(e.target.value)}/><TextArea name="body" label="Message" required value={body} onChange={e=>setBody(e.target.value)}/><p className="mt-2 text-xs text-muted-foreground">This message will be shared with all active youth accounts.</p><Button type="submit" className="mt-5" disabled={send.isPending}>{send.isPending?'Publishing…':'Publish announcement'} <Send size={15}/></Button></form></div></AppShell>;
}
function AdminMessages() {
  const q=useListContactMessages({query:{queryKey:getListContactMessagesQueryKey()}});
  const update=useUpdateContactMessage();const refresh=useRefresh(getListContactMessagesQueryKey());
  return <AppShell admin><SectionHead eyebrow="From the community" title="Messages" description="Follow up on questions and feedback from the contact form."/>{q.isLoading?<Loading/>:q.isError?<AccessError retry={()=>q.refetch()}/>:!q.data?.length?<Empty title="No messages waiting" text="Messages from the public contact form will appear here."/>:<div className="space-y-3">{q.data.map((m:ContactMessage)=><article key={m.id} className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Pill tone={m.status==='new'?'gold':m.status==='replied'?'green':'gray'}>{m.status}</Pill><span className="text-xs text-muted-foreground">{fmtDate(m.createdAt)}</span></div><h2 className="mt-2 font-display text-lg font-bold">{m.subject}</h2><p className="text-xs text-muted-foreground">{m.name} · <a className="text-primary underline" href={`mailto:${m.email}`}>{m.email}</a></p></div><select value={m.status} aria-label={`Message status ${m.id}`} onChange={e=>update.mutate({id:m.id,data:{status:e.target.value as any}},{onSuccess:refresh})} className="h-10 rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm"><option value="new">New</option><option value="read">Read</option><option value="replied">Replied</option></select></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{m.message}</p></article>)}</div>}</AppShell>;
}
function AdminSettings() {
  const q=useGetAdminSettings({query:{queryKey:getGetAdminSettingsQueryKey()}});
  const save=useUpdateAdminSettings();const qc=useQueryClient();
  if(q.isLoading)return <AppShell admin><Loading/></AppShell>;
  if(q.isError)return <AppShell admin><AccessError retry={()=>q.refetch()}/></AppShell>;
  const s=q.data!;
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);let socialLinks=s.socialLinks;try{const parsed=JSON.parse(txt(f.get('socialLinks')));if(Array.isArray(parsed))socialLinks=parsed.filter((item)=>item&&typeof item.label==='string'&&typeof item.url==='string');}catch{socialLinks=s.socialLinks;}const contactEmail=txt(f.get('contactEmail')).trim();const data:OrganizationSettings={name:txt(f.get('name')),description:txt(f.get('description')),mission:txt(f.get('mission')),vision:txt(f.get('vision')),focusAreas:txt(f.get('focusAreas')).split(',').map(x=>x.trim()).filter(Boolean),empowermentInfo:txt(f.get('empowermentInfo')),contactEmail:contactEmail||null,phone:txt(f.get('phone')),address:txt(f.get('address')),socialLinks};save.mutate({data},{onSuccess:()=>qc.invalidateQueries({queryKey:getGetAdminSettingsQueryKey()})});};
  return <AppShell admin><div className="mx-auto max-w-4xl"><SectionHead eyebrow="Organization" title="Public site settings" description="Keep the foundation’s story and contact details up to date."/><form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8">{save.isSuccess&&<Notice>Your organization details have been saved.</Notice>}{save.isError&&<Notice>Could not save these settings. Please check required fields.</Notice>}<TextField name="name" label="Organization name" required defaultValue={s.name}/><TextArea name="description" label="Description" required defaultValue={s.description}/><TextArea name="mission" label="Mission" required defaultValue={s.mission}/><TextArea name="vision" label="Vision" required defaultValue={s.vision}/><TextField name="focusAreas" label="Focus areas (comma separated)" defaultValue={s.focusAreas.join(', ')}/><TextArea name="empowermentInfo" label="Empowerment information" required defaultValue={s.empowermentInfo}/><div className="grid gap-3 sm:grid-cols-2"><TextField name="contactEmail" type="email" label="Contact email (optional)" defaultValue={s.contactEmail ?? ''}/><TextField name="phone" label="Phone" defaultValue={s.phone}/></div><TextField name="address" label="Address" defaultValue={s.address}/><TextArea name="socialLinks" label="Social links (JSON list of label and URL)" defaultValue={JSON.stringify(s.socialLinks,null,2)}/><p className="-mt-2 text-xs text-muted-foreground">Example: [{"{"}"label":"Facebook","url":"https://…"{"}"}]</p><Button type="submit" disabled={save.isPending}>{save.isPending?'Saving…':'Save public details'} <Check size={15}/></Button></form></div></AppShell>;
}
function TextField(props:React.InputHTMLAttributes<HTMLInputElement>&{label:string}){const {label,name,...rest}=props;return <label className="block space-y-1.5 text-xs font-semibold">{label}<input name={name} {...rest} className={`h-10 w-full rounded-lg border border-border bg-[#fbf9f2] px-3 text-sm font-normal outline-none focus:border-primary ${props.className??''}`}/></label>}
function TextArea(props:React.TextareaHTMLAttributes<HTMLTextAreaElement>&{label:string}){const {label,name,...rest}=props;return <label className="block space-y-1.5 text-xs font-semibold">{label}<textarea name={name} {...rest} className={`min-h-24 w-full rounded-lg border border-border bg-[#fbf9f2] p-3 text-sm font-normal outline-none focus:border-primary ${props.className??''}`}/></label>}
function CheckField(props:React.InputHTMLAttributes<HTMLInputElement>&{label:string}){const {label,...rest}=props;return <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" {...rest} className="h-4 w-4 accent-[#1d6252]"/> {label}</label>}
function MutationButtons({pending,error}:{pending:boolean;error:boolean}){return <div className="pt-2">{error&&<p className="mb-3 text-xs font-semibold text-destructive">We couldn’t save this item. Please review the form and try again.</p>}<Button type="submit" disabled={pending}>{pending?'Saving…':'Save changes'} <Check size={15}/></Button></div>}

function AuthPage({type}:{type:'in'|'up'}) {
  return <div className="grain relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#e9eee4] px-4 py-10"><div className="absolute -left-36 -top-28 h-[440px] w-[440px] rounded-full border border-[#cad8c8]"/><div className="absolute -left-16 -top-8 h-[300px] w-[300px] rounded-full border border-[#cad8c8]"/><div className="absolute bottom-[-180px] right-[-150px] h-[500px] w-[500px] rounded-full bg-[#e8b65d]/20"/><div className="relative z-10 w-full max-w-[460px]"><Link href="/" className="mb-7 inline-flex"><Brand/></Link><div className="mb-5 max-w-[430px]"><p className="text-xs font-bold uppercase tracking-[.17em] text-[#a6604c]">{type==='up'?'One community, many possible paths':'Your home base is waiting'}</p><h1 className="mt-2 font-display text-3xl font-extrabold text-[#173f35]">{type==='up'?'Make room for what’s next.':'Welcome back.'}</h1><p className="mt-2 text-sm leading-6 text-[#5c7065]">{type==='up'?'Create an account to save your profile, apply and stay in the loop.':'Sign in to see your applications, updates and new opportunities.'}</p></div><div className="flex min-h-[420px] items-center justify-center"><div className="w-full">{type==='up'?<SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/>:<SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/>}</div></div></div></div>;
}
function AuthLandingRedirect(){const {isLoaded,isSignedIn}=useUser();if(!isLoaded)return <PublicHome/>;return isSignedIn?<Redirect to="/dashboard"/>:<PublicHome/>;}

function Router() {
  const [location]=useLocation();
  return <Switch>
    <Route path="/" component={AuthLandingRedirect}/>
    <Route path="/sign-in/*?" component={()=> <AuthPage type="in"/>}/>
    <Route path="/sign-up/*?" component={()=> <AuthPage type="up"/>}/>
    <Route path="/dashboard" component={()=> <AuthRequired profileSetup={false}><DashboardPage/></AuthRequired>}/>
    <Route path="/opportunities" component={()=> <ListPage type="opportunities"/>}/>
    <Route path="/opportunities/:id" component={()=> <DetailPage type="opportunities"/>}/>
    <Route path="/programs" component={()=> <ListPage type="programs"/>}/>
    <Route path="/programs/:id" component={()=> <DetailPage type="programs"/>}/>
    <Route path="/events" component={()=> <ListPage type="events"/>}/>
    <Route path="/events/:id" component={()=> <DetailPage type="events"/>}/>
    <Route path="/notifications" component={()=> <AuthRequired><NotificationsPage/></AuthRequired>}/>
    <Route path="/applications" component={()=> <AuthRequired><ApplicationsPage/></AuthRequired>}/>
    <Route path="/profile" component={()=> <AuthRequired profileSetup={false}><ProfilePage/></AuthRequired>}/>
    <Route path="/about" component={AboutPage}/>
    <Route path="/contact" component={ContactPage}/>
    <Route path="/admin" component={()=> <AdminGate><AdminOverview/></AdminGate>}/>
    <Route path="/admin/users" component={()=> <AdminGate><AdminUsers/></AdminGate>}/>
    <Route path="/admin/opportunities" component={()=> <AdminGate><AdminOpportunities/></AdminGate>}/>
    <Route path="/admin/programs" component={()=> <AdminGate><AdminPrograms/></AdminGate>}/>
    <Route path="/admin/applications" component={()=> <AdminGate><AdminApplications/></AdminGate>}/>
    <Route path="/admin/events" component={()=> <AdminGate><AdminEvents/></AdminGate>}/>
    <Route path="/admin/registrations" component={()=> <AdminGate><AdminRegistrations/></AdminGate>}/>
    <Route path="/admin/notifications" component={()=> <AdminGate><AdminNotifications/></AdminGate>}/>
    <Route path="/admin/messages" component={()=> <AdminGate><AdminMessages/></AdminGate>}/>
    <Route path="/admin/settings" component={()=> <AdminGate><AdminSettings/></AdminGate>}/>
    <Route component={()=> <PublicShell><div className="mx-auto max-w-3xl px-5 py-20 text-center"><p className="text-xs font-bold uppercase tracking-widest text-[#a6604c]">404 · Not found</p><h1 className="mt-3 font-display text-4xl font-extrabold">This page wandered off.</h1><p className="mt-3 text-sm text-muted-foreground">Let’s get you back to the right place.</p><Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"><ArrowLeft size={15}/>Back to B4P Youth</Link></div></PublicShell>}/>
  </Switch>;
}
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{signIn:{start:{title:'Welcome back',subtitle:'Sign in to your B4P Youth home base'}},signUp:{start:{title:'Join B4P Youth',subtitle:'Make room for what’s next'}}}}
    routerPush={(to)=>setLocation(stripBase(to))} routerReplace={(to)=>setLocation(stripBase(to),{replace:true})}>
    <QueryClientProvider client={queryClient}><ClerkQueryClientCacheInvalidator/><Router/></QueryClientProvider>
  </ClerkProvider>;
}
function App() { return <WouterRouter base={basePath}><ClerkProviderWithRoutes/></WouterRouter>; }
export default App;
