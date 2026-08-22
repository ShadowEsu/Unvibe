"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAutoAdvance } from "@/lib/useAutoAdvance";

const levels = [
  {
    name: "First time",
    lead: "This runs a small piece of code after something changes.",
    detail: "Here, it watches the item ID. When you open another item, it loads that saved draft.",
    lens: "Plain language",
  },
  {
    name: "Beginner",
    lead: "useEffect synchronizes the draft state with the selected ID.",
    detail: "The dependency array contains id, so React reruns this effect whenever id changes.",
    lens: "Syntax + behavior",
  },
  {
    name: "Intermediate",
    lead: "The hook derives local editor state from an external cache entry.",
    detail: "Changing id triggers a cache lookup, then schedules a state update and another render.",
    lens: "Execution flow",
  },
  {
    name: "Advanced",
    lead: "This effect mirrors an external store into component-local state.",
    detail: "That split ownership can drift if cache mutations happen without an id change; a subscription may be safer.",
    lens: "Architecture",
  },
  {
    name: "Expert",
    lead: "The effect is an imperative synchronization boundary with incomplete invalidation.",
    detail: "Its dependency models identity but not cache versioning. Consider useSyncExternalStore or an explicit snapshot contract.",
    lens: "Tradeoffs",
  },
] as const;

export function LevelLab() {
  const { active, cycle, rootRef, select } = useAutoAdvance(levels.length, 1);
  const level = levels[active];

  return (
    <div className="level-lab" ref={rootRef}>
      <div className="level-tabs" role="tablist" aria-label="Explanation level">
        {levels.map((item, index) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            id={`level-tab-${index}`}
            aria-selected={active === index}
            aria-controls="level-panel"
            onClick={() => select(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>{item.name}
            {active === index && <i className="auto-progress" key={`${item.name}-${cycle}`} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="level-window" id="level-panel" role="tabpanel" aria-labelledby={`level-tab-${active}`} aria-live="polite">
        <div className="level-code">
          <span>03&nbsp;&nbsp;<strong>useEffect</strong>(() =&gt; {'{'}</span>
          <span className="selection">04&nbsp;&nbsp;&nbsp;&nbsp;setDraft(cache.get(id) ?? &apos;&apos;);</span>
          <span>05&nbsp;&nbsp;{'}'}, [<strong>id</strong>]);</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="level-copy"
            key={level.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0.2, 1] }}
          >
            <span className="pixel-label">{level.lens}</span>
            <h3>{level.lead}</h3>
            <p>{level.detail}</p>
            <div className="level-foot"><span>Depth {active + 1}/5</span><span>{level.name} · advances in 3s</span></div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
