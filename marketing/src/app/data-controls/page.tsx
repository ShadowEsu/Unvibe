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
            on your device and, if you are signed in, sync to our backend. Removed
            immediately from primary storage when you delete them or your account.
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
          Learning and account data are kept until you remove them, then deleted
          immediately from primary storage. Encrypted backups may persist for a short
          rotation window before aging out. Analytics logs are metadata only and exclude
          the contents of your code.
        </p>
      </LegalSection>

      <LegalSection heading="Exclusions and consent">
        <p>
          Cloud analysis is off until you grant consent per repository, and you can
          preview exactly what would be sent first. Default exclusions cover{" "}
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

      <LegalSection heading="No training on your code">
        <p>
          We use a provider configuration that does not train on submitted data, and we
          do not train models on your private code.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
