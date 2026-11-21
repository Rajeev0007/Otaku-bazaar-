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

        <Card title="Payments & shipping" description="Razorpay, Stripe and Shiprocket">
          <p className="text-sm text-muted">These arrive with checkout (next phase) and will be connected from this page too.</p>
        </Card>
      </div>
    </>
  );
}
