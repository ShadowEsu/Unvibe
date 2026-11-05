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
      "This page is about what a query returns. A database's own `EXPLAIN` command answers a different question: it shows the plan the database will use to run the query, such as which index it reads and the order it joins the tables in.",
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
    id: "powershell",
    fileName: "Clear-OldLogs.ps1",
    lead: "Paste a PowerShell script and Vibe explains what each cmdlet in the pipeline passes along, what `$_` holds and what `-WhatIf` would change before anything runs.",
    description:
      "Paste a PowerShell script and get a plain English explanation, free online. The sample finds old log files, previews the delete with -WhatIf and reports their size.",
    sampleSummary: "A PowerShell script that finds .log files older than a number of days, deletes them with WhatIf support and prints a size report.",
    sample: `# Delete .log files older than -Days in a folder and its subfolders.
# Run: ./Clear-OldLogs.ps1 -Path ./logs -Days 30 -WhatIf
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [string]$Path,
    [int]$Days = 30
)

$cutoff = (Get-Date).AddDays(-$Days)

$old = Get-ChildItem -Path $Path -Filter *.log -Recurse -File |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    Sort-Object Length -Descending

foreach ($file in $old) {
    if ($PSCmdlet.ShouldProcess($file.FullName, "Delete")) {
        Remove-Item -LiteralPath $file.FullName
    }
}

$old | Select-Object Name, @{ Name = "SizeKB"; Expression = { [math]::Round($_.Length / 1KB, 1) } }
"{0} files, {1:N1} KB" -f $old.Count, (($old | Measure-Object Length -Sum).Sum / 1KB)`,
    shows: [
      {
        concept: "cmdlets and the pipeline",
        text: "`Get-ChildItem` lists the files, `|` hands each one to `Where-Object`, which keeps the ones that pass its test, and `Sort-Object Length -Descending` puts the biggest first. `-Filter *.log` and `-File` narrow the list before anything reaches the pipeline, so `notes.txt` and the folders never show up.",
      },
      {
        concept: "objects and properties",
        text: "The pipeline passes file objects, not lines of text. Inside `{ ... }`, `$_` is the current file, so `$_.LastWriteTime` and `$_.Length` are its date and size, with no text to cut apart. `@{ Name = \"SizeKB\"; Expression = { ... } }` adds a column worked out for each file, and `1KB` is PowerShell's own constant for 1,024.",
      },
      {
        concept: "parameters",
        text: "`param()` declares what the script takes. `[Parameter(Mandatory)]` made a run with no `-Path` stop with `missing mandatory parameters: Path`, `[int]` made `-Days abc` stop with `Cannot convert value \"abc\" to type \"System.Int32\"`, and `= 30` is the default when `-Days` is left out.",
      },
      {
        concept: "WhatIf and ShouldProcess",
        text: "`[CmdletBinding(SupportsShouldProcess)]` gives the script a `-WhatIf` switch. `$PSCmdlet.ShouldProcess(...)` returns false under `-WhatIf` and prints the change instead, so the run printed `What if: Performing the operation \"Delete\" on target ...` for each old log and deleted nothing.",
      },
    ],
    notes: [
      "Run with PowerShell 7.6.9 on four test files, two .log files from 20 September, one from 4 November and a .txt, with `-Days 30 -WhatIf` on 5 November: it listed the two September logs, printed `2 files, 250.0 KB` and left all four files in place.",
      "The same run without `-WhatIf`, on a copy of the folder, deleted exactly those two logs and kept `notes.txt` and the November log.",
      "With one old file the summary read `1 files, 2.0 KB`, and with none `0 files, 0.0 KB`. `.Count` works on a single result and on an empty one in PowerShell 7, so the line never breaks.",
    ],
    watchOut:
      "Use `-LiteralPath` for file names you didn't type. In a file called `app[1].log`, `-Path` reads `[1]` as a wildcard: `Remove-Item -Path` matched nothing, deleted nothing and still reported success, while `-LiteralPath` removed the file.",
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
  {
    id: "csharp",
    fileName: "Batches.cs",
    lead: "Paste C#, LINQ queries and records included, and Vibe explains what each line returns and when the query actually runs.",
    description:
      "Paste C# code and get a plain English explanation, free online. The sample filters task batches with LINQ and copies a record with a with expression.",
    sampleSummary: "A record for task batches, a LINQ query that keeps the long ones in name order and a with expression that renames a copy.",
    sample: `using System.Collections.Generic;
using System.Linq;

sealed record TaskBatch(string Name, List<int> Minutes);

static class Batches
{
    public static IEnumerable<TaskBatch> LongBatches(IEnumerable<TaskBatch> batches, int minimum)
    {
        return batches.Where(batch => batch.Minutes.Sum() >= minimum)
                      .OrderBy(batch => batch.Name);
    }

    public static TaskBatch Rename(TaskBatch batch, string name) =>
        batch with { Name = name };
}`,
    shows: [
      {
        concept: "LINQ",
        text: "`Where` keeps the batches whose minutes add up to at least `minimum`, and `OrderBy` sorts what is left by name. With `beta` (20 minutes), `alpha` (10 and 5) and `tiny` (2) and a minimum of 15, the result is `alpha, beta`: `>=` keeps `alpha` at exactly 15.",
      },
      {
        concept: "records",
        text: "`sealed record TaskBatch(string Name, List<int> Minutes)` declares a class from its two values. C# writes the `Name` and `Minutes` properties, value equality and a `ToString` that lists each property, though for the list it prints only the type name, not the numbers.",
      },
    ],
    notes: [
      "`batch with { Name = name }` returns a new record and leaves the old one alone: renaming `alpha` to `copy` gives a second batch, and the original is still named `alpha`.",
      "`with` copies the reference to the list, not the list. Add 7 minutes to the copy's `Minutes` and the original changes too: both now total 22.",
      "Record equality compares each property with that property's own `Equals`. Two batches named `a` that share one list are equal, but with a new list of the same numbers they are not, because a `List<int>` is only equal to itself.",
    ],
    watchOut:
      "`LongBatches` returns a query, not a list, and the query runs again every time you loop over it. Add a `delta` batch of 30 minutes to the source list after calling it and the same result now gives `alpha, beta, delta`, while a `ToList()` taken before still holds `alpha, beta`.",
  },
  {
    id: "kotlin",
    fileName: "Parcel.kt",
    lead: "Paste Kotlin and Vibe explains where null can turn up, what a data class writes for you and where an extension function comes from.",
    description:
      "Paste Kotlin code and get a plain English explanation, free online. The sample labels parcels with a data class, two extension functions and safe calls.",
    sampleSummary: "A data class for parcels with an optional note, two extension functions and a function that labels a list of parcels.",
    sample: `data class Parcel(val code: String, val grams: Int, val note: String? = null)

fun Parcel.label(): String {
    val text = note?.trim() ?: "no note"
    return "$code: $grams g ($text)"
}

fun Parcel.withExtra(extra: Int): Parcel = copy(grams = grams + extra)

fun packingLabels(parcels: List<Parcel>): List<String> {
    return parcels.map { it.label() }
}`,
    shows: [
      {
        concept: "null safety",
        text: "`note` is a `String?`, so it may be null, and it is unless you pass one. `note?.trim()` calls `trim` only when there is a note, and `?: \"no note\"` fills in when there isn't. Write `note.trim()` and the compiler stops: only safe (?.) or non-null asserted (!!.) calls are allowed on a nullable receiver of type `String?`.",
      },
      {
        concept: "extensions",
        text: "`fun Parcel.label()` and `fun Parcel.withExtra()` add functions to `Parcel` from outside the class, so `packingLabels` can call `it.label()` as if it were a method. Inside them, `code`, `grams`, `note` and `copy` belong to the parcel they were called on.",
      },
      {
        concept: "data classes",
        text: "`data class` writes `equals`, `copy` and destructuring for the three properties. `withExtra(25)` returns a 525 g copy and leaves the 500 g original as it was, `original == original.copy()` is `true`, and `val (code, grams, note) = original` gives `BOX`, `500` and `null`.",
      },
    ],
    notes: [
      "`packingLabels` turns a 500 g `BOX` without a note and a 100 g `BAG` whose note is `fragile` with two spaces on each side into `BOX: 500 g (no note)` and `BAG: 100 g (fragile)`.",
      "`withExtra` changes only `grams`: the copy keeps the original's `code` and `note`, and the two parcels are not equal.",
      "An empty list of parcels gives an empty list of labels.",
    ],
    watchOut:
      "`?:` only steps in for `null`. A note of three spaces trims to an empty string, which isn't null, so a 20 g `ENV` parcel with that note gets the label `ENV: 20 g ()`. `note?.trim()?.ifBlank { null } ?: \"no note\"` gives `no note` for it.",
  },
  {
    id: "regex",
    fileName: "access_log.py",
    lead: "Paste a regular expression and Vibe explains what each part of it matches.",
    description:
      "Paste a regex and read what each part matches, explained in plain English, free. The sample pulls the fields out of one line of a web server's access log.",
    sampleSummary: "Pulling the fields out of a web server's access log line with one commented Python regex.",
    sample: String.raw`import re

# One line of a web server's access log in the common log format, for example:
# 203.0.113.7 - - [04/Nov/2026:06:12:09 +0000] "GET /pricing HTTP/2.0" 200 5123
ACCESS_LINE = re.compile(r"""
    ^(?P<ip>\d{1,3}(?:\.\d{1,3}){3})   # client IPv4 address
    \s-\s(?P<user>\S+)\s               # "-" when nobody is signed in
    \[(?P<time>[^\]]+)\]\s             # everything up to the closing bracket
    "(?P<method>[A-Z]+)\s(?P<path>\S+)\sHTTP/[\d.]+"\s
    (?P<status>[1-5]\d{2})\s
    (?P<bytes>\d+|-)$                  # "-" when no body was sent
""", re.VERBOSE)

line = '203.0.113.7 - - [04/Nov/2026:06:12:09 +0000] "GET /pricing HTTP/2.0" 200 5123'
m = ACCESS_LINE.match(line)
print(m.group("path"), m.group("status"), m.group("bytes"))`,
    shows: [
      {
        concept: "groups",
        text: "`(?P<ip>...)` is a named group: after a match, `m.group(\"ip\")` returns just that part of the line. `(?:\\.\\d{1,3})` groups without capturing, so `{3}` can repeat it without adding a group.",
      },
      {
        concept: "quantifiers",
        text: "`\\d{1,3}` takes one to three digits and `\\S+` takes one or more characters that aren't spaces. `(?P<bytes>\\d+|-)` takes either a number or a single `-`.",
      },
      {
        concept: "character classes",
        text: "`[^\\]]+` is a negated class: a run of anything except `]`. It stops at the first closing bracket, so the time can't run on into the rest of the line.",
      },
      {
        concept: "flags",
        text: "`re.VERBOSE` ignores spaces in the pattern and lets each line end in a `#` comment, which is why the pattern can be laid out one field per line. So a space to match is written here as `\\s`, which matches any whitespace.",
      },
    ],
    notes: [
      "Run on the sample line, the script prints `/pricing 200 5123`.",
      "`\\d{1,3}` checks the shape of an address, not its value: `999.999.999.999` matches. Pass the `ip` group to Python's `ipaddress.ip_address()` when the address has to be real.",
      "The pattern only knows IPv4. A line from an IPv6 client, such as `2001:db8::1`, doesn't match at all.",
      "`match()` already starts at the beginning of the string, so the `^` is there for the reader. The `$` at the end is what makes the whole line required.",
    ],
    watchOut:
      "This is the common log format. Nginx's default `combined` format adds the referrer and the user agent after the byte count, so the `$` makes every one of those lines fail: `match()` returns `None`, and `m.group(...)` then raises `AttributeError`.",
  },
  {
    id: "dart",
    fileName: "track.dart",
    lead: "Paste Dart, Flutter app code included, and Vibe explains where null is allowed, what a constructor does with its arguments and what each type cast checks.",
    description:
      "Paste Dart code and get a plain English explanation, free online. The sample reads a JSON list of music tracks into a model class with null safety.",
    sampleSummary: "A model class for music tracks with a fromJson factory, the kind a Flutter app parses an API response into, and one optional field.",
    sample: `import 'dart:convert';

class Track {
  final String id;
  final String title;
  final int seconds;
  final String? artist;

  const Track({required this.id, required this.title, required this.seconds, this.artist});

  factory Track.fromJson(Map<String, dynamic> json) => Track(
        id: json['id'] as String,
        title: json['title'] as String,
        seconds: (json['seconds'] as num?)?.toInt() ?? 0,
        artist: json['artist'] as String?,
      );

  String get length => '\${seconds ~/ 60}:\${(seconds % 60).toString().padLeft(2, '0')}';
  String label() => '$title by \${artist ?? 'unknown artist'}, $length';
}

List<Track> parseTracks(String body) {
  final items = jsonDecode(body) as List<dynamic>;
  return items.map((item) => Track.fromJson(item as Map<String, dynamic>)).toList();
}`,
    shows: [
      {
        concept: "null safety",
        text: "`String? artist` may be null and the other three fields may not. `json['artist'] as String?` lets a missing or `null` artist through, and `artist ?? 'unknown artist'` fills in for it in the label. Write `track.artist.toUpperCase()` and the program doesn't compile: Method 'toUpperCase' cannot be called on 'String?' because it is potentially null.",
      },
      {
        concept: "constructors",
        text: "`const Track({required this.id, ...})` takes named arguments and puts each one straight into its field. Leave out a `required` one and the call doesn't compile, while `this.artist` can be left out and stays `null`. `factory Track.fromJson` is a constructor that runs code first: it reads the map, then calls the main constructor.",
      },
      {
        concept: "collections",
        text: "`jsonDecode` returns `dynamic`, so `as List<dynamic>` says the body is a list. `items.map(...)` builds nothing yet: it is a lazy `Iterable` that makes each `Track` only when it is read. `.toList()` makes all of them at once into a `List<Track>`.",
      },
    ],
    notes: [
      "Run on `[{\"id\":\"t1\",\"title\":\"Night Drive\",\"seconds\":215,\"artist\":\"Lumen\"},{\"id\":\"t2\",\"title\":\"Intro\",\"seconds\":9}]`, `parseTracks` gives two tracks labelled `Night Drive by Lumen, 3:35` and `Intro by unknown artist, 0:09`.",
      "`seconds ~/ 60` divides and drops the remainder, 3 for 215, and `% 60` is the 35 left over. `padLeft(2, '0')` turns 9 into `09`, so the label reads `0:09`, not `0:9`.",
      "A missing `seconds` becomes 0. A decimal like `95.9` is cut to 95 by `toInt()`, not rounded, so that track shows as `1:35`.",
      "`Track` doesn't define `==`, so two tracks parsed from the same JSON are not equal. Two `const Track(...)` written with the same values are the same object.",
      "The file imports only `dart:convert`, not Flutter, so it was run with the plain Dart SDK, and a Flutter app can use it as it is.",
    ],
    watchOut:
      "`as` checks the type when the code runs and throws if it's wrong. An API that sends `\"seconds\": \"215\"` as text makes `parseTracks` throw `type 'String' is not a subtype of type 'num?' in type cast`, and one track with no `id` gives `type 'Null' is not a subtype of type 'String' in type cast`. Either way the whole list fails, not just that track.",
  },
  {
    id: "lua",
    fileName: "Leaderboard.lua",
    lead: "Paste Lua, Roblox game scripts included, and Vibe explains what each table holds, what a colon call passes and how a metatable makes a class.",
    description:
      "Paste Lua code and get a plain English explanation, free online. The sample is a game leaderboard class in plain Lua, the metatable pattern Roblox scripts use too.",
    sampleSummary: "A game leaderboard built from a table and a metatable, with a method that adds points and one that lists the top players.",
    sample: `local Leaderboard = {}
Leaderboard.__index = Leaderboard

function Leaderboard.new()
  return setmetatable({ scores = {} }, Leaderboard)
end

function Leaderboard:add(name, points)
  self.scores[name] = (self.scores[name] or 0) + points
end

function Leaderboard:top(count)
  local rows = {}
  for name, score in pairs(self.scores) do
    table.insert(rows, { name = name, score = score })
  end
  table.sort(rows, function(a, b)
    return a.score > b.score or (a.score == b.score and a.name < b.name)
  end)
  local lines = {}
  for i = 1, math.min(count, #rows) do
    lines[i] = i .. ". " .. rows[i].name .. ": " .. rows[i].score
  end
  return lines
end`,
    shows: [
      {
        concept: "tables",
        text: "The table is Lua's one data structure, and the sample uses it three ways: `scores` maps names to points, each `{ name = name, score = score }` is a record, and `rows` and `lines` are lists numbered from 1. Reading a missing key gives `nil`, so `self.scores[name] or 0` starts a new player at 0.",
      },
      {
        concept: "metatables",
        text: "`setmetatable({ scores = {} }, Leaderboard)` makes a board that looks up any key it doesn't have in `Leaderboard`, because `Leaderboard.__index` is `Leaderboard` itself. The board holds only `scores`, so `board:add` finds `add` on `Leaderboard`. `board:add(\"nova\", 30)` is short for `board.add(board, \"nova\", 30)`, and that first argument is `self`.",
      },
    ],
    notes: [
      "With `nova` adding 30 and then 20, `blitz` 45 and `echo` 50, `board:top(3)` returns `1. echo: 50`, `2. nova: 50` and `3. blitz: 45`.",
      "`pairs` visits keys in no set order, so `table.sort` decides the order: higher scores first, and a tie goes by name, which is why `echo` comes before `nova` on 50 every time.",
      "Names are compared as text, and in this run capital letters sorted before lowercase ones: three players tied on 10 come out as `Bolt`, `Zed`, `alpha`. Compare `a.name:lower() < b.name:lower()` to ignore case.",
      "`math.min(count, #rows)` stops at the players there are: `top(10)` with three players returns three lines, and an empty board returns an empty table.",
      "The sample uses only standard Lua, no Roblox APIs, and was run with Lua 5.5. In Roblox it would usually sit in a ModuleScript that ends with `return Leaderboard`, which other scripts load with `require`.",
    ],
    watchOut:
      "Methods need the colon. `board.add(\"nova\", 5)` with a dot passes `\"nova\"` as `self` and 5 as the name, and fails with `attempt to index a nil value (field 'scores')`. Leaving out the points fails too, with `attempt to perform arithmetic on a nil value (local 'points')`.",
  },
  {
    id: "yaml",
    fileName: "ci.yml",
    lead: "Paste YAML, GitHub Actions workflows included, and Vibe explains what each key sets, which lines are lists and what each value turns into when it's read.",
    description:
      "Paste YAML and get a plain English explanation, free online. The sample is a GitHub Actions workflow that tests a Python app on pushes to main and on pull requests.",
    sampleSummary: "A GitHub Actions workflow that installs a Python app's dependencies with a pip cache and runs its tests, with a secret passed in as an environment variable.",
    sample: `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: \${{ secrets.DATABASE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r requirements.txt
      - run: pytest -q`,
    shows: [
      {
        concept: "mappings",
        text: "Each `key: value` line is a mapping entry, and a block indented under a key is that key's value, so `push`, `test` and `with` are mappings inside mappings. Read with Ruby's YAML library, `on:` comes back as the key `true`, not `\"on\"`, because YAML 1.1 reads a bare `on` as true. GitHub reads it as the `on` key, but another tool that reads the file can see `true`.",
      },
      {
        concept: "sequences",
        text: "A line that starts with `- ` is one item in a list, so `steps` is a list of four mappings, each with a `uses` or a `run`. `[main]` is the same kind of list written on one line. Drop the space in `-run: pytest -q` and it isn't a list item any more: the parser returns a mapping with the key `-run`.",
      },
      {
        concept: "scalars",
        text: "A plain value is read by how it looks: `20` is a number, and in YAML 1.1 `yes`, `no`, `on` and `off` are true or false, so `country: NO` reads as `false`. Quotes keep text as text, which is why `\"3.12\"` stays the string `3.12`. `\${{ secrets.DATABASE_URL }}` is plain text to YAML too: GitHub replaces it with the secret's value when the job runs.",
      },
      {
        concept: "indentation",
        text: "Nesting is set by spaces alone. A tab in front of `test:` gives `found character that cannot start any token`, and a `cache: pip` indented one space less than the `python-version` line above it gives `did not find expected key while parsing a block mapping`.",
      },
    ],
    notes: [
      "Parsed, the file is a mapping with three keys, `name`, `true` and `jobs`. An empty `pull_request:` is `null`, which GitHub takes to mean its default pull request events: opened, reopened and new commits pushed.",
      "`branches: [main]` sits under `push`, so it limits pushes only. Pull requests run the tests whatever branch they target.",
      "`cache: pip` asks `actions/setup-python` to save pip's downloads between runs, keyed on your requirements file.",
      "Secrets aren't passed to a workflow run for a pull request from a fork, so there `DATABASE_URL` is an empty string and tests that need the database fail.",
      "The file was parsed with the YAML library in Ruby 2.6, not run on GitHub. Parsing checks the YAML, not whether GitHub accepts the workflow.",
    ],
    watchOut:
      "Quote version numbers. `python-version: 3.10` without quotes is the number 3.1, and the list `[3.9, 3.10, 3.11]` reads as `[3.9, 3.1, 3.11]`. GitHub reads it the same way, so the job asks for Python 3.1.",
  },
  {
    id: "json",
    fileName: "package.json",
    lead: "Paste JSON, such as a package.json, and Vibe explains what each field is for, what npm runs for each script and which versions `^` and `~` let in.",
    description:
      "Paste JSON and get a plain English explanation, free online. The sample is a package.json for a small Node tool: its scripts, dependencies and version ranges.",
    sampleSummary: "A package.json for a Node command-line tool, with start and test scripts, a pretest check, an engines line and dependencies pinned three different ways.",
    sample: `{
  "name": "csv-report",
  "version": "1.2.0",
  "description": "Turn a sales CSV export into a monthly summary",
  "type": "module",
  "bin": {
    "csv-report": "./bin/report.js"
  },
  "scripts": {
    "start": "node bin/report.js data/sales.csv",
    "pretest": "node bin/check-data.js",
    "test": "node --test"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "csv-parse": "^5.5.0",
    "dayjs": "~1.11.10"
  },
  "devDependencies": {
    "prettier": "3.3.3"
  }
}`,
    shows: [
      {
        concept: "objects and arrays",
        text: "The whole file is one JSON object: keys in double quotes, a colon, then a value, with commas between pairs. A value can be another object, like `scripts` and `dependencies` here, so each one groups its own named entries.",
      },
      {
        concept: "scripts",
        text: "`npm start` runs the `start` line and `npm test` runs `test`. npm also runs a script called `pre` plus the name first, so `npm test` printed `data/sales.csv found` from `pretest` before the test ran. `npm pkg get dependencies.dayjs` reads one field back without opening the file.",
      },
      {
        concept: "version ranges",
        text: "`^5.5.0` allows any 5.x.x from 5.5.0 up, `~1.11.10` only 1.11.x patches, and `3.3.3` that exact version. On 5 Nov npm installed csv-parse 5.6.0 although 7.0.3 was out, dayjs 1.11.23, and prettier 3.3.3 while 3.9.10 was the latest.",
      },
      {
        concept: "strict syntax",
        text: "JSON is stricter than JavaScript: no comments, no comma after the last item and only double quotes. One stray comma after `\"3.3.3\"` made every npm command stop with `npm error code EJSONPARSE` and `Note: package.json must be actual JSON, not just JavaScript.`",
      },
    ],
    notes: [
      "Run with npm 11.10.1 on Node 25.7.0: `npm install` added the 3 packages, `npm start` printed `2026-10 200.50` and `2026-11 42.25`, and `npm test` passed 1 test.",
      "`\"type\": \"module\"` tells Node the .js files use `import`. With that line removed, Node 25 still ran the tool but printed a `MODULE_TYPELESS_PACKAGE_JSON` warning first, because it had to read each file twice to find out.",
      "`engines` is a request, not a lock. With `\"node\": \">=26\"` on Node 25, `npm install` printed `npm warn EBADENGINE Unsupported engine` and installed everything anyway, exit code 0.",
    ],
    watchOut:
      "`devDependencies` are for working on the project, not for using it. With `import prettier from \"prettier\"` added to `bin/report.js`, the tool ran after a full `npm install` but failed after `npm install --omit=dev`, which skips devDependencies, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'prettier'`.",
  },
  {
    id: "awk",
    fileName: "totals.awk",
    lead: "Paste awk, one-liners included, and Vibe explains which lines each pattern picks, which column each `$` number reads and what an array is adding up.",
    description:
      "Paste awk code and get a plain English explanation, free online. The sample totals sales per region from a CSV file, skips the header and sorts the result.",
    sampleSummary: "An awk script that skips a CSV file's header, adds up sales per region in an array and prints the totals sorted largest first.",
    sample: `# Total sales per region from a CSV export with a header row:
#   date,region,product,amount
# Run: awk -f totals.awk sales.csv

BEGIN { FS = "," }

NR == 1 { next }               # skip the header line

$4 == "" {                     # a sale with no amount yet
  missing++
  next
}

{
  total[$2] += $4
  rows[$2]++
}

END {
  for (region in total)
    printf "%-6s %8.2f  %d sales\\n", region, total[region], rows[region] | "sort -k2 -rn"
  close("sort -k2 -rn")
  print missing + 0, "rows had no amount"
}`,
    shows: [
      {
        concept: "fields",
        text: "`FS = \",\"` splits every line at its commas, so `$2` is the region and `$4` is the amount. awk turns `$4` into a number when it adds it: `12.50` adds 12.5, and text that doesn't start with a number adds 0.",
      },
      {
        concept: "patterns and actions",
        text: "Each `pattern { action }` runs on every line its pattern matches, in order from the top. `NR == 1 { next }` matches the first line, and `next` moves straight on to the line after, so the header never reaches the totals. `$4 == \"\"` catches a sale with no amount, and the last block has no pattern, so it runs on every line still left.",
      },
      {
        concept: "associative arrays",
        text: "`total[$2] += $4` uses the region as the key. The first time a region turns up its entry is empty, which counts as 0, so nothing has to be set up first. `rows[$2]++` counts each region's sales the same way.",
      },
      {
        concept: "BEGIN and END",
        text: "`BEGIN` runs before the first line is read, which is why `FS` is set there, and `END` runs after the last one. `for (region in total)` visits the keys in no set order, so each line goes through `sort -k2 -rn`, which sorts on the second column as a number, largest first.",
      },
    ],
    notes: [
      "Run on six sales with one missing amount, the script prints `west` 32.50 from 2 sales, `east` 28.00 from 2 and `north` 12.50 from 1, then `1 rows had no amount`.",
      "`close(\"sort -k2 -rn\")` waits for `sort` to finish. Without it, `1 rows had no amount` came out above the totals in this run, because `sort` can't print anything until its input is closed, and awk only closes it on exit.",
      "Given two files, `NR` keeps counting across both, so only the first header is skipped: the second file's header adds a region called `region` with 0.00. `FNR == 1` starts again for each file and skips both headers.",
      "The sample was run with the awk that comes with macOS, `awk version 20200816`, and uses only standard awk. Sorting inside awk with `asort` or `PROCINFO[\"sorted_in\"]` is gawk-only, which is why the sample hands its lines to `sort`.",
    ],
    watchOut:
      "awk splits at every comma, even one inside quotes. A product written `\"poster, large\"` becomes two fields, so `$4` is the text `large\"` with a space in front, which counts as 0: that sale's 30 is lost and `west` shows 12.50 from 2 sales, with no error. gawk 5.3 and later have a `--csv` option that reads quoted fields, while this macOS awk prints `unknown option --csv ignored`.",
  },
  {
    id: "make",
    fileName: "Makefile",
    lead: "Paste a Makefile and Vibe explains what each rule builds, why make reruns some commands and skips others, and what `$@`, `$^` and `$<` stand for.",
    description:
      "Paste a Makefile and get a plain English explanation, free online. The sample builds a small C program, rebuilds only the files that changed and runs a test.",
    sampleSummary: "A Makefile that compiles a C word-count tool from every file in src/, keeps the object files in build/ and checks the tool's output.",
    sample: `# Build the \`wordcount\` tool from the C files in src/.
# Run: make (build), make test (build, then check the output), make clean

CC      := cc
CFLAGS  := -Wall -Wextra -O2
SRC     := $(wildcard src/*.c)
OBJ     := $(SRC:src/%.c=build/%.o)

wordcount: $(OBJ)
	$(CC) $(CFLAGS) -o $@ $^

build/%.o: src/%.c src/count.h | build
	$(CC) $(CFLAGS) -c $< -o $@

build:
	mkdir -p build

test: wordcount
	./wordcount < tests/sample.txt | diff - tests/expected.txt

clean:
	rm -rf build wordcount

.PHONY: test clean`,
    shows: [
      {
        concept: "targets and prerequisites",
        text: "Each rule reads `target: prerequisites`, with its commands on the lines under it. make runs a rule's commands only when the target is missing or older than one of its prerequisites, so a second `make` in a row printed `make: 'wordcount' is up to date.` and compiled nothing.",
      },
      {
        concept: "variables",
        text: "`:=` sets a variable once, when make reads the line. `$(wildcard src/*.c)` lists the C files that exist, and `$(SRC:src/%.c=build/%.o)` turns each one into its object file's name, so `src/main.c` becomes `build/main.o`. A new .c file in src/ joins the build with no edit to the Makefile.",
      },
      {
        concept: "pattern rules",
        text: "`build/%.o: src/%.c src/count.h` is one rule for every object file, where `%` is the same name on both sides. Because the header is listed too, touching `src/count.h` recompiled both files and relinked the tool. The `| build` part is an order-only prerequisite: the folder has to exist first, but its newer time stamp never causes a rebuild.",
      },
      {
        concept: "automatic variables",
        text: "`$@` is the rule's target, `$^` all its prerequisites and `$<` the first one. So the link step ran `cc -Wall -Wextra -O2 -o wordcount build/count.o build/main.o`, and each compile got only its own .c file.",
      },
      {
        concept: "phony targets",
        text: "`test` and `clean` name jobs, not files, and `.PHONY` says so. It matters once a file with that name turns up: with the `.PHONY` line removed, a file called `test` newer than the tool made `make test` print `make: 'test' is up to date.` and skip the test.",
      },
    ],
    notes: [
      "Run with GNU Make 4.4.1 on a three-file C project, the first `make` ran `mkdir -p build`, two compiles and the link, and `make test` passed (`3 lines, 9 words, 44 characters`).",
      "Editing only `src/main.c` recompiled `main.o` and relinked, and left `count.o` alone. On a big project that is the point of make: only what changed gets built again.",
      "When the output differs, `diff` prints both lines and exits with 1, so make stops with `make: *** [Makefile:19: test] Error 1`, and a CI job running `make test` fails.",
    ],
    watchOut:
      "Each command line has to start with a tab, not spaces. With the tabs turned into four spaces, which some editors do on save, make stopped at the first command with `Makefile:10: *** missing separator.  Stop.` and built nothing.",
  },
  {
    id: "perl",
    fileName: "slow_pages.pl",
    lead: "Paste Perl and Vibe explains what each regular expression captures, whether a sigil means one value, a list or a hash, and what a `sort` block compares.",
    description:
      "Paste Perl code and get a plain English explanation, free online. The sample reads a web server log, averages response times per page and counts server errors.",
    sampleSummary: "A Perl script that reads a web server log, averages each page's response time in two hashes and prints the three slowest pages and the server error count.",
    sample: `# Which pages are slow? Reads web server log lines like:
#   2026-11-05T09:14:02 GET /pricing 200 412ms
# Run: perl slow_pages.pl access.log
use strict;
use warnings;

my (%total_ms, %hits);
my $errors = 0;

while (my $line = <>) {
    next unless $line =~ m{^\\S+ (GET|POST) (\\S+) (\\d{3}) (\\d+)ms$};
    my ($path, $status, $ms) = ($2, $3, $4);
    $errors++ if $status >= 500;
    $total_ms{$path} += $ms;
    $hits{$path}++;
}

my @slowest = sort { $total_ms{$b} / $hits{$b} <=> $total_ms{$a} / $hits{$a} } keys %hits;

for my $path (@slowest[0 .. 2]) {
    last unless defined $path;
    printf "%-12s %5.0f ms average over %d requests\\n",
        $path, $total_ms{$path} / $hits{$path}, $hits{$path};
}
print "$errors server errors\\n";`,
    shows: [
      {
        concept: "scalars, arrays and hashes",
        text: "The first character says what a variable holds: `$line` is one value, `@slowest` a list and `%hits` a hash of keys and values. One entry of a hash is a single value, so it takes `$`: `$hits{$path}`. The first time a path turns up its entry is empty, and `++` starts it from 0.",
      },
      {
        concept: "regular expressions",
        text: "`m{...}` is a match written with braces in place of slashes, which helps when the text has `/` in it. Each pair of brackets captures one part into `$1` to `$4`: the method, the path, the 3-digit status and the milliseconds. `next unless` skips a line that doesn't match, so the sample log's `health check ok` line is ignored.",
      },
      {
        concept: "strict and warnings",
        text: "`use strict` makes every variable be declared with `my`. Without it, a typo such as `$hit{...}` for `$hits{...}` quietly made a second hash and the count came out as `0 paths`. With it, Perl refused to run and named `%hit`.",
      },
      {
        concept: "sort with a comparison",
        text: "`sort { ... } keys %hits` orders the paths using the block, where `$a` and `$b` are the two being compared. `<=>` compares numbers, and putting `$b` on the left sorts largest first, here by average time. `@slowest[0 .. 2]` takes the first three, and `last unless defined $path` stops early when the log has fewer pages.",
      },
    ],
    notes: [
      "Run with Perl 5.42.2 on a 9-line sample log, the script printed `/api/signup` at 925 ms average over 2 requests, `/pricing` at 396 ms and `/docs` at 92 ms, then `1 server errors` for the one 503.",
      "`<>` reads the files named on the command line a line at a time, or standard input when there are none, so `cat access.log | perl slow_pages.pl` printed the same result.",
      "With only two pages in the log, the script printed both and stopped with no warning, because of the `defined` check.",
    ],
    watchOut:
      "`==` compares numbers and `eq` compares text. `\"GET\" == \"POST\"` came out true: Perl turned both words into 0, printed `Argument \"POST\" isn't numeric in numeric eq (==)` and carried on. A log saved on Windows has a hidden `\\r` at the end of each line, so `ms$` never matched and the script printed only `0 server errors`, with no error. Adding `$line =~ s/\\r$//;` as the loop's first line fixed it.",
  },
  {
    id: "sed",
    fileName: "tidy.sed",
    lead: "Paste a sed command or script and Vibe explains which lines each address picks, what a `s///` swaps in and what `\\1` and `\\2` hold.",
    description:
      "Paste a sed command or script and get a plain English explanation, free online. The sample cleans up a settings file, rewrites dates and hides secret values.",
    sampleSummary: "A sed script that strips comments and blank lines from a settings file, rewrites dates, hides token and password values and keeps one section.",
    sample: `# Tidy an exported settings file before sharing it.
# Run: sed -E -f tidy.sed settings.conf > shared.conf

# Drop comment lines and blank lines.
/^[[:space:]]*#/d
/^[[:space:]]*$/d

# Trim spaces at the start and end of every line.
s/^[[:space:]]+//
s/[[:space:]]+$//

# One space around the first "=" on each line.
s/[[:space:]]*=[[:space:]]*/ = /

# Dates from 2026-11-05 to 05/11/2026.
s/([0-9]{4})-([0-9]{2})-([0-9]{2})/\\3\\/\\2\\/\\1/g

# Hide the value of any key ending in _token or _password.
s/^([a-z_]+_(token|password)) = .*/\\1 = [hidden]/

# Only keep the [server] section, up to the next [section].
/^\\[server\\]/,/^\\[/!d`,
    shows: [
      {
        concept: "addresses",
        text: "A command can start with an address that picks the lines it runs on. `/^[[:space:]]*#/d` deletes every line whose first non-space character is `#`, and `d` also stops work on that line, so a deleted line never reaches the later commands. Every other line runs through each command from the top, in order.",
      },
      {
        concept: "substitution",
        text: "`s/old/new/` replaces the first match on each line, and `g` at the end replaces every match. On a line with two dates, the script rewrote both; the same command without `g` rewrote only the first and left `2026-11-30` as it was.",
      },
      {
        concept: "capture groups",
        text: "Brackets in the pattern save what they match, and `\\1`, `\\2` and `\\3` put it back in the replacement, so the year, month and day come back in a new order. `-E` turns on extended regular expressions, where plain brackets capture and `{4}` means four times. Run without `-E`, sed stopped with `invalid reference \\3 on 's' command's RHS`.",
      },
      {
        concept: "ranges",
        text: "`/^\\[server\\]/,/^\\[/` picks every line from `[server]` to the next line that starts with `[`, and `!` turns it around, so `!d` deletes everything outside that range. When `[server]` was the last section, the range ran to the end of the file.",
      },
    ],
    notes: [
      "Run with GNU sed 4.10 on a 13-line settings file, the script printed 7 lines: `[server]`, `host = example.internal`, `port = 8080`, `api_token = [hidden]`, `db_password = [hidden]`, `started = 05/11/2026 09:14` and `[logging]`.",
      "`[logging]` is still in the output because a range includes the line that ends it. That line starts with `[`, so it closes the `[server]` range and is kept with it.",
      "`sed -i` writes the result back over the file instead of printing it, and `-i.bak` first keeps the original as `settings.conf.bak`. Run on a copy, `-i` with no suffix left no way back to the comments.",
    ],
    watchOut:
      "`[a-z_]+` and `(token|password)` only match lowercase letters, so a line written `API_TOKEN = abc` came through as `API_TOKEN = abc`, with the secret showing and no error. Adding GNU sed's `I` flag after the last slash makes the match ignore case, and then it printed `API_TOKEN = [hidden]`.",
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
