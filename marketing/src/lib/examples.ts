/**
 * Curated code examples used by the interactive demo sections.
 *
 * Each example carries the code, the concepts it touches, an explanation written at
 * five depths (matching the product's New / Beginner / Intermediate / Advanced / Expert
 * ladder), and one comprehension question. Copy is original and factual — it teaches the
 * snippet, it does not oversell the product.
 */

export type Depth =
  | "new"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export const depthOrder: Depth[] = [
  "new",
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];

export const depthLabels: Record<Depth, string> = {
  new: "New to code",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export interface Comprehension {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface CodeExample {
  id: string;
  title: string;
  language: string;
  /** Short label shown on the selector chip. */
  chip: string;
  concepts: string[];
  code: string;
  /** One line summary of what the code does. */
  summary: string;
  explanations: Record<Depth, string>;
  comprehension: Comprehension;
}

export const examples: CodeExample[] = [
  {
    id: "debounce",
    title: "A debounce helper",
    language: "typescript",
    chip: "Debounce",
    concepts: ["closures", "higher order functions", "timers"],
    summary:
      "Delays running a function until the caller stops invoking it for a set time.",
    code: `function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait = 300
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}`,
    explanations: {
      new: "This waits until you stop doing something before it reacts. Imagine typing in a search box: instead of searching on every keystroke, it waits until you pause, then searches once.",
      beginner:
        "debounce takes your function and returns a new version of it. Every time you call the new version it resets a countdown. Only when the countdown finishes without interruption does your original function actually run.",
      intermediate:
        "The returned function keeps a reference to timer in a closure. Each call clears the pending timeout and schedules a fresh one, so only the final call within the wait window fires. This throttles bursty events like keystrokes or resize.",
      advanced:
        "State lives in the closure rather than on the instance, so each debounced function is independent. Parameters<T> preserves the argument types of the wrapped function, and clearTimeout guards against overlapping schedules. Note it has no cancel or flush method and always drops the trailing return value.",
      expert:
        "This is the trailing-edge only variant. There is no leading-edge invocation, no maxWait ceiling, and no returned promise, so long bursts can starve the callback indefinitely. The any[] on the constraint widens inference; a stricter signature or a cancel handle would make it composable in a resource-cleanup path.",
    },
    comprehension: {
      question:
        "If you call the debounced function five times in quick succession within the wait window, how many times does fn run?",
      options: ["Five times", "Once, after the last call", "Zero times", "Twice"],
      answerIndex: 1,
      explanation:
        "Each call clears the previous timer, so only the final call survives to fire fn once the wait elapses.",
    },
  },
  {
    id: "useeffect",
    title: "A data-fetching effect",
    language: "tsx",
    chip: "useEffect",
    concepts: ["react hooks", "effects", "cleanup", "race conditions"],
    summary:
      "Fetches data when an id changes and ignores stale responses on cleanup.",
    code: `useEffect(() => {
  let active = true;
  setLoading(true);
  fetchUser(id)
    .then((data) => {
      if (active) setUser(data);
    })
    .finally(() => {
      if (active) setLoading(false);
    });
  return () => {
    active = false;
  };
}, [id]);`,
    explanations: {
      new: "When the id changes, this goes and gets the matching user. If you switch to a different id before the first one finishes, it quietly ignores the old answer so the screen shows the right person.",
      beginner:
        "The effect runs whenever id changes. It fetches the user and, when the request finishes, updates state. The returned function runs before the next effect and flips a flag so a late response cannot overwrite newer data.",
      intermediate:
        "This is the standard fix for a fetch race condition. The active flag, captured per render, is set false in cleanup. Because effects clean up before re-running, an in-flight request from a previous id can resolve but its setUser call is skipped.",
      advanced:
        "The dependency array [id] ties the effect lifecycle to id. Cleanup runs on unmount and before each re-run, guaranteeing at most one live request wins. It does not abort the network call — an AbortController would cancel the request itself rather than just discarding the result.",
      expert:
        "Correct trailing-write guard, but the request still completes and consumes bandwidth; pair it with an AbortController for true cancellation. There is also no error branch, so a rejected promise leaves loading stuck unless finally covers it — here finally does, but the error is swallowed. Consider surfacing it to an error boundary or state.",
    },
    comprehension: {
      question: "What problem does the active flag primarily prevent?",
      options: [
        "Memory leaks from timers",
        "A stale response overwriting newer data",
        "Fetching too often",
        "Rendering twice",
      ],
      answerIndex: 1,
      explanation:
        "If id changes mid-request, cleanup sets active to false so the older response is discarded instead of overwriting the current user.",
    },
  },
  {
    id: "python-api",
    title: "A FastAPI endpoint",
    language: "python",
    chip: "Python API",
    concepts: ["async", "web frameworks", "dependency injection", "validation"],
    summary:
      "An async route that validates input and reads from a database dependency.",
    code: `@app.get("/users/{user_id}")
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = await db.fetch_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Not found")
    return UserOut.model_validate(user)`,
    explanations: {
      new: "This is one address on a web server. When someone visits it with a user number, the server looks that user up and sends their details back, or says not found.",
      beginner:
        "The decorator maps the URL to this function. user_id comes from the path, db is provided automatically. It awaits the database, returns a 404 if nobody matches, otherwise sends back a validated response object.",
      intermediate:
        "Depends(get_db) is dependency injection: FastAPI resolves and supplies the session, which keeps the handler testable. async lets the server handle other requests while awaiting the DB. UserOut.model_validate shapes and filters the output schema.",
      advanced:
        "The path parameter is coerced to int by FastAPI, so a non-numeric id returns 422 before the handler runs. The dependency's lifecycle is managed by FastAPI, enabling per-request sessions and clean teardown. model_validate enforces the response contract, preventing accidental leakage of internal fields.",
      expert:
        "Clean separation of transport, persistence, and serialization. Watch that get_db yields and closes correctly to avoid connection leaks under load, and that fetch_user is genuinely non-blocking — a sync driver here would block the event loop. Consider response_model on the decorator for OpenAPI accuracy rather than validating inline.",
    },
    comprehension: {
      question: "What does Depends(get_db) accomplish?",
      options: [
        "It caches the response",
        "It injects a database session managed by the framework",
        "It validates the user id",
        "It sets the status code",
      ],
      answerIndex: 1,
      explanation:
        "Depends declares a dependency; FastAPI resolves get_db and passes the resulting session into the handler for the duration of the request.",
    },
  },
  {
    id: "sql-join",
    title: "A grouped join",
    language: "sql",
    chip: "SQL join",
    concepts: ["joins", "aggregation", "grouping", "left join"],
    summary:
      "Counts orders per customer, including customers with zero orders.",
    code: `SELECT c.id, c.name, COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o
  ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY order_count DESC;`,
    explanations: {
      new: "This makes a list of every customer next to how many orders they have placed. Customers who never ordered still appear, with a count of zero.",
      beginner:
        "It joins customers to their orders, groups the rows by customer, and counts the orders in each group. LEFT JOIN keeps customers even when there are no matching orders.",
      intermediate:
        "COUNT(o.id) counts non-null order ids, so customers with no orders correctly show 0 rather than 1. An INNER JOIN would drop those customers entirely. GROUP BY must include every non-aggregated selected column.",
      advanced:
        "Counting o.id rather than * is deliberate: with a LEFT JOIN, unmatched rows produce a null o.id that COUNT skips, yielding zero. Index customer_id on orders to make the join efficient; the ORDER BY forces a sort of the aggregated result set.",
      expert:
        "Semantically correct zero-inclusive counts. On large tables consider a covering index on orders(customer_id) and, if you only need top customers, a LIMIT with the sort. Grouping by c.id alone is valid when id is the primary key on most engines, but listing c.name keeps it portable across strict GROUP BY modes.",
    },
    comprehension: {
      question: "Why COUNT(o.id) instead of COUNT(*) here?",
      options: [
        "It is faster",
        "So customers with no orders count as 0, not 1",
        "COUNT(*) is invalid in SQL",
        "It sorts the results",
      ],
      answerIndex: 1,
      explanation:
        "With a LEFT JOIN, unmatched customers have a null o.id. COUNT ignores nulls, so those customers show 0, while COUNT(*) would count the joined row as 1.",
    },
  },
  {
    id: "express-middleware",
    title: "Express auth middleware",
    language: "javascript",
    chip: "Middleware",
    concepts: ["middleware", "request pipeline", "tokens", "next()"],
    summary:
      "Checks a bearer token and either attaches the user or rejects the request.",
    code: `function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace(/^Bearer /, "");
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = user;
  next();
}`,
    explanations: {
      new: "This is a gatekeeper. Before a request reaches the real page, it checks for a valid pass. No pass, no entry. With a pass, it lets the request continue and remembers who you are.",
      beginner:
        "Middleware runs between the request arriving and your route handler. It reads the token from the header, verifies it, and either responds with 401 or calls next() to pass control along, having attached the user.",
      intermediate:
        "The key contract is next(): calling it continues the chain, returning a response short-circuits it. Because it sets req.user, downstream handlers can trust the identity. Note it returns early on failure so next() is not also called.",
      advanced:
        "verifyToken is assumed synchronous here; an async verifier would need await plus try/catch, and errors should be forwarded with next(err) to the error middleware rather than thrown. The regex strip is naive — it will not reject a malformed scheme, only remove a leading Bearer prefix.",
      expert:
        "Solid pipeline hygiene, but tighten the token parse: split on whitespace and validate the scheme to avoid accepting a raw token without Bearer. Prefer constant-time verification inside verifyToken, avoid leaking whether the token was missing versus invalid, and centralize the 401 shape so clients get a consistent contract.",
    },
    comprehension: {
      question: "What happens if next() is never called and no response is sent?",
      options: [
        "The next route runs anyway",
        "The request hangs until it times out",
        "Express retries the request",
        "It returns 200 automatically",
      ],
      answerIndex: 1,
      explanation:
        "Express relies on either next() advancing the chain or a response ending it. If neither happens, the request is left open and eventually times out.",
    },
  },
  {
    id: "type-guard",
    title: "A TypeScript type guard",
    language: "typescript",
    chip: "Type guard",
    concepts: ["type narrowing", "predicates", "unknown", "runtime checks"],
    summary:
      "Narrows an unknown value to a typed shape at runtime and for the compiler.",
    code: `interface User {
  id: number;
  email: string;
}

function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as User).id === "number" &&
    "email" in value &&
    typeof (value as User).email === "string"
  );
}`,
    explanations: {
      new: "This checks whether some mystery data really looks like a user before your code trusts it. It confirms the pieces are there and are the right kind.",
      beginner:
        "It takes an unknown value and returns true or false. The value is User return type tells TypeScript that when it returns true, the value can be treated as a User for the rest of that branch.",
      intermediate:
        "This is a user-defined type guard. The predicate value is User narrows the type in the calling scope, so after an if (isUser(x)) check you get full autocomplete and type safety without casts. It validates both structure and primitive types.",
      advanced:
        "Because the input is unknown, every access is guarded before the cast. The in operator plus typeof checks defend against null and wrong primitive types. It does not deep-validate email format or reject extra properties, and the casts are only for reading — the runtime checks are what make the predicate sound.",
      expert:
        "A reasonable hand-rolled guard, but hand-written predicates drift from the interface over time. For anything beyond trivial shapes prefer a schema validator (zod, valibot) that derives both the type and the runtime check from one source, eliminating the risk that isUser and User diverge silently.",
    },
    comprehension: {
      question: "What does the return type value is User add beyond a boolean?",
      options: [
        "Nothing, it is decorative",
        "It tells the compiler to narrow value's type when true",
        "It throws if the check fails",
        "It converts value into a User",
      ],
      answerIndex: 1,
      explanation:
        "The predicate return type is a type guard: on a true result TypeScript narrows the value to User in that branch, enabling safe typed access.",
    },
  },
  {
    id: "recursion",
    title: "Recursive tree sum",
    language: "typescript",
    chip: "Recursion",
    concepts: ["recursion", "base case", "trees", "reduce"],
    summary: "Sums the values of every node in a tree by recursing into children.",
    code: `interface Node {
  value: number;
  children: Node[];
}

function sumTree(node: Node): number {
  return node.children.reduce(
    (total, child) => total + sumTree(child),
    node.value
  );
}`,
    explanations: {
      new: "Picture a family tree of numbers. This adds up every number by starting at the top and adding each branch below it, all the way down.",
      beginner:
        "sumTree adds a node's own value to the sum of all its children. To get each child's sum it calls itself. Nodes with no children just return their own value, which stops the recursion.",
      intermediate:
        "The base case is implicit: when children is empty, reduce returns the seed node.value and no further calls happen. Each level combines its value with the recursive totals of its subtrees, so the whole tree collapses to one number.",
      advanced:
        "reduce's initial accumulator is node.value, elegantly folding the node into its children's sums. Recursion depth equals tree height, so a deeply skewed tree risks a stack overflow — an explicit stack or iterative traversal avoids that. No memoization is needed since each node is visited once.",
      expert:
        "Clean structural recursion with the base case encoded by an empty reduce. The risk is unbounded depth on pathological trees; convert to an iterative depth-first walk with an explicit stack for untrusted input. Also note it assumes a strict tree — shared nodes or cycles would double-count or loop forever.",
    },
    comprehension: {
      question: "What stops the recursion for a leaf node (no children)?",
      options: [
        "An explicit if statement",
        "reduce returns the seed value with no recursive calls",
        "It throws an error",
        "The children array is set to null",
      ],
      answerIndex: 1,
      explanation:
        "With an empty children array, reduce never invokes the callback and simply returns the initial value node.value, ending that branch.",
    },
  },
  {
    id: "auth-flow",
    title: "A token refresh flow",
    language: "typescript",
    chip: "Auth flow",
    concepts: ["authentication", "tokens", "async", "single-flight"],
    summary:
      "Refreshes an expired access token once, even if many calls race for it.",
    code: `let refreshing: Promise<string> | null = null;

async function getAccessToken(): Promise<string> {
  if (!isExpired(token)) return token;
  if (!refreshing) {
    refreshing = refreshToken()
      .then((next) => {
        token = next;
        return next;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}`,
    explanations: {
      new: "A login pass expires after a while. This quietly gets a fresh pass when the old one runs out, and makes sure it only asks for one even if several things need it at the same moment.",
      beginner:
        "If the token is still valid it is returned right away. If it expired, the code refreshes it. The refreshing variable makes sure that if many calls arrive at once, they all wait on the same single refresh rather than each starting their own.",
      intermediate:
        "This is the single-flight pattern. The shared refreshing promise deduplicates concurrent refreshes; callers await the same promise. finally clears it so the next expiry can trigger a new refresh. Without this, a burst of requests would fire many parallel refreshes.",
      advanced:
        "The module-level promise acts as a mutex over the async refresh. Because finally nulls it regardless of outcome, a failed refresh lets the next caller retry rather than latching a rejected promise. Callers still need to handle the rejection; there is no backoff, so a flapping auth server could hammer the endpoint.",
      expert:
        "Correct single-flight dedup with clean reset semantics. Harden it with retry-with-backoff and a cap, and consider that a rejected shared promise propagates to every awaiting caller simultaneously — which may be desired or may need per-caller error isolation. In multi-tab contexts, coordinate via storage events or a lock so tabs do not each refresh.",
    },
    comprehension: {
      question:
        "If ten calls hit getAccessToken at once with an expired token, how many refreshes occur?",
      options: [
        "Ten refreshes",
        "One refresh shared by all ten",
        "Zero, they all fail",
        "One per unique caller",
      ],
      answerIndex: 1,
      explanation:
        "The shared refreshing promise means the first caller starts the refresh and the rest await the same promise, so exactly one refresh runs.",
    },
  },
];

export function getExample(id: string): CodeExample | undefined {
  return examples.find((e) => e.id === id);
}
