/**
 * The /explain/<id> pages: one per language with a written, checked sample and notes.
 *
 * Every sample here was run or compiled before it went on the site, and every note describes that
 * exact sample. A language is listed only when its page says something the others don't; Google
 * treats near-identical pages made for search as spam, and they don't help a learner either.
 * Text in `backticks` renders as code.
 */

import { languages, type Language } from "@/lib/languages";

export interface ConceptNote {
  /** One of the language's `concepts` in languages.ts. */
  concept: string;
  text: string;
}

export interface ExplainPage {
  /** The language's id in languages.ts, and the URL segment. */
  id: string;
  /** File name in the Try it editor's title bar. */
  fileName: string;
  /** The line under the page's heading. */
  lead: string;
  /** Meta description. */
  description: string;
  /** What the sample is, for the /explain index. */
  sampleSummary: string;
  /** Preloaded in Try it: realistic, correct, 8 to 25 lines, under the 1,500 character limit. */
  sample: string;
  /** Which of the language's concepts the sample shows, and where. */
  shows: ConceptNote[];
  notes: string[];
  watchOut: string;
}

export const explainPages: ExplainPage[] = [
  {
    id: "python",
    fileName: "sales_report.py",
    lead: "Paste Python, from a one-line comprehension to a decorator, and Vibe explains what it does in plain English.",
    description:
      "Paste Python code and get a plain English explanation online, free. The sample walks through a decorator, a generator and a dict comprehension.",
    sampleSummary: "A timing decorator, a generator that reads a CSV file and a dict comprehension.",
    sample: `import time
from functools import wraps

def timed(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.perf_counter() - start:.3f}s")
        return result
    return wrapper

def read_rows(path):
    with open(path) as f:
        for line in f:
            yield line.rstrip("\\n").split(",")

@timed
def total_by_city(path):
    totals = {}
    for city, amount in read_rows(path):
        totals[city] = totals.get(city, 0) + float(amount)
    return {city: round(total, 2) for city, total in sorted(totals.items())}`,
    shows: [
      {
        concept: "decorators",
        text: "`@timed` above `total_by_city` is shorthand for `total_by_city = timed(total_by_city)`. Every call now goes through `wrapper`, which runs the real function, prints how long it took and returns its result.",
      },
      {
        concept: "generators",
        text: "`read_rows` uses `yield`, so it hands back one row at a time instead of building a list. A large file never has to fit in memory at once.",
      },
      {
        concept: "comprehensions",
        text: "The last line is a dict comprehension: it builds a new dictionary from `totals`, in city order, with each total rounded to 2 decimal places.",
      },
    ],
    notes: [
      "`@wraps(func)` copies the original name and docstring onto `wrapper`. Without it, `total_by_city.__name__` would be `\"wrapper\"`, which makes logs and tracebacks harder to read.",
      "`for city, amount in read_rows(path)` unpacks each row into exactly two values. A row with more or fewer commas raises `ValueError`.",
      "`totals.get(city, 0)` returns 0 the first time a city appears. `collections.defaultdict(float)` does the same job without the `.get`.",
      "`round(total, 2)` only changes what is returned. The running totals are plain floats, so use `decimal.Decimal` when the amounts are money that must add up exactly.",
    ],
    watchOut:
      "A header row such as `city,amount` crashes the function, because `float(\"amount\")` raises `ValueError`. Skip it with `next(f)` before the loop, or read the file with the `csv` module.",
  },
  {
    id: "javascript",
    fileName: "profiles.js",
    lead: "Paste JavaScript, whether it is a callback, a promise chain or an async function, and Vibe explains what runs when.",
    description:
      "Get any JavaScript snippet explained in plain English online, free. The sample loads several users at once with fetch and Promise.allSettled.",
    sampleSummary: "Loading several users at once with fetch and Promise.allSettled.",
    sample: `async function loadProfiles(ids) {
  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(\`/api/users/\${id}\`).then((res) => {
        if (!res.ok) throw new Error(\`User \${id}: HTTP \${res.status}\`);
        return res.json();
      })
    )
  );

  const profiles = [];
  const failed = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") profiles.push(result.value);
    else failed.push({ id: ids[i], reason: result.reason.message });
  });
  return { profiles, failed };
}

console.log("before");
loadProfiles([1, 2, 3]).then(({ profiles, failed }) => {
  console.log(\`\${profiles.length} loaded, \${failed.length} failed\`);
});
console.log("after");`,
    shows: [
      {
        concept: "promises",
        text: "`fetch` returns a promise for each id, and `Promise.allSettled` waits until every one has either resolved or rejected. It never rejects itself, so one failed user doesn't lose the others.",
      },
      {
        concept: "event loop",
        text: "The script prints `before`, then `after`, and only then the count. `await` pauses `loadProfiles` and hands control back, so the last `console.log` runs while the requests are still in flight.",
      },
      {
        concept: "closures",
        text: "The arrow function inside `ids.map` closes over its own `id`, so each error message names the right user even though the requests can finish in any order.",
      },
    ],
    notes: [
      "All the requests start at once, because `map` calls `fetch` for every id before anything is awaited. To send them one at a time, `await` each one inside a `for...of` loop.",
      "`fetch` only rejects when the request itself fails, such as a network error. A 404 or a 500 still resolves, which is why the code checks `res.ok` and throws.",
      "With `Promise.all` instead, the first failure would reject the whole call and the profiles that did load would be lost.",
      "`results` keeps the same order as `ids`, which is why `ids[i]` finds the id of a failed request.",
    ],
    watchOut:
      "A relative URL like `/api/users/1` only works in a web page. In Node.js, `fetch` needs a full URL, so every request here would fail with `Failed to parse URL` and end up in `failed`.",
  },
  {
    id: "typescript",
    fileName: "users.ts",
    lead: "Paste TypeScript, generics and all, and Vibe explains what the code does and what its types are telling you.",
    description:
      "Paste TypeScript and see what the code and its types mean, free online. The sample loads a user with a generic Result type, narrowing and async/await.",
    sampleSummary: "A generic Result type that a fetch helper returns instead of throwing.",
    sample: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

interface User {
  id: number;
  name: string;
  email?: string;
}

export async function getJson<T>(url: string): Promise<Result<T>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: \`HTTP \${res.status}\` };
    return { ok: true, value: (await res.json()) as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function userLabel(id: number): Promise<string> {
  const result = await getJson<User>(\`https://example.com/users/\${id}\`);
  if (!result.ok) return \`Unknown user (\${result.error})\`;
  const { name, email } = result.value;
  return email ? \`\${name} <\${email}>\` : name;
}`,
    shows: [
      {
        concept: "generics",
        text: "`Result<T>` and `getJson<T>` work for any shape of data. `getJson<User>` fills in `T` as `User`, so `result.value` is typed as a `User`.",
      },
      {
        concept: "type narrowing",
        text: "`Result` is a union of two object types told apart by `ok`. After `if (!result.ok) return ...`, TypeScript knows only the `{ ok: true; value: T }` case is left, so reading `result.value` compiles.",
      },
      {
        concept: "async/await",
        text: "Both functions are `async`, so they return a `Promise`. `await` waits for the response, and then for its body, before the next line runs.",
      },
      {
        concept: "modules",
        text: "`export` makes the two functions importable from other files. `Result` and `User` are not exported, so they stay private to this file.",
      },
    ],
    notes: [
      "`as T` is a promise to the compiler, not a check. If the server sends a different shape, nothing fails until a later line uses a missing field. Validate data that comes from outside your code.",
      "`email?: string` means the field may be missing, so its type is `string | undefined`. The ternary in `userLabel` handles both cases.",
      "With `strict` on, a `catch` variable has the type `unknown`, so the code checks `err instanceof Error` before reading `err.message`.",
    ],
    watchOut:
      "`getJson` never throws: every failure becomes `{ ok: false }`. A caller that reads `.value` without checking `ok` first gets a compile error, which is the point of the pattern.",
  },
  {
    id: "sql",
    fileName: "report.sql",
    lead: "Paste a SQL query and Vibe explains which rows it returns and why.",
    description:
      "Paste a SQL query and read what it returns, explained in plain English, free. The sample ranks customers by spend with a LEFT JOIN, GROUP BY and RANK().",
    sampleSummary: "Ranking customers by this year's spend with a LEFT JOIN, GROUP BY and RANK().",
    sample: `SELECT
  c.name,
  COUNT(o.id) AS orders,
  COALESCE(SUM(o.total), 0) AS spent,
  RANK() OVER (ORDER BY COALESCE(SUM(o.total), 0) DESC) AS spend_rank
FROM customers AS c
LEFT JOIN orders AS o
  ON o.customer_id = c.id
  AND o.created_at >= '2026-01-01'
GROUP BY c.id, c.name
ORDER BY spend_rank, c.name;`,
    shows: [
      {
        concept: "joins",
        text: "`LEFT JOIN` keeps every customer, including one with no matching orders. For that customer the order columns come back as `NULL`.",
      },
      {
        concept: "aggregation",
        text: "`GROUP BY` folds each customer's orders into one row. `COUNT(o.id)` counts only real orders, so a customer with none gets 0, where `COUNT(*)` would give 1.",
      },
      {
        concept: "window functions",
        text: "`RANK() OVER (...)` runs after the grouping and numbers the rows by spend without merging them. Ties share a rank and the next rank is skipped: two customers at 1 are followed by 3.",
      },
    ],
    notes: [
      "The date filter sits in the `ON` clause on purpose. Moved to `WHERE`, it would drop every customer without an order this year, and the `LEFT JOIN` would behave like an inner join.",
      "`COALESCE(SUM(o.total), 0)` turns the `NULL` sum of a customer with no orders into 0, both in the output and in the ranking.",
      "Use `DENSE_RANK()` to number ties 1, 1, 2 instead of 1, 1, 3.",
      "On a large `orders` table, an index on `orders (customer_id, created_at)` lets the database find each customer's recent orders without reading the whole table.",
    ],
    watchOut:
      "Comparing `created_at` with `'2026-01-01'` works when dates are stored as a date type or as ISO text like `2026-03-01`. Text in another format, such as `03/01/2026`, compares character by character and gives wrong results.",
  },
  {
    id: "bash",
    fileName: "top-errors.sh",
    lead: "Paste a shell script or a one-liner and Vibe explains what it does before you run it.",
    description:
      "Find out what a shell script does before you run it: paste it here, free. The sample finds the most common errors in a folder of logs with one pipeline.",
    sampleSummary: "A script that finds the 10 most common errors in a folder of logs.",
    sample: `#!/usr/bin/env bash
set -euo pipefail

log_dir="\${1:-/var/log/myapp}"
report="errors-$(date +%F).txt"

if [[ ! -d "$log_dir" ]]; then
  echo "No such directory: $log_dir" >&2
  exit 1
fi

grep -h "ERROR" "$log_dir"/*.log \\
  | cut -d' ' -f3- \\
  | sort \\
  | uniq -c \\
  | sort -rn \\
  | head -n 10 > "$report"

echo "Top errors written to $report"`,
    shows: [
      {
        concept: "pipes",
        text: "Each `|` sends one command's output into the next: `grep` keeps the error lines, `cut` drops the date and time, `sort | uniq -c` counts repeats, `sort -rn` puts the biggest count first and `head` keeps 10.",
      },
      {
        concept: "redirection",
        text: "`> \"$report\"` writes the result to a file instead of the screen. `>&2` sends the error message to standard error, so it still shows when the normal output is redirected.",
      },
      {
        concept: "variables",
        text: "`${1:-/var/log/myapp}` uses the first argument, or that folder when none is given. `$(date +%F)` runs `date` and puts its output, such as `2026-10-25`, into the file name.",
      },
      {
        concept: "exit codes",
        text: "`exit 1` tells whatever ran the script that it failed. `set -e` stops at the first failing command, `-u` treats unset variables as errors and `-o pipefail` makes a pipeline fail when any part of it fails.",
      },
    ],
    notes: [
      "The quotes in `\"$log_dir\"` keep a folder name with spaces as one argument. `*.log` stays outside the quotes so the shell can expand it into file names.",
      "`cut -d' ' -f3-` assumes every line starts with a date and a time separated by spaces. Logs in another format need a different field number.",
      "If the folder has no `.log` files, the pattern stays as the literal text `*.log`, `grep` can't open it and the script stops with exit code 2.",
    ],
    watchOut:
      "If no line contains `ERROR`, `grep` exits with 1, `pipefail` fails the pipeline and `set -e` ends the script before the last `echo`, leaving an empty report. Add `|| true` after the pipeline if no errors is a normal result.",
  },
  {
    id: "c",
    fileName: "players.c",
    lead: "Paste C and get its pointers, structs and memory explained in plain English before you compile.",
    description:
      "Paste C code and get pointers and memory explained in plain English, free. The sample builds an array of structs on the heap with calloc and frees it.",
    sampleSummary: "An array of structs allocated with calloc, filled in, used and freed.",
    sample: `#include <stdio.h>
#include <stdlib.h>
typedef struct {
    char name[16];
    int score;
} Player;

Player *make_players(size_t count) {
    Player *players = calloc(count, sizeof *players);
    if (players == NULL) return NULL;
    for (size_t i = 0; i < count; i++) {
        snprintf(players[i].name, sizeof players[i].name, "player%zu", i + 1);
        players[i].score = 0;
    }
    return players;
}

int main(void) {
    Player *team = make_players(3);
    if (team == NULL) return 1;
    team[1].score += 10;
    printf("%s has %d points\\n", team[1].name, team[1].score);
    free(team);
    return 0;
}`,
    shows: [
      {
        concept: "structs",
        text: "`typedef struct { ... } Player;` defines a record with a 16-byte name and an `int` score, and lets you write `Player` instead of a full `struct` type.",
      },
      {
        concept: "manual memory",
        text: "`calloc` reserves room for `count` players on the heap, and `free(team)` gives it back. Nothing frees it for you.",
      },
      {
        concept: "pointers",
        text: "`make_players` returns a `Player *`, the address of the first player. `team[1]` is the second player, the same as `*(team + 1)`.",
      },
      {
        concept: "the stack",
        text: "`team` and `players` are local variables on the stack, but the players they point to live on the heap. That is why the players still exist after `make_players` returns.",
      },
    ],
    notes: [
      "`sizeof *players` asks for the size of whatever `players` points to, so the line stays correct if its type changes.",
      "`calloc` returns `NULL` when it can't allocate, including when `count` times the size of a player is too big for a `size_t`. Both functions check for that before touching the memory.",
      "`snprintf` with `sizeof players[i].name` never writes past the 16-byte array. A longer name is cut short instead of overflowing into `score`.",
    ],
    watchOut:
      "After `free(team)`, `team` still holds the old address. Using it again, or calling `free` on it twice, is undefined behavior. Setting `team = NULL` right after freeing makes that mistake easier to catch.",
  },
  {
    id: "cpp",
    fileName: "documents.cpp",
    lead: "Paste modern C++ and Vibe explains the templates, smart pointers and object lifetimes in it.",
    description:
      "Get C++ explained in plain English online, free. The sample shows a function template, RAII with a destructor and moving a unique_ptr.",
    sampleSummary: "A function template, a class with a destructor and a unique_ptr that changes owner.",
    sample: `#include <iostream>
#include <memory>
#include <string>
#include <vector>
template <typename T>
T largest(const std::vector<T>& items) {
    T best = items.at(0);
    for (const T& item : items)
        if (item > best) best = item;
    return best;
}

struct Document {
    std::string title;
    explicit Document(std::string t) : title(std::move(t)) {}
    ~Document() { std::cout << "closing " << title << '\\n'; }
};

int main() {
    std::vector<std::unique_ptr<Document>> open;
    open.push_back(std::make_unique<Document>("notes.txt"));
    std::unique_ptr<Document> current = std::move(open.front());
    std::cout << largest(std::vector<int>{3, 9, 4}) << '\\n';
    std::cout << std::boolalpha << (open.front() == nullptr) << ' ' << current->title << '\\n';
}`,
    shows: [
      {
        concept: "templates",
        text: "`largest` is written once for any `T` that can be copied and compared with `>`. `largest(std::vector<int>{3, 9, 4})` makes the compiler generate an `int` version, which returns 9.",
      },
      {
        concept: "RAII",
        text: "`Document` prints `closing` in its destructor. The destructor runs on its own when the `unique_ptr` that owns the document is destroyed at the end of `main`, so cleanup can't be forgotten.",
      },
      {
        concept: "move semantics",
        text: "`std::move(open.front())` hands ownership to `current`. The pointer left in the vector is now null, so the last line prints `true notes.txt`.",
      },
      {
        concept: "pointers",
        text: "`std::unique_ptr` is a pointer that owns its object: one owner at a time, deleted automatically, and it can be moved but not copied.",
      },
    ],
    notes: [
      "`items.at(0)` throws `std::out_of_range` on an empty vector, where `items[0]` would be undefined behavior.",
      "`explicit` stops a plain `std::string` from turning into a `Document` by accident, for example when passed to a function that takes a `Document`.",
      "The vector still holds one element after the move. It is an empty `unique_ptr`, and dereferencing it is undefined behavior.",
    ],
    watchOut:
      "`closing notes.txt` prints once, after everything else. The document is destroyed exactly once, by whichever `unique_ptr` owns it when `main` ends, here `current`.",
  },
  {
    id: "swift",
    fileName: "Todos.swift",
    lead: "Paste Swift from an app or a playground and Vibe explains what it does, optionals included.",
    description:
      "Paste Swift and get a plain English explanation, free online. The sample filters a to-do list with a protocol, an optional due date and closures.",
    sampleSummary: "A to-do list with a protocol, an optional due date, closures and a key path.",
    sample: `protocol Describable {
    var summary: String { get }
}

struct Todo: Describable {
    let title: String
    let due: String?
    let minutes: Int
    var summary: String {
        let when = due.map { ", due \\($0)" } ?? ""
        return "\\(title) (\\(minutes) min)\\(when)"
    }
}

let todos = [
    Todo(title: "Write report", due: "Friday", minutes: 90),
    Todo(title: "Water plants", due: nil, minutes: 5),
    Todo(title: "Plan trip", due: nil, minutes: 45),
]

let quick = todos.filter { $0.minutes <= 30 }.map(\\.title)
if let undated = todos.first(where: { $0.due == nil }) {
    print(undated.summary)
}
print(quick)`,
    shows: [
      {
        concept: "optionals",
        text: "`due: String?` holds either a string or `nil`. `due.map { ... }` runs the closure only when there is a value, and `?? \"\"` supplies the fallback when there isn't.",
      },
      {
        concept: "protocols",
        text: "`Describable` requires a readable `summary`. `Todo` meets it with a computed property, so any code that takes a `Describable` can use a `Todo`.",
      },
      {
        concept: "closures",
        text: "`{ $0.minutes <= 30 }` is a closure, and `$0` is its first argument. `map(\\.title)` passes a key path, a shorthand for `{ $0.title }`.",
      },
    ],
    notes: [
      "Structs get a memberwise initializer for free. That is where `Todo(title:due:minutes:)` comes from.",
      "`if let undated = ...` unwraps the optional that `first(where:)` returns, so the body only runs when an undated to-do exists. Here it prints `Water plants (5 min)`.",
      "`quick` is `[\"Water plants\"]`, the only to-do that takes 30 minutes or less.",
    ],
    watchOut:
      "`first(where:)` stops at the first match. `Plan trip` has no due date either but is never printed. Use `filter` to get all of them.",
  },
  {
    id: "ruby",
    fileName: "member.rb",
    lead: "Paste Ruby and Vibe explains the blocks, symbols and mixins that keep it so short.",
    description:
      "Paste Ruby and get blocks, symbols and mixins explained in plain English, free. The sample mixes modules into a class and sorts members with the <=> operator.",
    sampleSummary: "A class that mixes in a module and Comparable, then sorts and filters with blocks.",
    sample: `module Greeting
  def greet
    "Hi, I'm #{name}"
  end
end

class Member
  include Greeting
  include Comparable
  attr_reader :name, :points

  def initialize(name, points)
    @name = name
    @points = points
  end

  def <=>(other)
    points <=> other.points
  end
end

members = [Member.new("Ana", 40), Member.new("Ben", 75), Member.new("Cy", 12)]
puts members.max.greet
puts members.select { |m| m.points > 20 }.map(&:name).join(", ")
puts members.sort.map(&:name).inspect`,
    shows: [
      {
        concept: "mixins",
        text: "`include Greeting` adds `greet` to every `Member`. `include Comparable` adds comparison methods such as `<`, `>`, `==` and `between?`, all built on the `<=>` method the class defines.",
      },
      {
        concept: "blocks",
        text: "`{ |m| m.points > 20 }` is a block passed to `select`, which keeps the members the block returns true for.",
      },
      {
        concept: "symbols",
        text: "`:name` and `:points` are symbols. `map(&:name)` turns the symbol into a block that calls `name` on each member.",
      },
      {
        concept: "metaprogramming",
        text: "`attr_reader :name, :points` writes the two reader methods for you when the class is defined, so `points` works without a `def points`.",
      },
    ],
    notes: [
      "`<=>` returns -1, 0 or 1. `max` and `sort` only need that method, so the script prints `Hi, I'm Ben`, then `Ana, Ben`, then `[\"Cy\", \"Ana\", \"Ben\"]`.",
      "`greet` calls `name` without `self.`, because a method from a module runs on the object it was mixed into.",
    ],
    watchOut:
      "`Comparable` also defines `==` from `<=>`, so two different members with the same points count as equal: `Member.new(\"Al\", 5) == Member.new(\"Bo\", 5)` is `true`.",
  },
  {
    id: "java",
    fileName: "Reports.java",
    lead: "Paste Java, from a record to a stream pipeline, and Vibe explains what each step does and which types it works with.",
    description:
      "Paste Java code and get a plain English explanation, free online. The sample totals paid orders with a record, a stream and Collectors.groupingBy.",
    sampleSummary: "A record for orders, a stream that totals paid orders per customer and a generic method that finds the top one.",
    sample: `import java.util.*;
import java.util.stream.Collectors;

record Order(String customer, String status, int cents) {
    Order {
        if (cents < 0) throw new IllegalArgumentException("negative total: " + cents);
    }
}

class Reports {
    static Map<String, Integer> paidByCustomer(List<Order> orders) {
        return orders.stream()
                .filter(o -> o.status().equals("PAID"))
                .collect(Collectors.groupingBy(Order::customer, TreeMap::new,
                        Collectors.summingInt(Order::cents)));
    }

    static <K, V extends Comparable<V>> Optional<K> topKey(Map<K, V> map) {
        return map.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey);
    }
}`,
    shows: [
      {
        concept: "classes",
        text: "`record Order(...)` declares a class from its three fields. Java writes the constructor, the accessors `customer()`, `status()` and `cents()`, and `equals`, `hashCode` and `toString`. The block inside is a compact constructor: it runs on every `new Order(...)` and throws `IllegalArgumentException` for a negative total.",
      },
      {
        concept: "streams",
        text: "`paidByCustomer` reads the list as a stream. `filter` keeps the paid orders, then `Collectors.groupingBy` puts them in a `TreeMap` keyed by customer and adds up their `cents` with `summingInt`. Paid orders of 1250 and 2750 for Ana and 3000 for Ben give `{Ana=4000, Ben=3000}`.",
      },
      {
        concept: "generics",
        text: "`topKey` works for any map whose values can be compared. The bound `V extends Comparable<V>` is what lets `Map.Entry.comparingByValue()` compile: with a plain `V`, javac rejects the method with an `incompatible types` error.",
      },
    ],
    notes: [
      "A customer with no paid orders is left out of the result, not listed with 0. A customer whose only order is `PENDING` never reaches `groupingBy`.",
      "`TreeMap::new` keeps the customers in name order. Without it, `groupingBy` promises no particular map or order; the JDK hands back a `HashMap`.",
      "`topKey` returns an `Optional` because an empty map has no top key: it gives `Optional.empty`, never `null`. The spec doesn't say which entry wins a tie; the JDK keeps the one `max` met first, which in a `TreeMap` is the name that sorts first.",
      "`o.status().equals(\"PAID\")` throws `NullPointerException` on an order whose status is `null`. Written as `\"PAID\".equals(o.status())`, it skips that order instead.",
    ],
    watchOut:
      "`summingInt` adds in an `int`, so a customer's total silently wraps around once it passes 2,147,483,647 cents, about 21.5 million dollars. Two paid orders of 2,000,000,000 cents add up to `-294967296`. Use `summingLong` for totals that can grow that large.",
  },
  {
    id: "html",
    fileName: "signup.html",
    lead: "Paste HTML and Vibe explains what each element means to the browser, to keyboard users and to screen readers.",
    description:
      "Paste HTML and get a plain English explanation, free online. The sample is a sign-up form with labels, a required email field and radio buttons.",
    sampleSummary: "A sign-up form with a labelled email field, a hint, a group of radio buttons and two buttons.",
    sample: `<form action="/subscribe" method="post">
  <h2>Get the weekly digest</h2>

  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="email"
         required aria-describedby="email-hint">
  <p id="email-hint">One email a week. Unsubscribe any time.</p>

  <fieldset>
    <legend>Format</legend>
    <label><input type="radio" name="format" value="html" checked> Full</label>
    <label><input type="radio" name="format" value="text"> Plain text</label>
  </fieldset>

  <button>Subscribe</button>
  <button type="button">Preview an issue</button>
</form>`,
    shows: [
      {
        concept: "forms",
        text: "`required` and `type=\"email\"` make the browser check the field before anything is sent. With the field empty, or holding `ana@`, Subscribe sends nothing: the browser moves focus to the field and shows a message such as `Please fill out this field.`",
      },
      {
        concept: "accessibility",
        text: "`<label for=\"email\">` ties the word Email to the input whose `id` is `email`. That makes Email the field's accessible name, the one a screen reader announces, and clicking the word puts the cursor in the field. `aria-describedby` makes the hint below the field's description.",
      },
      {
        concept: "semantics",
        text: "`<fieldset>` and `<legend>` group the two radio buttons under the name Format, so a screen reader can say which question Full and Plain text answer. Wrapping each radio in its own `<label>` names it without a `for` or an `id`, and makes the words clickable too.",
      },
    ],
    notes: [
      "Only fields with a `name` are sent. Submitting `ana@example.com` posts `email=ana%40example.com&format=html` to `/subscribe`. The buttons have no `name`, so they add nothing.",
      "A `<button>` inside a form submits it unless its `type` says otherwise. Preview an issue has `type=\"button\"`, so clicking it sends nothing until a script gives it a job.",
      "Pressing Enter in the email field submits the form too, through the same check. Real `<button>` elements also work from the keyboard with no script: Tab to Subscribe and press Enter or Space.",
      "The radio group is one Tab stop, on the checked option, and the arrow keys move between the options. Both share `name=\"format\"`, so checking Plain text unchecks Full.",
    ],
    watchOut:
      "The browser only checks the format, and only when a person submits. `ana@example` passes even without a dot, and a script that calls `form.submit()` sends the form with the field empty. Check the address again on the server.",
  },
  {
    id: "css",
    fileName: "cards.css",
    lead: "Paste CSS and Vibe explains which rule wins, why the layout lands where it does and where each value comes from.",
    description:
      "Paste CSS and get a plain English explanation, free online. The sample lays out product cards with grid, flexbox and a custom property for the accent color.",
    sampleSummary: "A grid of product cards, a flexbox column inside each card and a custom property for the sale color.",
    sample: `.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.card {
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.card.sale {
  --accent: #dc2626;
}

.card .buy {
  margin-top: auto;
  background: var(--accent, #2563eb);
}

.buy {
  background: gray;
}`,
    shows: [
      {
        concept: "grid",
        text: "`repeat(auto-fill, minmax(220px, 1fr))` makes as many columns at least 220px wide as fit, then shares out the leftover space. A 960px container gets 4 columns of 228px, and one narrower than 456px gets a single column, with no media query.",
      },
      {
        concept: "flexbox",
        text: "Each `.card` is a flex column, and `margin-top: auto` on its `.buy` button takes all the free space above it. The grid stretches the cards in a row to one height, so the buttons in that row line up along the bottom, however long the text above them.",
      },
      {
        concept: "custom properties",
        text: "`.card.sale` sets `--accent`, and the button inside inherits it, so a sale card's button is red. Other cards don't set `--accent`, so `var(--accent, #2563eb)` falls back to blue.",
      },
      {
        concept: "the cascade",
        text: "Inside a card, `.card .buy` beats the `.buy` rule even though `.buy` comes later, because two classes are more specific than one. Source order only decides between equally specific selectors: a later `.card .buy { background: gray; }` would win.",
      },
    ],
    notes: [
      "A `.buy` button outside any card matches only the last rule, so it is gray and has no auto margin.",
      "`gap: 16px` adds space between the cards only, never around the outside of the grid.",
      "With `auto-fit` in place of `auto-fill`, empty columns collapse: two cards in a 960px container stretch to 472px each, where `auto-fill` keeps them at 228px.",
      "Items in a flex column stretch across by default, so each `.buy` button fills its card's width. Add `align-self: start` to the button to keep it its natural size.",
      "`margin-top: auto` pushes only because `.card` is a flex container. Make `.card` a plain block and it computes to 0, and the buttons no longer line up.",
    ],
    watchOut:
      "The fallback in `var(--accent, #2563eb)` is used only when `--accent` isn't set at all. A card that sets `--accent: 12px` gets a button with no background: not red, not blue and not the gray from `.buy`, because the browser can't tell the value is wrong until it uses it.",
  },
  {
    id: "go",
    fileName: "counts.go",
    lead: "Paste Go and Vibe explains what each goroutine does, what travels over each channel and where every error ends up.",
    description:
      "Paste Go code and get a plain English explanation, free online. The sample parses lines in goroutines and collects their errors over a buffered channel.",
    sampleSummary: "A function that parses each line in its own goroutine and returns the first error it receives over a buffered channel.",
    sample: `package main

import (
	"fmt"
	"strconv"
)

func parseCounts(raw []string) ([]int, error) {
	counts := make([]int, len(raw))
	errs := make(chan error, len(raw))
	for i, text := range raw {
		go func() {
			n, err := strconv.Atoi(text)
			counts[i] = n
			errs <- err
		}()
	}
	for range raw {
		if err := <-errs; err != nil {
			return nil, fmt.Errorf("parse counts: %w", err)
		}
	}
	return counts, nil
}`,
    shows: [
      {
        concept: "goroutines",
        text: "`go func() { ... }()` starts one goroutine per line, and each one writes only its own slot, `counts[i]`. Since Go 1.22 every loop iteration gets its own `i` and `text`, so each goroutine parses its own line. In a module that declares `go 1.21`, `go vet` reports `loop variable text captured by func literal`.",
      },
      {
        concept: "channels",
        text: "`errs` carries one result per line, `nil` or an error. The `for range raw` loop receives exactly that many, so by `return counts, nil` every goroutine has written its number; the race detector (`go build -race`) finds no race. `[\"3\", \"5\", \"8\"]` gives `[3 5 8]`.",
      },
      {
        concept: "error values",
        text: "`strconv.Atoi` returns its error as an ordinary value next to the number, and the function checks it with `err != nil`. `fmt.Errorf` with `%w` wraps it, so `\"7 \"` gives `parse counts: strconv.Atoi: parsing \"7 \": invalid syntax` and `errors.Is(err, strconv.ErrSyntax)` is still `true`.",
      },
    ],
    notes: [
      "One bad line means no counts at all: the function returns `nil` and the first error it receives. With no lines it returns an empty slice, not `nil`.",
      "When several lines are bad, which error you get depends on the scheduler, not on line order. In 200 calls with `[\"3\", \"x\", \"y\"]`, a normal build returned the `\"y\"` error all 200 times; a build with the race detector returned `\"x\"` 91 times and `\"y\"` 109 times.",
      "`Atoi` accepts a sign, so `\"+7\"` gives 7, but not a trailing space: `\"7 \"` is an error.",
    ],
    watchOut:
      "The buffer in `make(chan error, len(raw))` is what makes the early `return` safe. With `make(chan error)`, the goroutines that haven't sent yet wait for a receiver that never comes: after a call with `[\"x\", \"y\", \"z\", \"4\"]`, 2 of them were still stuck 200 ms later, and nothing reports it.",
  },
  {
    id: "rust",
    fileName: "stock.rs",
    lead: "Paste Rust and Vibe explains what each borrow allows, what a lifetime ties together and why the compiler accepts or rejects it.",
    description:
      "Paste Rust code and get a plain English explanation, free online. The sample picks and reserves stock with a trait, a lifetime and shared and mutable borrows.",
    sampleSummary: "A trait for stock that can be sold, a function that borrows the first available item and one that reserves it.",
    sample: `pub struct Stock {
    pub sku: String,
    pub quantity: u32,
}

pub trait Available {
    fn available(&self) -> bool;
}

impl Available for Stock {
    fn available(&self) -> bool { self.quantity > 0 }
}

pub fn first_available<'a, T: Available>(items: &'a [T]) -> Option<&'a T> {
    items.iter().find(|item| item.available())
}

pub fn reserve(stock: &mut Stock) -> bool {
    if stock.quantity == 0 { return false; }
    stock.quantity -= 1;
    true
}`,
    shows: [
      {
        concept: "traits",
        text: "`Available` names one method, and `impl Available for Stock` gives `Stock` that method. `first_available` takes a slice of any type `T` that implements the trait; here that is `Stock`, and an item with a quantity of 0 doesn't count as available.",
      },
      {
        concept: "lifetimes",
        text: "`'a` ties the result to the slice: the `&'a T` that comes back points at the item inside `items` itself, not at a copy. Rust would infer the same lifetimes here: a version without `'a` compiles too, because only one reference goes in.",
      },
      {
        concept: "borrowing",
        text: "`first_available` takes `&[T]`, a shared borrow, and `reserve` takes `&mut Stock`, a mutable one. While the item `first_available(&items)` returned is still in use, `reserve(&mut items[0])` doesn't compile: rustc stops with error `E0502`, cannot borrow `items` as mutable because it is also borrowed as immutable.",
      },
    ],
    notes: [
      "With an empty item first, then `box` (quantity 2) and `bag` (quantity 1), `first_available` skips the empty one and returns `box`.",
      "`reserve` returns `true` twice for `box`, then `false`, and the quantity stays at 0. The next `first_available` call returns `bag`.",
      "`find` gives `None` for an empty slice or when nothing is available, so the caller has to handle the `Option` before it can read `sku`.",
    ],
    watchOut:
      "The `if stock.quantity == 0` check matters because `quantity` is a `u32`, which can't go below 0. Without it, `stock.quantity -= 1` on 0 panics with `attempt to subtract with overflow` in a debug build, and in a build with `-O`, where overflow checks are off by default, it quietly wraps to `4294967295`.",
  },
];

/** The languages.ts entry behind a page. */
export function explainLanguage(page: ExplainPage): Language {
  const language = languages.find((entry) => entry.id === page.id);
  if (!language) throw new Error(`No language "${page.id}" in languages.ts`);
  return language;
}

/** Every /explain URL path, index first. */
export const EXPLAIN_PATHS: readonly string[] = ["/explain", ...explainPages.map((page) => `/explain/${page.id}`)];
