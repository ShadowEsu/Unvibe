import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { pageMetadata } from "@/lib/pageMeta";
import { licenseParagraphs, THIRD_PARTY_NOTICES } from "@/lib/thirdPartyNotices";

export const metadata: Metadata = pageMetadata({
  path: "/licenses",
  title: "Open-source notices",
  description: "Licences for the open-source code that unvibe.site sends to your browser.",
});

export default function LicensesPage() {
  return (
    <LegalLayout
      title="Open-source notices"
      updated="November 2026"
      intro="unvibe.site uses this open-source code. Its licence notice is below."
      summarizes={false}
    >
      {THIRD_PARTY_NOTICES.map((notice) => (
        <LegalSection key={notice.name} heading={`${notice.name} ${notice.version}`}>
          <p>
            {notice.use} Source: <a href={notice.url}>{notice.url.replace(/^https:\/\//, "")}</a>
          </p>
          {licenseParagraphs(notice.license).map((paragraph) => (
            <p key={paragraph} className="break-words font-mono text-sm leading-relaxed">
              {paragraph}
            </p>
          ))}
        </LegalSection>
      ))}
    </LegalLayout>
  );
}
