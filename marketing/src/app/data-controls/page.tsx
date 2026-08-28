import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Data controls",
  description:
    "What data Unvibe keeps, where it lives, how long it is retained, and how to export or delete it.",
};

export default function DataControlsPage() {
  return (
    <LegalLayout
      title="Data controls"
      updated="July 2026"
      intro="What Unvibe keeps, where it lives, and how you stay in control. Private code contents are never written to analytics or application logs, and secrets are filtered on-device before any transmission."
    >
      <LegalSection heading="What is stored and where">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Learning events</strong> (reviews, outcomes, concepts, streaks) live
            on your device and, if you are signed in, sync to our backend. A successful
            account deletion removes the associated primary database rows.
          </li>
          <li>
            <strong>Account data</strong> (email, tokens) is stored on the backend until
            you delete your account; tokens are revoked on sign-out or deletion.
          </li>
          <li>
            <strong>Your auth token</strong> is stored locally in the operating system
            keychain, encrypted at rest.
          </li>
          <li>
            <strong>Code sent for a review</strong> is transmitted to the AI provider to
            generate the explanation. We do not persist raw reviewed code beyond
            generating that explanation; the provider&apos;s own retention governs their
            side.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Retention">
        <p>
          Learning and account data are kept until you remove them. Primary-record,
          backup, provider, and operational-log timelines will be finalized before the
          external beta; this page does not promise deletion from systems we have not
          yet verified.
        </p>
      </LegalSection>

      <LegalSection heading="Exclusions and consent">
        <p>
          Cloud analysis begins only after an explicit review action. Full payload preview
          and per-repository consent controls are still being completed. Default exclusions cover{" "}
          <code className="font-mono">.env</code> files, keys,{" "}
          <code className="font-mono">node_modules</code>, and build output, and you can
          add your own rules in a <code className="font-mono">.unvibeignore</code> file.
        </p>
      </LegalSection>

      <LegalSection heading="Access, export, and deletion">
        <p>
          You can access and export your data, and you can{" "}
          <a href="/account-deletion">delete your account</a> to remove it from your
          device and our servers. If you never created an account, your data only ever
          lived on your Mac. Depending on where you live, you may have additional rights
          under laws such as GDPR or CCPA.
        </p>
      </LegalSection>

      <LegalSection heading="AI provider use">
        <p>
          Unvibe does not build its own training dataset from your code. The configured
          AI provider, retention window, and applicable data-use terms will be disclosed
          and reviewed before cloud beta access is enabled.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
