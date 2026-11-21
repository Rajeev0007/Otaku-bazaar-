import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { Breadcrumbs } from "@/components/ui/misc";
import { Icon, type IconName } from "@/components/ui/icon";
import { ChangePasswordForm, LogoutButton, ProfileForm, ResendVerification, SignOutOthers } from "@/components/account/account-forms";
import { FormSuccess } from "@/components/ui/field";
import { RecentlyViewed } from "@/components/store/recently-viewed";

export const metadata: Metadata = { title: "My account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string; reset?: string }> }) {
  const user = await requireUser("/account");
  const sp = await searchParams;
  const [wishlistCount, sessions, hasPassword, recent] = await Promise.all([
    db.wishlistItem.count({ where: { wishlist: { userId: user.id } } }),
    db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, select: { id: true, userAgent: true, lastSeenAt: true, ip: true } }),
    db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } }).then((u) => !!u?.passwordHash),
    db.recentlyViewed.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="container-page pb-16 pt-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My account" }]} />
      <div className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">My account</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Hi, {user.name?.split(" ")[0] ?? "there"}</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.isStaff && (
            <Link href="/admin" className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium hover:bg-surface-2">
              <Icon name="settings" size={16} /> Admin
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      <div className="space-y-4">
        {sp.welcome && <FormSuccess message="Welcome to The Otaku Bazaar! Your account is ready." />}
        {sp.reset && <FormSuccess message="Your password has been changed and you're signed in." />}
        {!user.emailVerifiedAt && <ResendVerification email={user.email} />}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile href="/wishlist" icon="heart" title="Wishlist" body={`${wishlistCount} saved item${wishlistCount === 1 ? "" : "s"}`} />
        <Tile href="/cart" icon="bag" title="Cart" body="Review saved items" />
        <Tile icon="package" title="Orders" body="Order history arrives with checkout" />
        <Tile href="#recent" icon="history" title="Recently viewed" body={`${recent} product${recent === 1 ? "" : "s"}`} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Used for order updates and delivery.</p>
          <ProfileForm name={user.name ?? ""} phone={user.phone ?? ""} marketingOptIn={user.marketingOptIn} />
        </section>
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">{hasPassword ? "Change password" : "Set a password"}</h2>
          <p className="mb-5 mt-1 text-sm text-muted">{hasPassword ? "Changing your password signs out your other devices." : "You sign in with Google. Use “Forgot password” on the sign-in page to add a password."}</p>
          {hasPassword ? <ChangePasswordForm /> : <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:underline">Set a password by email</Link>}
        </section>
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Active sessions</h2>
              <p className="mt-1 text-sm text-muted">Devices currently signed in to your account.</p>
            </div>
            {sessions.length > 1 && <SignOutOthers />}
          </div>
          <ul className="mt-4 divide-y divide-line text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0 truncate">{describeAgent(s.userAgent)}</span>
                <span className="shrink-0 text-xs text-muted">
                  {s.id === user.sessionId ? <span className="font-semibold text-success">This device</span> : `Active ${s.lastSeenAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div id="recent" className="-mx-4 scroll-mt-24 sm:-mx-6 xl:-mx-10">
        <RecentlyViewed title="Recently viewed" />
      </div>
    </div>
  );
}

function describeAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

function Tile({ href, icon, title, body }: { href?: string; icon: IconName; title: string; body: string }) {
  const inner = (
    <>
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon name={icon} size={20} />
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted">{body}</p>
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 transition hover:border-line-strong">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-line p-5 opacity-80">{inner}</div>
  );
}
