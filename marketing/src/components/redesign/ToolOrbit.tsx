import Image from "next/image";
import { Terminal } from "lucide-react";

const tools = [
  { name: "Cursor", state: "Validated", src: "/tools/cursor.svg" },
  { name: "VS Code", state: "Validated", src: "/tools/vscode.svg" },
  { name: "JetBrains", state: "Testing", src: "/tools/jetbrains.svg" },
  { name: "Claude Code", state: "Workflow", src: "/tools/claude.svg" },
  { name: "GitHub", state: "Project context", src: "/tools/github.svg" },
] as const;

export function ToolOrbit() {
  return (
    <div className="tool-orbit" aria-label="Unvibe developer tool compatibility">
      <div className="tool-orbit__halo tool-orbit__halo--outer" aria-hidden="true" />
      <div className="tool-orbit__halo tool-orbit__halo--inner" aria-hidden="true" />
      <div className="tool-orbit__core">
        <Image src="/brand/icon.png" alt="" width={54} height={54} />
        <span>Unvibe</span>
        <small>one shortcut</small>
      </div>
      <div className="tool-orbit__track">
        {tools.map((tool, index) => (
          <div
            className="tool-orbit__node"
            style={{ "--orbit-index": index } as React.CSSProperties}
            key={tool.name}
          >
            <div>
              <Image src={tool.src} alt="" width={30} height={30} />
              <span><b>{tool.name}</b><small>{tool.state}</small></span>
            </div>
          </div>
        ))}
        <div
          className="tool-orbit__node"
          style={{ "--orbit-index": 5 } as React.CSSProperties}
        >
          <div>
            <Terminal size={26} aria-hidden="true" />
            <span><b>Terminal</b><small>Workflow</small></span>
          </div>
        </div>
      </div>
    </div>
  );
}
