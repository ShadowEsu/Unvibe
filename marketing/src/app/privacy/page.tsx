import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = pageMetadata({
  path: "/privacy",
  title: "Privacy",
  description:
    "How Unvibe handles code and learning data during the beta, including an on-device check for secrets and cloud-provider disclosure.",
});

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy"
      updated="7 November 2026"
      intro="Unvibe is a desktop app that helps you understand code. This page describes what it processes and why, in plain language. It reflects how the product actually behaves. It is a summary, not a substitute for the full policy."
    >
      <LegalSection heading="What Unvibe processes">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Code you choose to review.</strong> When you activate Unvibe on a
            selection, that snippet is sent to generate an explanation. On Pro, up to two files
            from your project that the snippet imports are added to it automatically (the first
            4,000 characters of each). Before that code leaves your computer it is scanned
            on-device for secrets, and detected credentials block or warn first.
          </li>
          <li>
            <strong>File and project names.</strong> Each explanation includes the file&apos;s path
            inside your project (for example <code>src/lib/retry.ts</code>) when Unvibe knows which
            file the code came from, and the name of the project folder you last worked in with
            Unvibe. The full path on your computer is not sent. <strong>Git diffs</strong> are sent
            only when you ask a Brief to explain them. Unvibe does not read your repository in the
            background.
          </li>
          <li>
            <strong>Learning records:</strong> which snippets you reviewed (with the file&apos;s
            path inside your project and the project folder&apos;s name), comprehension results,
            and concepts.
          </li>
          <li>
            <strong>Account data:</strong> your email for sign-in, your name from Google if you
            sign in with Google, and an authentication token. Before you sign in, the sign-in page
            asks you to agree to the Terms and this policy and to confirm you&apos;re 18 or older.
            If you sign in, we may email you a few getting-started tips over your first two weeks,
            and notices about your account, such as when a free Pro month ends. To choose which tip
            to send, we look at whether your account has run an explanation and on how many days,
            never at your code. You can unsubscribe any time with the link in each email.
            If you start a Google or email sign-in but never approve the app, our sign-in provider
            (Supabase) still keeps that email and name as a sign-in record, with no Unvibe account
            and no app access. Email support@unvibe.site to have it deleted.
          </li>
          <li>
            <strong>Feedback you send:</strong> your star rating and message, where it
            came from (the site or the app, with the page or app version), and your email
            only if you add it. Your IP address is used only in the server&apos;s memory, to
            stop repeated sends, and is not stored with your feedback.
          </li>
          <li>
            <strong>Survey answers:</strong> if you answer the short in-app survey and press Send,
            your answers, the app version and your random install ID. Kept 12 months. The team reads
            them and may use AI tools that don&apos;t train on your data to summarise them. To have
            them deleted, email support@unvibe.site with the install ID the app shows after Send.
          </li>
          <li>
            <strong>Survey answers on the web:</strong> if you answer the one-question survey at
            unvibe.site/survey and press Send, your answer, your comment if you write one, and the
            time. No name, email, install ID or account goes with it, and opening the page stores
            nothing. To limit repeated sends, a keyed hash of your network address is counted per
            hour, stored apart from your answer, and removed once it is more than a day old, at the
            counter&apos;s next clean-up. Kept 12 months, read the same way as the in-app answers.
            Because the answers are anonymous, we can&apos;t tell which one is yours to delete it on
            request.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="What Unvibe does not do">
        <ul className="list-disc space-y-2 pl-5">
          <li>It does not read your repository without an explicit action from you.</li>
          <li>It does not build its own model-training dataset from your private code.</li>
          <li>It does not log the contents of your private code in analytics.</li>
          <li>It does not perform screen recording, OCR capture, or keylogging.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Secret check, before code is sent">
        <p>
          The code you select, the nearby code Pro adds to it, and the git changes in a
          Brief are scanned on your computer before they are sent: API keys, tokens, private
          keys, database URLs with passwords, password-style{" "}
          <code className="font-mono">KEY=</code> assignments, and high-entropy strings. A
          known credential blocks the request and shows you the rule and line so you can
          remove it. A string that only looks random is shown to you first, and nothing is
          sent unless you choose Send anyway. From version 0.1.44, follow-up questions, lesson
          questions and Ask Vibe chat messages are scanned too, and an Ask Vibe message or lesson question with
          any finding is not sent. Version 0.1.43 and older do not scan what you type, so keep keys
          out of it there.
          There is no file exclusion list: a file you select or open is sent once it passes
          the scan. In a Brief, untracked files that{" "}
          <code className="font-mono">.gitignore</code> covers are left out, because the app
          asks git only for files it does not ignore.
        </p>
      </LegalSection>

      <LegalSection heading="Consent and the cloud">
        <p>
          Explanations are generated by a configured cloud AI provider, so the
          snippet you approve, after Unvibe has checked it for keys and tokens on your computer, is sent over an encrypted connection. Cloud
          analysis begins only after an explicit review action. During the beta,
          explanations are generated by Anthropic&apos;s Claude API, and{" "}
          <a href="https://www.anthropic.com/legal/commercial-terms">Anthropic&apos;s Commercial Terms</a>{" "}
          decide how it handles that data. If you add your own provider key in
          the app (Gemini, Anthropic, OpenAI, Grok, DeepSeek or Kimi), requests go to that provider under
          its terms instead. Full payload preview and per-repository controls are still
          being completed. A fully local, no-cloud mode is not available yet.
        </p>
      </LegalSection>

      <LegalSection heading="Storage, security, and your rights">
        <p>
          Your code, the explanation text and any notes you add stay on your computer. When you are
          signed in, the app also syncs a record of each explanation to our backend, under a random
          record ID: when it happened and in which time zone, whether it covered a selection, a file
          or a Git diff, the depth and outcome, how many lines, the language, the app you selected the
          code in, the file and project name, and the concept it covered.
          Row-level security is designed to restrict direct reads of those records to your account. Your auth
          token is encrypted at rest using the operating system keychain, and data is
          encrypted in transit. Backend at-rest and backup settings must be verified for
          the selected staging/production infrastructure. You can access and delete your
          data. See <a href="/data-controls">data controls</a> and{" "}
          <a href="/account-deletion">account deletion</a>. We use no advertising
          trackers.
        </p>
        <p>
          Without an account, the app sends a random install ID with each cloud explanation and with
          the usage check it makes when it starts, so we can count your free explanations. From
          version 0.1.44 it also sends your computer&apos;s system (Mac or Windows) and the app
          version. We store, under a hashed form of that ID: when the app first started, the system
          and the version it started on (from 0.1.44, stored once and never updated), how many
          explanations it has used, and when it first
          explained the setup sample, first explained your own code, and first explained code again
          on a later day of its first week. We do not store your code or prompts with it. Signed in,
          explanations carry your sign-in token instead of the install ID.
        </p>
        <p>
          From version 0.1.44, the app can also send setup progress, one message per step the first time it
          happens: setup finished, Accessibility asked for and allowed (Mac only), signed in, the
          explanation level question answered, and the question about opening Unvibe when you log in
          shown and answered yes. Each message carries the step name with the same
          random install ID, system and app version as above, never your sign-in token. We keep only
          the step and the time it arrived (for signing in, only the day), never your code, file
          names, email or IP address. A step that does not get through is sent
          again on a later launch. From version 0.1.45 this is off unless you turn it on, and updating
          to 0.1.45 switches it off once even if it was on before. Version 0.1.44 sends it until you
          switch it off. To turn it on or off, open Settings, then Privacy &amp; Data, and use Send setup
          progress (in version 0.1.44 the switch reads Send anonymous setup progress). That switch does
          not cover the install ID, dates and counts in the paragraph above, which come with requests
          the app makes anyway.
        </p>
        <p>
          If you type an answer to the optional first-run question &ldquo;Where did you hear about
          Unvibe?&rdquo; and press Continue, it is sent once to Unvibe with this install&apos;s random
          ID, even with setup progress off, and kept with the anonymous install record for 12 months
          after the install started, with any email address or phone number in it removed; leave it
          blank and nothing is sent.
        </p>
        <p>
          If you redeem a promo code at <a href="/redeem">/redeem</a>, we keep a redemption record: a
          fingerprint of the code (not the code itself), your account and its email, the months of Pro
          it added, and the dates (when you redeemed it, your Pro end date before and after, and when
          the code was switched off, if it was). We keep it while your account exists. If you delete
          your account, the record stays so the code still counts as used, but the link to your
          account and the email are removed.
        </p>
      </LegalSection>

      <LegalSection heading="This website">
        <p>
          If you press Allow on the analytics bar, unvibe.site uses Mixpanel to
          understand how visitors use the site, including page views, clicks, and session replays.
          Until you press Allow, and if you press No thanks, ignore the bar, or your browser sends
          Global Privacy Control, Mixpanel does not load. unvibe.site still keeps daily totals: how
          many times visitors pressed Allow or No thanks, how many pages were loaded and which campaign
          label (utm_source) the link that brought them carried, how many times the install scripts
          were downloaded and finished installing, and how many times each download link (Mac, Intel
          Mac or Windows) was used. Each total is just a day, a number and, for page loads and download
          links, that campaign label, with no ID, IP address, cookie, time or page address, so it
          can&apos;t be linked to you.
          The Analytics settings link at the bottom of every page changes your answer, and No thanks
          stops recording at once. Mixpanel receives your IP address with each event and uses it to
          estimate a rough location. Replays hide all page text and
          everything typed into forms. Emails, tokens, and codes (such as invite and sign-in
          codes) are removed from page addresses before they are sent. Admin pages and private
          stats links start no analytics; if you open one from another page on the site, replay
          recording stops, no analytics events from that page are sent, and the page&apos;s
          content is left out of any replay. Automated browsers send no
          analytics, and neither does a browser where you have opened any page with ?notrack=1
          added to the address; ?notrack=0 lifts that, and analytics then runs only if you pressed
          Allow. Until 2 November 2026 unvibe.site also sent the same consented analytics to PostHog:
          events, with your IP address used to estimate a rough location, and session replays with all
          page text hidden. That data stays with PostHog until we delete it, which we will do after
          exporting it. We
          use this to fix confusing pages, not to sell or share your data. The desktop
          app does not send this kind of analytics. If you join a list or request a
          download email, we store your name and email to contact you about Unvibe. The
          install scripts send one &apos;installed&apos; count to unvibe.site when they finish,
          with no ID, code or personal data. If you use the Try it box on the site,
          the code you paste is sent to Unvibe&apos;s server, which refuses common key formats, and
          then to Anthropic to write the explanation. To limit how often the box can be used,
          Unvibe keeps the time of each request and a hash of your IP address, not the code. Since
          26 October 2026 that hash is keyed with a server secret, so it can&apos;t be matched to an
          address without that secret; requests from before then kept a plain hash, which is weaker.
        </p>
        <p>
          If you tick the newsletter box, we keep your email, that you signed up through the
          newsletter form, the version of the box&apos;s wording, and when you agreed. We use it only
          for Unvibe product emails, and none have been sent yet. You can unsubscribe any time with
          the link in each email or by emailing{" "}
          <a href="mailto:support@unvibe.site">support@unvibe.site</a>. We don&apos;t sell it.
        </p>
        <p>
          The footer shows badges from product directories, served from unvibe.site. Only if you
          press Allow on the analytics bar does the Tool Index verification badge load from
          toolindex.net instead, a third-party service that then receives your IP address and browser
          details; the address of the page you are on is not sent with it. If you press No thanks, now
          or later, the copy from unvibe.site is shown.
        </p>
      </LegalSection>

      <LegalSection heading="Services we rely on">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Anthropic</strong> generates explanations with Claude. In the app, it gets the snippet you
            approve after Unvibe has checked it for keys and tokens on your computer. In the website&apos;s Try it box, it gets
            the code you paste after Unvibe&apos;s server checks it and refuses common key formats;
            nothing is checked in your browser.
          </li>
          <li><strong>Vercel</strong> hosts the website and API.</li>
          <li><strong>Supabase</strong> stores accounts and synced learning records.</li>
          <li>
            <strong>Stripe</strong> processes payments. Unvibe never sees your full card number. When you
            delete your Unvibe account, Stripe keeps its own customer and payment records, as tax and
            fraud-prevention laws require.
          </li>
          <li><strong>Resend</strong> delivers sign-in and product emails.</li>
          <li><strong>GitHub</strong> hosts the installer downloads.</li>
          <li><strong>Mixpanel</strong> measures website usage.</li>
          <li>
            <strong>PostHog</strong> still holds the website analytics and replays recorded until 2 November
            2026, until we delete them; the site no longer sends it anything.
          </li>
          <li>
            <strong>Tool Index (toolindex.net)</strong> serves its verification badge in the footer,
            only after you press Allow on the analytics bar.
          </li>
          <li>
            <strong>Google Fonts.</strong> Desktop app versions 0.1.49 and earlier load their fonts from Google
            (fonts.googleapis.com and fonts.gstatic.com) when the explanation window or companion opens. That
            request gives Google your IP address and your device&apos;s browser details, such as the operating
            system and app version. From version 0.1.50 (coming soon), the fonts are built into the app, so it
            makes no request to Google.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          Unvibe is for people 18 or older, as our <a href="/terms">Terms</a> say. Try it on this
          site, and the app from version 0.1.45, ask you to confirm it before any of your own code is
          sent, and the sign-in page asks before you sign in. We do
          not knowingly collect personal information from anyone younger.
          If you believe someone under 18 has given us data, email us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <p>
          We will update this page when the product changes how it handles data, and note
          the date at the top. Questions or requests go to{" "}
          <a href="mailto:support@unvibe.site">support@unvibe.site</a>.
        </p>
      </LegalSection>

      <LegalSection heading="Platforms and scope">
        <p>
          The Unvibe beta runs on Mac (Apple silicon and Intel) and Windows x64. Linux is not available yet. We claim no
          security certifications. Explanations are a learning aid, not a security audit.
          See the <a href="/terms">terms</a> for the AI limitations disclaimer.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
