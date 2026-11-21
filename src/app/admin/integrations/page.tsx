import { requireStaff } from "@/server/auth/session";
import { getIntegrations } from "@/server/integrations";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionButton, SimpleForm } from "@/components/admin/simple-form";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { saveIntegrationsAction, sendTestEmailAction } from "@/app/admin/actions";
import { appUrl } from "@/lib/utils";

const BADGE: Record<string, [string, string]> = {
  admin: ["Connected", "bg-success/15 text-success"],
  env: ["Connected (environment variable)", "bg-success/15 text-success"],
  off: ["Not connected", "bg-surface-3 text-muted"],
  unreadable: ["Re-enter key", "bg-warning/15 text-warning"],
};

export default async function IntegrationsPage() {
  await requireStaff("settings.write", "/admin/integrations");
  const { status } = await getIntegrations();
  const storage = process.env.BLOB_READ_WRITE_TOKEN ? "Vercel Blob" : process.env.S3_BUCKET ? "S3 bucket" : "Database (built in)";
  const Badge = ({ s }: { s: string }) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[s]![1]}`}>{BADGE[s]![0]}</span>;

  return (
    <>
      <PageHeader title="Integrations" description="Connect services here. No Vercel environment variables needed. Keys are stored encrypted and never shown again after saving." />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <Card title="Email (Resend)" description="Sends account verification, password reset and (later) order emails." actions={<Badge s={status.email} />}>
          {status.email === "env" ? (
            <p className="text-sm text-muted">Configured through the RESEND_API_KEY environment variable. Remove it in Vercel to manage email here instead.</p>
          ) : (
            <SimpleForm action={saveIntegrationsAction}>
              <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
                <li>Sign up free at resend.com and add your domain (Domains → Add Domain), then add the DNS records it shows.</li>
                <li>API Keys → Create API Key (Sending access). Paste it below.</li>
              </ol>
              <Field label="Resend API key" htmlFor="resendApiKey" hint={status.email === "admin" ? "A key is saved. Leave blank to keep it." : "Starts with re_"}>
                <Input id="resendApiKey" name="resendApiKey" type="password" autoComplete="off" placeholder={status.email === "admin" ? "•••••••• saved" : "re_…"} />
              </Field>
              <Field label="Send emails from" htmlFor="mailFrom" hint="Must use your verified domain, e.g. The Otaku Bazaar <orders@theotakubazaar.com>">
                <Input id="mailFrom" name="mailFrom" defaultValue={status.mailFrom.includes("resend.dev") ? "" : status.mailFrom} />
              </Field>
              {status.email !== "off" && <Checkbox name="clearResend" label="Disconnect email" />}
            </SimpleForm>
          )}
          {status.email !== "off" && (
            <div className="mt-4 border-t border-line pt-4">
              <ActionButton action={sendTestEmailAction} className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
                Send me a test email
              </ActionButton>
            </div>
          )}
        </Card>

        <Card title="Google sign-in" description="Adds “Continue with Google” to the sign-in and register pages." actions={<Badge s={status.google} />}>
          {status.google === "env" ? (
            <p className="text-sm text-muted">Configured through environment variables.</p>
          ) : (
            <SimpleForm action={saveIntegrationsAction}>
              <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
                <li>console.cloud.google.com → APIs &amp; Services → OAuth consent screen → External → publish.</li>
                <li>Credentials → Create credentials → OAuth client ID → Web application.</li>
                <li>
                  Authorised redirect URI: <code className="break-all rounded bg-surface-2 px-1">{appUrl("/api/auth/google/callback")}</code>
                </li>
              </ol>
              <Field label="Client ID" htmlFor="googleClientId">
                <Input id="googleClientId" name="googleClientId" defaultValue={status.googleClientId} autoComplete="off" />
              </Field>
              <Field label="Client secret" htmlFor="googleClientSecret" hint={status.google === "admin" ? "A secret is saved. Leave blank to keep it." : undefined}>
                <Input id="googleClientSecret" name="googleClientSecret" type="password" autoComplete="off" placeholder={status.google === "admin" ? "•••••••• saved" : ""} />
              </Field>
              {status.google !== "off" && <Checkbox name="clearGoogle" label="Disconnect Google sign-in" />}
            </SimpleForm>
          )}
        </Card>

        <Card title="Image storage" description="Where uploaded product photos are kept.">
          <p className="text-sm">
            Using: <b>{storage}</b>
          </p>
          {storage.startsWith("Database") && (
            <p className="mt-2 text-xs text-muted">
              Works out of the box. For a large catalog (hundreds of photos), connect Vercel Blob for faster images: Vercel → Storage → Create → Blob → connect to this project → redeploy. New uploads then go to Blob automatically.
            </p>
          )}
        </Card>

        <Card
          title="Payments (Razorpay)"
          description="UPI, cards, net banking and wallets. Customers pay on Razorpay's secure page; card details never touch this site."
          actions={<span className="flex gap-2">{status.razorpay !== "off" && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.razorpayKeyId.startsWith("rzp_live_") ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{status.razorpayKeyId.startsWith("rzp_live_") ? "LIVE" : "TEST MODE"}</span>}<Badge s={status.razorpay} /></span>}
          className="lg:col-span-2"
        >
          {status.razorpay === "env" ? (
            <p className="text-sm text-muted">Configured through RAZORPAY_* environment variables.</p>
          ) : (
            <SimpleForm action={saveIntegrationsAction} className="grid gap-3 sm:grid-cols-2">
              <ol className="list-decimal space-y-1 pl-5 text-xs text-muted sm:col-span-2">
                <li>Razorpay Dashboard → switch to <b>Test Mode</b> first → Account &amp; Settings → <b>API Keys</b> → Generate Key. Paste both values below.</li>
                <li>Account &amp; Settings → <b>Webhooks</b> → Add New Webhook. URL: <code className="break-all rounded bg-surface-2 px-1">{appUrl("/api/webhooks/razorpay")}</code>. Create a secret, tick <b>payment.captured</b>, <b>payment.failed</b> and <b>order.paid</b>, then paste the same secret below.</li>
                <li>Place a test order with a <a href="https://razorpay.com/docs/payments/payments/test-card-details/" target="_blank" rel="noreferrer" className="underline">Razorpay test card or UPI ID</a>. When your account is activated, repeat with <b>Live Mode</b> keys.</li>
              </ol>
              <Field label="Key ID" htmlFor="razorpayKeyId" hint="rzp_test_… or rzp_live_…">
                <Input id="razorpayKeyId" name="razorpayKeyId" defaultValue={status.razorpayKeyId} autoComplete="off" />
              </Field>
              <Field label="Key secret" htmlFor="razorpayKeySecret" hint={status.razorpay === "admin" ? "Saved. Leave blank to keep it." : undefined}>
                <Input id="razorpayKeySecret" name="razorpayKeySecret" type="password" autoComplete="off" placeholder={status.razorpay === "admin" ? "•••••••• saved" : ""} />
              </Field>
              <Field label="Webhook secret" htmlFor="razorpayWebhookSecret" hint={status.razorpayWebhook ? "Saved. Leave blank to keep it." : "Strongly recommended: confirms payments even if the customer closes the page."} className="sm:col-span-2">
                <Input id="razorpayWebhookSecret" name="razorpayWebhookSecret" type="password" autoComplete="off" placeholder={status.razorpayWebhook ? "•••••••• saved" : ""} />
              </Field>
              {status.razorpay !== "off" && <Checkbox name="clearRazorpay" label="Disconnect Razorpay" className="sm:col-span-2" />}
            </SimpleForm>
          )}
        </Card>

        <Card title="Cash on delivery" description="Turn COD on or off, and set the order limit and fee.">
          <p className="text-sm text-muted">Managed in <a href="/admin/settings" className="underline">Store settings → Cash on delivery</a>.</p>
        </Card>
      </div>
    </>
  );
}
