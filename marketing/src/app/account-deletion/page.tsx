import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Account deletion",
  description:
    "How to delete your Unvibe account, what deletion removes, and the timeline for local and backend data.",
  alternates: { canonical: "/account-deletion" },
};

export default function AccountDeletionPage() {
  return (
    <LegalLayout
      title="Deleting your account"
      updated="October 2026"
      intro="You can delete your account at any time and remove your data from your device and our servers. Here is exactly what happens when you do."
    >
      <LegalSection heading="How to delete">
        <p>
          In the app, go to <strong>Settings → Account &amp; Plan → Delete my account</strong>. You
          will be asked to confirm, with a clear explanation of what will be removed.
        </p>
        <p>
          If a paid subscription is still set to renew, cancel it in Manage billing first. If you
          own a team with other members, remove them on the Plan page first. Until then nothing is
          deleted.
        </p>
      </LegalSection>

      <LegalSection heading="What deletion does">
        <ul className="list-disc space-y-2 pl-5">
          <li>Deletes your sign-in identity, so the account can no longer sign in.</li>
          <li>
            Deletes your account record and all your learning events, the workspaces you own and
            your workspace memberships.
          </li>
          <li>
            Revokes your authentication tokens and pending device sign-ins, so previous tokens stop
            working.
          </li>
          <li>
            Deletes the records kept under your email address: your waitlist entry, site feedback,
            feedback bonus grants and team invitations sent to that address.
          </li>
          <li>Revokes the invitations you sent to someone else&apos;s team that were still pending.</li>
          <li>Deletes your beta-download records, which are found by your email address.</li>
          <li>Wipes your local learning store and credentials on the device.</li>
          <li>Returns the app to a clean, signed-out state.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="What stays">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            If you redeemed a promo code, the redemption record stays so the code stays used, but it
            no longer names your account or email address.
          </li>
          <li>
            Gift records you share with another person stay for them, with your email address
            removed.
          </li>
          <li>
            Stripe keeps its own customer and payment records, as tax and fraud-prevention laws
            require.
          </li>
          <li>
            Our billing audit log keeps its entries, such as checkouts, seat changes, refunds and team
            membership changes. They hold no email address and no longer point to your account. Some
            keep Stripe payment or subscription IDs, and a change to your membership of someone
            else&apos;s team keeps your account ID.
          </li>
          <li>
            We keep a small deletion record: your account ID, one-way hashes of the sign-in tokens
            that asked for the deletion, which steps finished, the beta-download outcome, and when
            the deletion started and finished. Once the deletion is done it holds no email address.
            It lets a repeated request learn that the account is already deleted, and it stops the
            same account ID from being created again.
          </li>
          <li>
            If someone signs up again with your email address after the deletion starts, the records
            for that address belong to the new account and are not deleted.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Timeline">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Most of the deletion happens at once, when you confirm: the sign-in identity, the account
            data and the beta-download records.
          </li>
          <li>
            If a step fails, the app tells you and you can try again. A daily check also retries
            any deletion still unfinished an hour after it started.
          </li>
          <li>
            If we cannot check for beta-download records at the time, any we find, and the email
            address kept to find them, are removed within 30 days.
          </li>
          <li>After a successful request, the app wipes its local learning store.</li>
          <li>
            Backup and operational-log timelines depend on the final infrastructure and
            will be published after they are verified.
          </li>
          <li>
            Code already sent to the AI provider during past reviews is governed by that
            provider&apos;s retention policy, which we do not control.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="If you never made an account">
        <p>
          Then your lessons and history live only on your computer. To remove them, delete
          the app&apos;s data folder. Our server keeps only a random install ID with a few
          dates and usage counts, never your code or prompts. Email us below if you want that
          record removed too.
        </p>
      </LegalSection>

      <LegalSection heading="Need help?">
        <p>
          Email{" "}
          <a href={supportMailto}>{SUPPORT_EMAIL}</a>
          {" "}
          and we will help you delete your account or data.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
