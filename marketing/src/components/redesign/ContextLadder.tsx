"use client";

import { useState } from "react";

const context = [
  { name: "Line", title: "What the expression does", body: "Loads the saved draft for the active item, or starts empty." },
  { name: "Function", title: "How data enters and exits", body: "The item ID enters the hook; draft state and its setter come back." },
  { name: "File", title: "What this module owns", body: "Editor draft state is isolated from the visual editor component." },
  { name: "Dependency", title: "What React is responsible for", body: "React reruns the synchronization effect after the ID changes." },
  { name: "Git change", title: "Why the agent changed it", body: "The new hook prevents one document's draft appearing in another." },
  { name: "Project", title: "Where it fits", body: "This sits between the editor UI and the project's client-side cache." },
  { name: "Concept", title: "What to learn next", body: "Review effect dependencies and external-store synchronization." },
] as const;

export function ContextLadder() {
  const [active, setActive] = useState(0);
  return (
    <div className="context-ladder">
      <div className="context-rail" role="tablist" aria-label="Code context depth">
        {context.map((item, index) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls="context-panel"
            onClick={() => setActive(index)}
          >
            <i aria-hidden="true" />
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <div className="context-card" id="context-panel" role="tabpanel" aria-live="polite">
        <span className="context-count">{String(active + 1).padStart(2, "0")} / 07</span>
        <span className="pixel-label">{context[active].name}</span>
        <h3>{context[active].title}</h3>
        <p>{context[active].body}</p>
        <div className="context-mini-map" aria-hidden="true">
          {context.map((_, index) => <i key={index} className={index <= active ? "on" : ""} />)}
        </div>
      </div>
    </div>
  );
}
