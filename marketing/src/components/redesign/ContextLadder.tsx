"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAutoAdvance } from "@/lib/useAutoAdvance";

const context = [
  { name: "Line", title: "What the expression does", body: "Loads the saved draft for the active item, or starts empty." },
  { name: "Function", title: "How data enters and exits", body: "The item ID enters the hook; draft state and its setter come back." },
  { name: "File", title: "What this module owns", body: "Editor draft state is isolated from the visual editor component." },
  { name: "Dependency", title: "What React is responsible for", body: "React reruns the synchronization effect after the ID changes." },
  { name: "Git change", title: "Why the change exists", body: "The new hook prevents one document's draft appearing in another and keeps the change impact aligned." },
  { name: "Project", title: "Where the impact travels", body: "This sits between the editor UI and the project's client-side cache." },
  { name: "Concept", title: "What to learn next", body: "Effect dependencies connect the line, change, project, and architectural impact." },
] as const;

export function ContextLadder() {
  const { active, cycle, rootRef, select } = useAutoAdvance(context.length, 0);
  return (
    <div className="context-ladder" ref={rootRef}>
      <div className="context-rail" role="tablist" aria-label="Code context depth">
        {context.map((item, index) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            id={`context-tab-${index}`}
            aria-selected={active === index}
            aria-controls="context-panel"
            onClick={() => select(index)}
          >
            <i aria-hidden="true" />
            <span>{item.name}</span>
            {active === index && <b className="auto-progress" key={`${item.name}-${cycle}`} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="context-card" id="context-panel" role="tabpanel" aria-labelledby={`context-tab-${active}`} aria-live="polite">
        <span className="context-count">{String(active + 1).padStart(2, "0")} / 07</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="context-copy"
            key={context[active].name}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.34, ease: [0.2, 0, 0.2, 1] }}
          >
            <span className="pixel-label">{context[active].name}</span>
            <h3>{context[active].title}</h3>
            <p>{context[active].body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="context-mini-map" aria-hidden="true">
          {context.map((_, index) => <i key={index} className={index <= active ? "on" : ""} />)}
        </div>
      </div>
    </div>
  );
}
