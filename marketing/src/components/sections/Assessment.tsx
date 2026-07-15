"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, RotateCcw } from "lucide-react";
import { Section } from "../Section";
import { CodeCard } from "../CodeCard";
import { cn } from "@/lib/utils";
import { examples } from "@/lib/examples";

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
      id="assessment"
      eyebrow="Try it yourself"
      title="A comprehension check, no account required."
      subtitle="This is the same kind of question Unvibe asks after an explanation. Read the code, pick an answer, and see how it reads a correct or missed response."
      narrow
    >
      <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <p className="text-fluid-2xl font-semibold text-fg">
              {correctCount} / {quiz.length}
            </p>
            <p className="mt-3 text-fluid-base text-fg-muted">
              {correctCount === quiz.length
                ? "Every one. This is exactly the loop Unvibe keeps running as you work."
                : "Nice — and this is the point: the misses are where real understanding gets built."}
            </p>
            <button
              onClick={restart}
              className="mt-7 inline-flex items-center gap-2 rounded-pill border border-line px-5 py-2.5 text-fluid-sm text-fg transition-colors hover:bg-surface-2"
            >
              <RotateCcw size={15} aria-hidden="true" /> Try again
            </button>
          </motion.div>
        ) : (
          <div>
            <div className="mb-5 flex items-center justify-between text-fluid-sm text-fg-faint">
              <span>
                Question {index + 1} of {quiz.length}
              </span>
              <span className="font-mono">{item.chip}</span>
            </div>

            <CodeCard
              code={item.code}
              language={item.language}
              showLineNumbers={false}
              className="mb-6"
            />

            <p className="mb-5 text-fluid-lg font-medium text-fg">
              {item.comprehension.question}
            </p>

            <div className="flex flex-col gap-2.5">
              {item.comprehension.options.map((opt, i) => {
                const isAnswer = i === item.comprehension.answerIndex;
                const isPicked = selected === i;
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelect(i)}
                    disabled={answered}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-4 py-3.5 text-left text-fluid-base transition-all duration-200",
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
                  <div className="mt-5 rounded-xl border border-line bg-surface-2/60 p-5">
                    <p className="text-fluid-sm font-medium text-fg">
                      {isCorrect ? "Correct." : "Not quite."}
                    </p>
                    <p className="mt-1.5 text-fluid-sm leading-relaxed text-fg-muted">
                      {item.comprehension.explanation}
                    </p>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button
                      onClick={next}
                      className="rounded-pill bg-primary px-6 py-2.5 text-fluid-sm font-medium text-on-primary transition-colors hover:bg-primary-strong"
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
