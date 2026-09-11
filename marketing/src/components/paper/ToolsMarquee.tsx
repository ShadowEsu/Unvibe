"use client";

const apps = [
  { name: "Cursor", src: "/tools/cursor.svg" },
  { name: "VS Code", src: "/tools/vscode.svg" },
  { name: "JetBrains", src: "/tools/jetbrains.svg" },
  { name: "Terminal", src: "/tools/terminal.svg" },
  { name: "Claude Code", src: "/tools/claude.svg" },
  { name: "Codex", src: "/tools/codex.svg" },
];

export function ToolsMarquee() {
  const loop = [...apps, ...apps];
  return (
    <section className="paper-section" aria-label="Apps Unvibe works beside">
      <div className="paper-wrap paper-center">
        <p className="paper-meta">Works in the apps you already write in</p>
      </div>
      <div className="paper-marquee mt-8">
        <div className="paper-marquee__track">
          {loop.map((app, index) => (
            <div
              className={`paper-marquee__item${index >= apps.length ? " paper-marquee__dup" : ""}`}
              key={`${app.name}-${index}`}
              aria-hidden={index >= apps.length ? true : undefined}
            >
              <img src={app.src} alt="" />
              <span>{app.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
