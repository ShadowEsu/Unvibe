import test from "node:test";
import assert from "node:assert/strict";
import { cleanText, feedbackSchema, wordCount } from "./feedback";

test("word count ignores extra spaces", () => {
  assert.equal(wordCount("  hello   there  "), 2);
  assert.equal(wordCount(""), 0);
});

test("feedback accepts stars and a short note", () => {
  const parsed = feedbackSchema.safeParse({ rating: 5, message: "Love it" });
  assert.ok(parsed.success);
});

test("feedback rejects bad ratings, long notes and filled honeypots", () => {
  assert.equal(feedbackSchema.safeParse({ rating: 0 }).success, false);
  assert.equal(feedbackSchema.safeParse({ rating: 6 }).success, false);
  assert.equal(feedbackSchema.safeParse({ rating: 3, message: Array(101).fill("word").join(" ") }).success, false);
  assert.equal(feedbackSchema.safeParse({ rating: 3, website: "spam.example" }).success, false);
});

test("cleanText strips control characters", () => {
  assert.equal(cleanText("hi\u0000 there\n\nfriend"), "hi there friend");
});
