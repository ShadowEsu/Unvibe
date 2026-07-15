"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const shots = [
  { id: "progress", label: "Progress", caption: "What you actually understood" },
  { id: "projects", label: "Projects", caption: "Repos mapped to concepts" },
  { id: "study", label: "Study", caption: "Curriculum from real code" },
  { id: "notebook", label: "Notebook", caption: "Saved explanations" },
] as const;

export function OpeningStrip() {
  return (
    <section className="container-page py-14 sm:py-20" aria-label="Product screens">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-pill border border-primary/20 bg-primary-soft px-3.5 py-1 text-fluid-sm font-medium tracking-wide text-primary">
            See the product
          </span>
          <h2 className="mt-2 text-fluid-xl font-semibold tracking-tight text-fg">
            Overlay in the editor. Companion for everything you keep.
          </h2>
        </div>
        <p className="max-w-md text-fluid-sm leading-relaxed text-fg-muted">
          Unvibe is not another course catalog. It turns the code you already
          wrote — or your agent wrote — into explanations, checks, and a
          knowledge trail.
        </p>
      </div>

      <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shots.map((shot, i) => (
          <motion.figure
            key={shot.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{
              duration: 0.5,
              delay: i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="w-[min(78vw,22rem)] shrink-0 snap-start overflow-hidden rounded-card border border-line bg-surface shadow-soft"
          >
            <Image
              src={`/unvibe/${shot.id}-light.webp`}
              alt={`${shot.label} screen`}
              width={836}
              height={941}
              className="h-auto w-full"
              sizes="(max-width: 768px) 78vw, 22rem"
              priority={i < 2}
            />
            <figcaption className="border-t border-line px-5 py-4">
              <p className="text-fluid-sm font-medium text-fg">{shot.label}</p>
              <p className="text-fluid-sm text-fg-muted">{shot.caption}</p>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
