"use client";

import { useId, useState, type FormEvent } from "react";
import {
  WEB_SURVEY_COMMENT_LABEL,
  WEB_SURVEY_MAX_COMMENT,
  WEB_SURVEY_OPTIONS,
  WEB_SURVEY_QUESTION,
  type WebSurveyAnswer,
} from "@/lib/webSurveyText";

/**
 * The /survey form. Picking an answer only selects it; nothing leaves the page until Send (Security
 * W1). No analytics calls here: the page promises no tracking beyond the answer (W4).
 */
export function WebSurveyForm() {
  const id = useId();
  const [answer, setAnswer] = useState<WebSurveyAnswer | "">("");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!answer) {
      setError("Pick one of the answers first.");
      return;
    }
    setState("busy");
    setError("");
    try {
      const response = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, comment }),
      });
      if (response.status === 201) {
        setState("done");
        return;
      }
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Couldn't save that just now. Try again in a minute.");
    } catch {
      setError("Couldn't reach unvibe.site. Check your connection and try again.");
    }
    setState("idle");
  };

  if (state === "done") {
    return (
      <div className="survey-done" role="status">
        <p><strong>Sent. Thank you.</strong></p>
        <p>That&apos;s everything. You can close this page.</p>
      </div>
    );
  }

  return (
    <form className="survey-form" onSubmit={submit} noValidate>
      <fieldset aria-describedby={error ? `${id}-error` : undefined}>
        <legend>{WEB_SURVEY_QUESTION}</legend>
        {WEB_SURVEY_OPTIONS.map((option) => (
          <label key={option.id} className="survey-option">
            <input
              type="radio"
              name={`${id}-answer`}
              value={option.id}
              checked={answer === option.id}
              onChange={() => setAnswer(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="survey-comment" htmlFor={`${id}-comment`}>{WEB_SURVEY_COMMENT_LABEL}</label>
      <textarea
        id={`${id}-comment`}
        rows={4}
        maxLength={WEB_SURVEY_MAX_COMMENT}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error ? <p className="survey-error" id={`${id}-error`} role="alert">{error}</p> : null}
      <button type="submit" className="paper-join paper-join--win" disabled={state === "busy"}>
        <span className="paper-join__label">{state === "busy" ? "Sending…" : "Send"}</span>
      </button>
    </form>
  );
}
