"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, RotateCcw } from "lucide-react";
import { Section } from "../Section";
import { CodeCard } from "../CodeCard";
import { cn } from "@/lib/utils";
import { examples } from "@/lib/examples";

// A short, self-contained quiz drawn from the curated examples. No signup, no scoring
// stored — it just demonstrates the comprehension-check experience.
const quiz = ["debounce", "sql-join", "useeffect"]
  .map((id) => examples.find((e) => e.id === id))
  .filter((e): e is (typeof examples)[number] => Boolean(e));

export function Assessment() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const item = quiz[index];
  const answered = selected !== null;
  const isCorrect = answered && selected === item.comprehension.answerIndex;

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
    if (i === item.comprehension.answerIndex) {
      setCorrectCount((c) => c + 1);
    }
  };

  const next = () => {
    if (index + 1 >= quiz.length) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setDone(false);
    setCorrectCount(0);
  };

  return (
    <Section
      eyebrow="Try it yourself"
      title="A comprehension check, no account required."
      subtitle="This is the same kind of question Unvibe asks after an explanation. Read the code, pick an answer, and see how it reads a correct or missed response."
      narrow
      variant="standard"
    >
      <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
        {done ? (
          <div className="text-center">
            <p className="text-fluid-2xl font-semibold text-fg">
              {correctCount} / {quiz.length}
            </p>
            <p className="mt-2 text-fluid-base text-fg-muted">
              {correctCount === quiz.length
                ? "Every one. This is exactly the loop Unvibe keeps running as you work."
                : "Nice — and this is the point: the misses are where real understanding gets built."}
            </p>
            <button
              onClick={restart}
              className="mt-6 inline-flex items-center gap-2 rounded-pill border border-line px-4 py-2 text-fluid-sm text-fg hover:bg-surface-2"
            >
              <RotateCcw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between text-fluid-sm text-fg-faint">
              <span>
                Question {index + 1} of {quiz.length}
              </span>
              <span className="font-mono">{item.chip}</span>
            </div>

            <CodeCard
              code={item.code}
              language={item.language}
              showLineNumbers={false}
              className="mb-5"
            />

            <p className="mb-4 text-fluid-lg font-medium text-fg">
              {item.comprehension.question}
            </p>

            <div className="flex flex-col gap-2">
              {item.comprehension.options.map((opt, i) => {
                const isAnswer = i === item.comprehension.answerIndex;
                const isPicked = selected === i;
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelect(i)}
                    disabled={answered}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-fluid-base transition-colors duration-micro",
                      !answered && "border-line hover:border-line-strong hover:bg-surface-2",
                      answered && isAnswer && "border-green/50 bg-green/10 text-green",
                      answered &&
                        isPicked &&
                        !isAnswer &&
                        "border-red/50 bg-red/10 text-red",
                      answered && !isAnswer && !isPicked && "border-line opacity-60"
                    )}
                  >
                    <span>{opt}</span>
                    {answered && isAnswer && <Check size={16} aria-hidden="true" />}
                    {answered && isPicked && !isAnswer && (
                      <X size={16} aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {answered && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-4">
                    <p className="text-fluid-sm font-medium text-fg">
                      {isCorrect ? "Correct." : "Not quite."}
                    </p>
                    <p className="mt-1 text-fluid-sm leading-relaxed text-fg-muted">
                      {item.comprehension.explanation}
                    </p>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={next}
                      className="rounded-pill bg-primary px-5 py-2 text-fluid-sm font-medium text-on-primary hover:bg-primary-strong"
                    >
                      {index + 1 >= quiz.length ? "See result" : "Next question"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Section>
  );
}
