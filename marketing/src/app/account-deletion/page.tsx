import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Account deletion",
  description:
    "How to delete your Unvibe account, what deletion removes, and the timeline for local and backend data.",
};

export default function AccountDeletionPage() {
  return (
    <LegalLayout
      title="Deleting your account"
      updated="July 2026"
      intro="You can delete your account at any time and remove your data from your device and our servers. Here is exactly what happens when you do."
    >
      <LegalSection heading="How to delete">
        <p>
          In the app, go to <strong>Settings → Account → Delete my account</strong>. You
          will be asked to confirm, with a clear explanation of what will be removed.
        </p>
      </LegalSection>

      <LegalSection heading="What deletion does">
        <ul className="list-disc space-y-2 pl-5">
          <li>Removes your user record and all your learning events from the backend.</li>
          <li>Revokes your authentication tokens, so previous tokens stop working.</li>
          <li>Wipes your local learning store and credentials on the device.</li>
          <li>Returns the app to a clean, signed-out state.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Timeline">
        <ul className="list-disc space-y-2 pl-5">
          <li>Local data is removed immediately.</li>
          <li>Backend data is removed immediately from the primary database.</li>
          <li>
            Encrypted backups may persist for a short rotation window before they age
            out.
          </li>
          <li>
            Code already sent to the AI provider during past reviews is governed by that
            provider&apos;s retention policy, which we do not control.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="If you never made an account">
        <p>
          Then all your data already lives only on your Mac. Deleting it is as simple as
          removing the app&apos;s data folder, which is also exposed in{" "}
          <strong>Settings → Data</strong>.
        </p>
      </LegalSection>

      <LegalSection heading="Need help?">
        <p>
          Email{" "}
          <a href="mailto:hello@unvibe.app">hello@unvibe.app</a> and we will help you
          delete your account or data.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
