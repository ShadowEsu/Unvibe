"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, ArrowRight, GraduationCap } from "lucide-react";
import { Section } from "../Section";
import { cn } from "@/lib/utils";
import { durations, easing } from "@/lib/motion";

interface Project {
  id: string;
  name: string;
  files: string[];
  curriculum: { title: string; concept: string }[];
}

const projects: Project[] = [
  {
    id: "chat-app",
    name: "realtime-chat",
    files: ["socket.ts", "useMessages.ts", "authGuard.ts", "schema.sql"],
    curriculum: [
      { title: "How the WebSocket connection stays alive", concept: "sockets" },
      { title: "Subscribing to messages with a custom hook", concept: "react hooks" },
      { title: "Guarding routes with middleware", concept: "auth" },
      { title: "Modeling threads and members in SQL", concept: "schema design" },
    ],
  },
  {
    id: "api-service",
    name: "payments-api",
    files: ["router.py", "webhooks.py", "retry.py", "models.py"],
    curriculum: [
      { title: "Routing and validating requests in FastAPI", concept: "web frameworks" },
      { title: "Verifying and handling webhooks safely", concept: "webhooks" },
      { title: "Retries with backoff and idempotency", concept: "reliability" },
      { title: "Shaping records with typed models", concept: "data modeling" },
    ],
  },
  {
    id: "cli-tool",
    name: "build-cli",
    files: ["main.rs", "parser.rs", "cache.rs"],
    curriculum: [
      { title: "Parsing arguments and subcommands", concept: "parsing" },
      { title: "Ownership across the build pipeline", concept: "ownership" },
      { title: "Caching results without data races", concept: "concurrency" },
    ],
  },
];

export function StudyFromProjects() {
  const [active, setActive] = useState(projects[0].id);
  const project = projects.find((p) => p.id === active) ?? projects[0];

  return (
    <Section
      id="study"
      eyebrow="Study from projects"
      title="Turn a codebase you use into a course you can follow."
      subtitle="Point Unvibe at a project and it proposes a short curriculum grounded in that project's real files — so you learn the concepts that actually show up in your work."
    >
      <div className="mb-7 flex flex-wrap gap-2">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            aria-pressed={p.id === active}
            className={cn(
              "flex items-center gap-2 rounded-pill border px-4 py-2.5 font-mono text-fluid-sm font-medium transition-all duration-200",
              p.id === active
                ? "border-primary bg-primary text-on-primary shadow-sm"
                : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
            )}
          >
            <Folder size={14} aria-hidden="true" />
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1.4fr]">
        {/* Project files */}
        <div className="rounded-card border border-line bg-surface p-6">
          <p className="mb-4 flex items-center gap-2 text-fluid-sm font-medium text-fg">
            <Folder size={15} className="text-fg-faint" aria-hidden="true" />
            {project.name}
          </p>
          <ul className="space-y-1.5 font-mono text-[0.8rem] text-fg-muted">
            {project.files.map((f) => (
              <li key={f} className="rounded-lg px-2.5 py-1.5 hover:bg-surface-2">
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-primary lg:rotate-0">
            <ArrowRight size={18} aria-hidden="true" />
          </span>
        </div>

        {/* Curriculum */}
        <div className="rounded-card border border-line bg-surface p-6">
          <p className="mb-4 flex items-center gap-2 text-fluid-sm font-medium text-fg">
            <GraduationCap size={16} className="text-primary" aria-hidden="true" />
            Proposed curriculum
          </p>
          <AnimatePresence mode="wait">
            <motion.ol
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: durations.standardFast, ease: easing.calm }}
              className="space-y-2.5"
            >
              {project.curriculum.map((lesson, i) => (
                <li
                  key={lesson.title}
                  className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-[0.72rem] font-medium text-fg-muted">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-fluid-sm text-fg">{lesson.title}</p>
                    <span className="mt-1 inline-block rounded-pill bg-primary-soft px-2 py-0.5 font-mono text-[0.64rem] text-primary">
                      {lesson.concept}
                    </span>
                  </div>
                </li>
              ))}
            </motion.ol>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}
