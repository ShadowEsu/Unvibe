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
    id: "pyproject-toml",
    fileName: "pyproject.toml",
    lead: "Paste a pyproject.toml and Vibe explains what each table does: how the package is built, what it depends on, which commands it installs and where tools like pytest read their settings.",
    description:
      "Paste a pyproject.toml and get it explained in plain English, free online. The sample builds a small Python package with setuptools, one dependency, a dev extra and a command line script.",
    sampleSummary: "A pyproject.toml for a small package: the setuptools build backend, name and version, the Python versions it supports, one dependency, a dev extra with pytest, a command called invoicer and pytest's settings.",
    sample: `# pyproject.toml: how to build, install and run the "invoicer" package.

[build-system]
requires = ["setuptools>=69"]
build-backend = "setuptools.build_meta"

[project]
name = "invoicer"
version = "0.3.1"
description = "Turn a CSV of hours into a PDF invoice"
requires-python = ">=3.10"
dependencies = [
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = ["pytest>=8"]

[project.scripts]
invoicer = "invoicer.cli:main"

[tool.pytest.ini_options]
testpaths = ["tests"]`,
    shows: [
      {
        concept: "[build-system]",
        text: "`[build-system]` tells pip what to install before it can build the package, here setuptools, and which backend does the build. `pip install .` read it, built the package and installed it: `pip show invoicer` then printed `Version: 0.3.1` and the description as its `Summary`.",
      },
      {
        concept: "dependencies and extras",
        text: "`dependencies` installs with the package: `pip show invoicer` listed `Requires: python-dotenv`, and python-dotenv was installed with it. `[project.optional-dependencies]` only installs when asked for: pytest came in with `pip install \".[dev]\"` and not with plain `pip install .`.",
      },
      {
        concept: "[project.scripts]",
        text: "Each line under `[project.scripts]` becomes a command. `invoicer = \"invoicer.cli:main\"` means: make a command called `invoicer` that runs the `main` function in `invoicer/cli.py`. After the install, typing `invoicer` printed `invoicer 0.3.1: ready`.",
      },
      {
        concept: "[tool.*] tables",
        text: "Tables under `[tool]` belong to other tools, which read their own. pytest reads `[tool.pytest.ini_options]`: run in the project folder, `pytest -q` found the test in `tests` and printed `1 passed`.",
      },
    ],
    notes: [
      "Run with Python 3.14 and pip 26.2 in a fresh virtual environment.",
      "`requires-python` is checked at install time. Changed to `>=3.99`, pip stopped with `ERROR: Package 'invoicer' requires a different Python: 3.14.7 not in '>=3.99'`.",
      "Names under `[project]` are checked. With `dependencies` misspelled as `dependancies`, the build failed with `configuration error`, saying `project` must not contain `{'dependancies'}`.",
    ],
    watchOut:
      "A plain `pip install .` copies your code, so edits don't show until you install again. After changing `cli.py`, `invoicer` still printed `invoicer 0.3.1: ready`. Installed with `pip install -e .` instead, the same edit showed straight away: `invoicer 0.3.1: edited`.",
  },
  {
    id: "requirements-txt",
    fileName: "requirements.txt",
    lead: "Paste a requirements.txt and Vibe explains what each line asks pip for: an exact version, a range, a compatible release or a package only some machines need.",
    description:
      "Paste a requirements.txt and get it explained in plain English, free online. The sample pins one package, allows a range for another, uses ~= for a third and installs a fourth only on Windows.",
    sampleSummary: "A requirements.txt for a small Python app: requests pinned to one version, python-dotenv limited to 1.x, rich allowed any 15.x release, and tzdata only on Windows.",
    sample: `# requirements.txt: the packages this app needs, one per line.
# Install them all with: pip install -r requirements.txt

# Exactly this version, so every machine gets the same code.
requests==2.34.2

# 1.0 or newer, but not 2.0 or anything after it.
python-dotenv>=1.0,<2

# 15.0 or any later 15.x release.
rich~=15.0

# Only installed on Windows, which has no IANA time zone database.
tzdata; sys_platform == "win32"`,
    shows: [
      {
        concept: "pip install -r",
        text: "`pip install -r requirements.txt` installs every line in one go. In a fresh virtual environment it printed `Successfully installed` for 10 packages: the 3 named here plus 7 they need, such as `urllib3` and `certifi` for requests. Running it again changed nothing and printed `Requirement already satisfied` 10 times.",
      },
      {
        concept: "==, >= and <",
        text: "`==2.34.2` allows that one version only. `>=1.0,<2` allows 1.0 and up to, but not including, 2.0: pip's own version checker accepted 1.0 and 1.2.4 and turned down 0.9 and 2.0, and pip installed python-dotenv 1.2.4.",
      },
      {
        concept: "~= compatible release",
        text: "`~=15.0` means 15.0 or newer, but still 15: the same checker accepted 15.0 and 15.3 and turned down 14.9 and 16.0. pip installed rich 15.0.0.",
      },
      {
        concept: "markers after ;",
        text: "Text after `;` is a condition about the machine. On this machine, which isn't Windows, pip printed `Ignoring tzdata: markers 'sys_platform == \"win32\"' don't match your environment` and skipped it. Python's zoneinfo docs recommend tzdata because Windows systems don't have an IANA time zone database.",
      },
    ],
    notes: [
      "Run with Python 3.14 and pip 26.2 in a fresh virtual environment, with the versions that were current on PyPI at the time.",
      "Two lines that can't both be true stop the install: `requests==2.34.2` with `requests>=3` gave `ERROR: Cannot install requests==2.34.2 and requests>=3 because these package versions have conflicting dependencies.`",
      "A version that doesn't exist fails with `Could not find a version that satisfies the requirement requests==9.9.9`, followed by the versions that do exist.",
      "`pip uninstall requests` removed only requests: `urllib3`, `certifi` and `idna`, which came in with it, stayed installed.",
    ],
    watchOut:
      "`pip freeze > requirements.txt` writes down everything installed, not what you asked for. After installing these 4 lines, `pip freeze` listed 10 packages, each pinned with `==`, including `Pygments==2.21.0` and `mdurl==0.1.2`, which came in with rich and not from any line here. Keep the short file you wrote, and use freeze only when you want every version locked.",
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
    id: "jquery",
    fileName: "products.js",
    lead: "Paste jQuery and Vibe explains what each `$()` selects, which element a handler runs on, and what `this` and `.closest()` point to.",
    description:
      "Paste jQuery code and get a plain English explanation, free online. The sample filters a product list as you type and removes items with a fade.",
    sampleSummary: "A jQuery script that filters a product list as you type, keeps a count of what's shown and fades out an item when its Remove button is clicked.",
    sample: `// Filter a product list as you type, and remove items with a fade.
// Load jQuery first: <script src="jquery.min.js"></script>
$(function () {
  const $items = $("#products li");

  $("#search").on("input", function () {
    const term = $(this).val().toLowerCase();
    $items.each(function () {
      const name = $(this).find(".name").text().toLowerCase();
      $(this).toggle(name.includes(term));
    });
    $("#count").text($items.filter(":visible").length + " shown");
  });

  $("#products").on("click", ".remove", function () {
    $(this).closest("li").fadeOut(200, function () {
      $(this).remove();
    });
  });
});`,
    shows: [
      {
        concept: "selectors",
        text: "`$(\"#products li\")` takes a CSS selector and returns every matching element, wrapped so jQuery methods work on all of them at once. `$(function () { ... })` waits for the page to be ready before running. `:visible` is jQuery's own addition: `document.querySelectorAll(\":visible\")` threw `':visible' is not a valid selector`.",
      },
      {
        concept: "events",
        text: "`.on(\"input\", ...)` runs on every keystroke in the search box, and inside the handler `this` is the element the handler runs for, here the search box. `.on(\"click\", \".remove\", ...)` is a delegated handler: it sits on the list and runs for any `.remove` button inside it, with `this` set to that button, so a Remove button added after the page loaded worked too.",
      },
      {
        concept: "traversal",
        text: "`.find(\".name\")` looks down inside each item, and `.closest(\"li\")` walks up from the clicked button to the item it belongs to. `.filter(\":visible\")` keeps the items still showing, which is how the count line reads `2 shown` after typing `blue`.",
      },
      {
        concept: "effects",
        text: "`.toggle(true)` shows an item and `.toggle(false)` hides it. `.fadeOut(200, ...)` fades the item over 200 ms and then runs the function, so the item was still in the list straight after the click and gone 400 ms later, once `.remove()` had run.",
      },
    ],
    notes: [
      "Run with jQuery 4.0.0 in Chromium on a list of three products: typing `blue` left `Blue mug` and `Blue plate` with `2 shown`, clearing the box brought back all three, and Remove on `Red mug` faded it out and took it off the list.",
      "The same Remove handler bound straight to the buttons with `$(\".remove\").on(\"click\", ...)` removed an original item but did nothing on a button added later, because that button didn't exist when the handler was bound.",
      "`$items` is a common naming habit, not syntax: the `$` at the start reminds you the variable holds a jQuery object, not a plain element.",
    ],
    watchOut:
      "`$items` is looked up once, when the page loads. A product added later isn't in it, so typing `blue` hid nothing new: an added `Green bowl` stayed on screen while the count still said `2 shown`. Looking the items up inside the input handler with `$(\"#products li\")` fixed both.",
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
    id: "tsconfig",
    fileName: "tsconfig.json",
    lead: "Paste a tsconfig.json and Vibe explains what each compiler option changes, which files TypeScript checks and why `strict` suddenly finds errors.",
    description:
      "Paste a tsconfig.json and get a plain English explanation, free online. The sample builds a Node project from src/ to dist/ with strict checks on.",
    sampleSummary: "A tsconfig.json that compiles a small Node project from src/ to dist/ with strict checks, Node's own module rules, type files and source maps, and leaves test files out.",
    sample: `{
  // Compile src/ to dist/ for Node 20 and later. Run: npx tsc
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}`,
    shows: [
      {
        concept: "compilerOptions",
        text: "`target` is the JavaScript version to write, `rootDir` and `outDir` say where the .ts files are and where the .js files go. `declaration` adds a .d.ts type file next to each .js file and `sourceMap` a .js.map, so one `npx tsc` wrote six files for two sources: `index.js`, `index.d.ts`, `index.js.map` and the same three for `prices`.",
      },
      {
        concept: "strict checks",
        text: "`strict` turns on a group of checks. One of them stopped `function double(x)` with `error TS7006: Parameter 'x' implicitly has an 'any' type.` `noUncheckedIndexedAccess` isn't part of `strict`: it treats `prices[0]` as maybe missing, so `first.toFixed(2)` failed with `'first' is possibly 'undefined'.` and passed with the option off.",
      },
      {
        concept: "modules",
        text: "`NodeNext` makes TypeScript follow Node's own rules for imports, which depend on package.json's `\"type\": \"module\"`. Under them a relative import needs its file extension, and you write `.js` even though the file on disk is .ts: `import { total } from \"./prices\"` failed with `error TS2835: Relative import paths need explicit file extensions`, and `\"./prices.js\"` worked. Without the `\"type\"` line, the same import compiled.",
      },
      {
        concept: "include and exclude",
        text: "`include` lists the files to start from and `exclude` takes some of them back out, so `npx tsc --listFilesOnly` named `src/prices.ts` and `src/index.ts` but not the test file. Patterns use `**` for any number of folders.",
      },
    ],
    notes: [
      "Run with TypeScript 5.9.3 on a two-file project: `npx tsc` finished with no errors, and `node dist/index.js` printed `total 19.75` and `cheapest 3.25`.",
      "Unlike package.json, a tsconfig.json may have `//` comments, and the compiler read this one, comment included, without complaint.",
      "`skipLibCheck` skips checking every .d.ts file, the ones in installed packages and any you write yourself (TypeScript's docs: \"Skip type checking of declaration files.\"). Builds get faster, and errors inside those files go unreported; your .ts files are still checked.",
    ],
    watchOut:
      "`exclude` only changes where TypeScript starts, not what it compiles. When `src/run-tests.ts` imported `./prices.test.js`, the test file was checked and written to `dist/` anyway, and `--listFilesOnly` listed it. To keep a file out of the build, nothing the build includes may import it.",
  },
  {
    id: "npm-scripts",
    fileName: "shop/package.json",
    lead: "Paste the `scripts` from a package.json and Vibe explains what `npm run dev`, `npm run build` and the rest actually run, in what order, and where each command comes from.",
    description:
      "Paste npm scripts and get a plain English explanation of npm run dev, build, test and lint, free online. The sample is a small shop's package.json with eight scripts.",
    sampleSummary: "A package.json with the usual npm scripts: dev with a file watcher, start, build with a prebuild step, test, lint with ESLint, one that chains two others and one that prints package fields.",
    sample: `{
  "name": "shop",
  "version": "1.2.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js",
    "prebuild": "node clean.js",
    "build": "node build.js",
    "test": "node --test",
    "lint": "eslint .",
    "check": "npm run lint && npm test",
    "hello": "echo \\"$npm_package_name v$npm_package_version\\""
  },
  "devDependencies": {
    "eslint": "^9.39.0"
  }
}`,
    shows: [
      {
        concept: "npm run",
        text: "Each entry under `scripts` is a name and a shell command. `npm run build` runs the `build` line, and `npm run` on its own listed every script. `start` and `test` are special enough to have shortcuts: `npm start` and `npm test` work without `run`, while `npm run dev` needs it.",
      },
      {
        concept: "pre and post",
        text: "A script named `pre` plus another script's name runs first. `npm run build` printed `clean: removed dist/` from `prebuild`, then `build: wrote dist/app.js`. Each step is announced with a `>` line, such as `> shop@1.2.0 prebuild`.",
      },
      {
        concept: "local tools",
        text: "npm puts the project's own `node_modules/.bin` first on the PATH while a script runs. After `npm install` added ESLint 9.39.5, typing `eslint --version` in the terminal gave `eslint: command not found`, but `npm run lint` found it and, for a file with one stray variable, reported `'unused' is assigned a value but never used`.",
      },
      {
        concept: "chaining and exit codes",
        text: "`&&` runs the next command only if the one before it succeeded. With a lint error, `npm run check` stopped after ESLint with exit code 1 and `npm test` never ran; with the error fixed, lint passed and the test ran, exit code 0. That exit code is what CI checks.",
      },
    ],
    notes: [
      "Run with npm 11.10.1 on Node 25.7.0. Before `npm install`, `npm run lint` stopped with `eslint: command not found` and exit code 127: listing a tool in devDependencies isn't enough until it's installed.",
      "npm passes the package's fields to scripts as environment variables: `npm run hello` printed `shop v1.2.0` from `$npm_package_name` and `$npm_package_version`.",
      "`npm run nope` stopped with `npm error Missing script: \"nope\"` and pointed to `npm run` for the list.",
    ],
    watchOut:
      "Extra arguments for the script go after `--`. `npm run hello -- --loud` ran `echo ... --loud` and printed `shop v1.2.0 --loud`, but `npm test --watch` without the `--` gave the flag to npm itself: `npm warn Unknown cli config \"--watch\"`, and `node --test` ran without it.",
  },
  {
    id: "eslint-config",
    fileName: "eslint.config.js",
    lead: "Paste an eslint.config.js and Vibe explains which files each block covers, which rules it turns on and which block wins when two of them disagree.",
    description:
      "Paste an ESLint config and get it explained in plain English, free online. The sample ignores a build folder, starts from the recommended rules and sets different globals and rules for browser code and Node scripts.",
    sampleSummary: "An ESLint flat config: a build folder left out, the recommended rules, browser globals and three rules for src, and Node globals for scripts.",
    sample: `// eslint.config.js: which files ESLint checks and which rules apply to them.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/"] },

  js.configs.recommended,

  {
    files: ["src/**/*.js"],
    languageOptions: { globals: globals.browser },
    rules: {
      "no-unused-vars": "warn",
      eqeqeq: "error",
      "no-console": ["warn", { allow: ["error"] }],
    },
  },

  {
    files: ["scripts/**/*.js"],
    languageOptions: { globals: globals.node },
  },
];`,
    shows: [
      {
        concept: "a list of blocks",
        text: "The file exports a list, and ESLint applies every block that matches a file, in order. On a test project, `npx eslint .` reported `src/cart.js` with `4 problems (2 errors, 2 warnings)` and exited with code 1, which is what makes a CI step fail.",
      },
      {
        concept: "files and globals",
        text: "`files` limits a block to matching paths, and `globals` tells ESLint which names exist there. `document` passed in src, because `globals.browser` has it, but `process` was flagged `'process' is not defined`. The same `process` in `scripts/build.js` passed, because that block uses `globals.node`.",
      },
      {
        concept: "rules and severity",
        text: "Each rule is `\"off\"`, `\"warn\"` or `\"error\"`, and some take options after it. `no-console` with `allow: [\"error\"]` warned about `console.log` and let `console.error` through. Only errors change the exit code: warnings alone would still exit with 0.",
      },
      {
        concept: "later blocks win",
        text: "`js.configs.recommended` sets `no-unused-vars` to error, and the src block below it sets warn. Later wins: `npx eslint --print-config src/cart.js` showed `no-unused-vars` at 1, which is warn, and the unused variable was reported as a warning.",
      },
    ],
    notes: [
      "Run with ESLint 9.39.5, @eslint/js 9.39.5 and globals 17.14.0 on a test project with one file in each folder.",
      "A block with only `ignores` leaves those paths out everywhere. Asked to check `dist/bundle.js` directly, ESLint printed `File ignored because of a matching ignore pattern`.",
      "`npx eslint --fix` only changes `==` where it's safe: it turned `typeof x == \"string\"` into `===` but left `items.length == 0` as it was, for you to change.",
    ],
    watchOut:
      "`ignores` only works for every file when it's alone in its block. Adding `rules: { semi: \"error\" }` next to `ignores: [\"dist/\"]` made ESLint check dist again, and it failed on the build output with `Parsing error: Unexpected token ;`. Moving `js.configs.recommended` to the end of the list has a similar surprise: it turned `no-unused-vars` back into an error.",
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
    id: "graphql",
    fileName: "query.graphql",
    lead: "Paste a GraphQL query and Vibe explains what it asks the server for: which fields come back, what each variable and argument does and how a fragment fits in.",
    description:
      "Paste a GraphQL query and get it explained in plain English, free online. The sample asks an orders API for open orders with their customer and items, using variables, a default value and a fragment.",
    sampleSummary: "A named GraphQL query with two variables, one with a default: it asks for orders with their id, total, customer name and items, plus the signed-in user's name and email through a fragment.",
    sample: `# query.graphql: ask an orders API for exactly the fields this page shows.
query OpenOrders($status: Status = OPEN, $first: Int!) {
  orders(status: $status, first: $first) {
    id
    total
    customer {
      name
    }
    items {
      name
      qty
    }
  }
  me {
    ...UserBits
  }
}

fragment UserBits on User {
  name
  email
}`,
    shows: [
      {
        concept: "fields",
        text: "A query lists the fields it wants, and the reply has the same shape with only those fields. Run against a test schema, each order came back with just `id`, `total`, `customer.name` and `items`; asking for only `id` returned `{ \"id\": \"1001\" }` and nothing else.",
      },
      {
        concept: "variables and defaults",
        text: "`$status` and `$first` are filled in from a separate JSON object sent with the query. `Int!` means required, and `= OPEN` is a default: with only `{\"first\": 2}`, the reply held two open orders, 1001 and 1003, and skipped the shipped 1002. Sending `\"status\": \"SHIPPED\"` returned 1002.",
      },
      {
        concept: "arguments",
        text: "Values in parentheses after a field, such as `orders(status: $status, first: $first)`, are arguments the server uses to pick what to return. Here they filter by status and cap how many orders come back.",
      },
      {
        concept: "fragments",
        text: "`fragment UserBits on User` is a reusable list of fields for a `User`, and `...UserBits` pastes it in. `me` came back with `name` and `email`, as if they were written there.",
      },
    ],
    notes: [
      "Run with graphql-js 17.0.2 against a small test schema of orders, items and users, with made-up data.",
      "The server checks every field name: asking for `price` gave `Cannot query field \"price\" on type \"Order\".`",
      "A field that holds an object needs its own list of fields. `customer` on its own gave `Field \"customer\" of type \"User!\" must have a selection of subfields. Did you mean \"customer { ... }\"?`",
      "A field without `!` in the schema can come back `null`: the second customer's `email` did.",
    ],
    watchOut:
      "A required variable left out stops the whole query. Sent without `$first`, it returned no data, only `Variable \"$first\" has invalid value: Expected a value of non-null type \"Int!\" to be provided.` Enum values are case-sensitive too: `\"shipped\"` was refused with `Did you mean the enum value \"SHIPPED\"?`",
  },
  {
    id: "git-log",
    fileName: "git-log.txt",
    lead: "Paste what `git log` printed and Vibe explains each commit, what the `Merge:` line and `(HEAD -> main)` mean and how to read the `--graph` lines.",
    description:
      "Paste git log output and get a plain English explanation, free online. The sample is a small shop repo's log: commits, a merged branch, a tag and the graph view.",
    sampleSummary: "The output of `git log -2` and `git log --oneline --graph --decorate --all` for a small repo: two people's commits, a branch merged back into main and a release tag.",
    sample: `$ git log -2
commit 6dd93ddd5276a4e1a8ee3c3af46db31f8057a267
Merge: b0b26af 6788b88
Author: Sam Lee <sam@example.com>
Date:   Wed Nov 4 08:30:00 2026 +0000

    Merge branch 'discount'

commit b0b26af6fdabbfa40bd89bb0cfc9e995afcdfd8c
Author: Sam Lee <sam@example.com>
Date:   Tue Nov 3 16:05:00 2026 +0000

    Say how to run it

$ git log --oneline --graph --decorate --all
*   6dd93dd (HEAD -> main, tag: v1.0) Merge branch 'discount'
|\\
| * 6788b88 (discount) Let total take a discount
* | b0b26af Say how to run it
|/
* 0626e29 Add cart total
* b5aaded Start the shop`,
    shows: [
      {
        concept: "commits",
        text: "Each entry is one commit, newest first: its full hash, who wrote it, when, and the message. `--oneline` keeps only a short hash and the first line, so `6dd93ddd5276...` became `6dd93dd`. `git log -1 --format='%h %an %ad %s' --date=short` printed `6dd93dd Sam Lee 2026-11-04 Merge branch 'discount'`.",
      },
      {
        concept: "merges",
        text: "A merge commit has two parents, and the `Merge:` line lists them: `b0b26af` is the commit main was on, and `6788b88` is the branch's last commit. `HEAD^1` named `Say how to run it` and `HEAD^2` named `Let total take a discount`.",
      },
      {
        concept: "the graph",
        text: "In `--graph`, each `*` is a commit and the lines show history splitting and joining: `|/` is where `discount` branched off after `Add cart total`, and `|\\` is where the merge brought it back. `--decorate` adds the names that point at a commit: `HEAD -> main` is the branch you're on, `tag: v1.0` a tag and `(discount)` the branch.",
      },
      {
        concept: "filtering",
        text: "`git log --author=Ana` listed only `Let total take a discount`, and `git log -- cart.js` only the 2 commits that changed that file. `git log discount..main` lists what main has that discount doesn't: the merge and `Say how to run it`. `main..discount` printed nothing, because the branch is fully merged.",
      },
    ],
    notes: [
      "Made with git 2.55.0 in a test repo with fixed names and dates, so the same commands give the same hashes. The graph's `|\\` and `|/` lines end in spaces in git's output; they're trimmed here.",
      "`git log -p` adds each commit's diff, and `--stat` a summary: for Ana's commit, `cart.js | 4 ++--` and `1 file changed, 2 insertions(+), 2 deletions(-)`.",
      "A long log opens in a pager, `less` unless you set another, so it can look stuck: press `q` to get back to the prompt.",
    ],
    watchOut:
      "A plain `git log` sorts every merged branch's commits into one list by date, so it isn't the order work landed on main: `git log --oneline` listed the merge, `Say how to run it`, then Ana's `Let total take a discount` from the branch, then `Add cart total`. `git log --first-parent` follows only main's side of each merge and listed 4 commits, the merge, `Say how to run it`, `Add cart total` and `Start the shop`, without Ana's.",
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
    id: "curl",
    fileName: "check-orders.sh",
    lead: "Paste a curl command and Vibe explains what each flag does: what gets sent, which headers go with it, and what curl does with the reply.",
    description:
      "Paste curl commands and get every flag explained in plain English, free online. The sample reads, creates and deletes orders on an API and follows a redirect.",
    sampleSummary: "A shell script with four curl calls to an orders API: a quiet GET that fails on errors, a JSON POST with a bearer token, a redirect saved to a file with its status code, and a DELETE that prints the response headers.",
    sample: `#!/bin/sh
# Talk to an orders API from the terminal: read, create, follow a redirect.
API="\${API:-http://localhost:8080}"

# GET: -s hides the progress bar, -f fails on HTTP errors (4xx, 5xx).
curl -sf "$API/api/orders?status=open"

# POST JSON: --json sets the body and the JSON headers in one flag.
curl -sf --json '{"item":"mug","qty":2}' \\
  -H "Authorization: Bearer $ORDERS_TOKEN" \\
  "$API/api/orders"

# -L follows redirects; -o saves the reply; -w prints the status code.
curl -sL -o orders.json -w "%{http_code}\\n" "$API/old"

# -X sets the method; -i prints the response headers above the body.
curl -si -X DELETE "$API/api/orders/42"`,
    shows: [
      {
        concept: "-s and -f",
        text: "`-s` hides the progress bar, and `-f` makes an HTTP error count as a failure. Against a page that answers 404, `curl -sf` printed nothing and exited with code 22, so a script can stop there. Without `-f`, curl printed the error page, `{\"error\":\"not found\"}`, and exited with 0 as if it had worked.",
      },
      {
        concept: "--json and -H",
        text: "`--json` sends its text as the body and adds the JSON headers: the test server saw a POST with `Content-Type: application/json`, `Accept: application/json` and the body `{\"item\":\"mug\",\"qty\":2}`. Each `-H` adds a header, and the server saw `Authorization: Bearer` followed by the token from `$ORDERS_TOKEN`.",
      },
      {
        concept: "-L, -o and -w",
        text: "`/old` answers with a 301 redirect. Without `-L`, `-w \"%{http_code}\"` printed `301`. With `-L`, curl followed it to `/api/orders`, saved that reply in orders.json and printed `200`.",
      },
      {
        concept: "-X and -i",
        text: "`-X DELETE` changes the method, and the server saw `DELETE /api/orders/42`. `-i` put the response headers above the body: `HTTP/1.0 200 OK`, the `Content-Type` and the `Content-Length`.",
      },
    ],
    notes: [
      "Run with curl 8.21 against a test server on this machine that sends back what it received: no request left the machine.",
      "`-d` also sends a body, but as form data: with `-d '{\"item\":\"mug\"}'` the server saw `Content-Type: application/x-www-form-urlencoded`, not JSON. Adding `-H \"Content-Type: application/json\"` changed that, or use `--json`.",
      "`-s` also hides curl's own error message. With `-sS`, a 404 still printed `curl: (22) The requested URL returned error: 404`.",
      "Single quotes stop the shell from filling in a variable: with `-H 'Authorization: Bearer $ORDERS_TOKEN'`, the server got the words `$ORDERS_TOKEN` instead of the token.",
    ],
    watchOut:
      "Quote any URL with `&` in it. Unquoted, `curl -s http://localhost:8080/api/orders?status=open&limit=5` was split by the shell at the `&`: curl ran in the background and the server saw only `/api/orders?status=open`, with `limit=5` gone.",
  },
  {
    id: "bashrc",
    fileName: ".bashrc",
    lead: "Paste a .bashrc and Vibe explains what each line sets up for a new terminal: aliases, functions, `PATH`, history and what `PS1` puts in your prompt.",
    description:
      "Paste a .bashrc and get a plain English explanation, free online. The sample sets up history, PATH, two aliases, a small function and a prompt with the git branch.",
    sampleSummary: "A personal .bashrc: an interactive-only guard, history settings, your own folder first on PATH, two aliases, a make-and-enter folder function and a prompt that shows the git branch.",
    sample: `# ~/.bashrc: read by every new interactive bash shell.
# Scripts and other non-interactive shells stop here.
[[ $- != *i* ]] && return

# History: more lines, no repeats, added to the file instead of overwriting it
HISTSIZE=5000
HISTCONTROL=ignoredups:erasedups
shopt -s histappend

# My own tools first, then the system's
export PATH="$HOME/bin:$PATH"
export EDITOR=nano

# Shortcuts
alias ll='ls -lah'
alias gs='git status --short'

# Make a folder and go into it: mkcd projects/new-app
mkcd() { mkdir -p "$1" && cd "$1"; }

# Prompt: user@host:folder, plus the git branch when there is one
PS1='\\u@\\h:\\w$(git branch --show-current 2>/dev/null | sed "s/.*/ (&)/")\\$ '`,
    shows: [
      {
        concept: "interactive shells",
        text: "bash reads ~/.bashrc each time it starts an interactive shell, the kind you type into. `$-` holds the shell's options and has an `i` only when it's interactive, so a script that ran `source ~/.bashrc` stopped at that line: its next line still ran, but `type ll` said `ll: not found`.",
      },
      {
        concept: "variables and PATH",
        text: "`export` hands a variable on to every program the shell starts, while `HISTSIZE` and `HISTCONTROL` are settings for bash itself. `PATH` is the list of folders searched for a command, in order, so with `$HOME/bin` put first, `command -v hello` found the `hello` script in ~/bin.",
      },
      {
        concept: "aliases and functions",
        text: "An alias swaps a short word for a longer command: `type ll` reported that `ll` is aliased to `ls -lah`. A function can take arguments, which an alias can't: `mkcd a/b` made both folders and moved into them, so `pwd` printed `~/a/b`.",
      },
      {
        concept: "the prompt",
        text: "`PS1` is the prompt. `\\u`, `\\h` and `\\w` stand for your user name, the computer's name and the current folder, and `$(...)` runs a command each time the prompt is drawn. In a repo on the `feature/login` branch, the prompt ended in `~/proj (feature/login)$`.",
      },
    ],
    notes: [
      "Run with GNU bash 5.3.15 on a test home folder, so nothing touched a real ~/.bashrc. Changes reach new terminals; in an open one, `source ~/.bashrc` reads the file again.",
      "Aliases are for typing, not for scripts: a script that defined `alias ll=\"ls -lah\"` and then ran `ll` stopped with `ll: command not found`. Write a function when a script needs the shortcut.",
      "The bash manual on the history lines: `erasedups` \"causes all previous lines matching the current line to be removed from the history list before that line is saved\", and with `histappend` \"the history list is appended to the file named by the value of the HISTFILE variable when the shell exits, rather than overwriting the file.\"",
    ],
    watchOut:
      "A login shell doesn't read ~/.bashrc. Started as `bash -l`, `type ll` printed `ll: not found`, because a login shell reads ~/.bash_profile instead. With `[ -f ~/.bashrc ] && . ~/.bashrc` in ~/.bash_profile, the same login shell had the alias.",
  },
  {
    id: "chmod",
    fileName: "set-permissions.sh",
    lead: "Paste chmod commands and Vibe explains what each number or letter code allows: who can read, change or run each file, and what `755`, `644` and `777` really mean.",
    description:
      "Paste chmod commands and get the numbers explained in plain English, free online. The sample sets permissions for a web app with 755, 644, 600, 700, u+x, go-w and a+rX.",
    sampleSummary: "A shell script that sets permissions before a deploy: numeric modes for a script, a config file, a secrets file and a private folder, then letter modes that add or remove one permission.",
    sample: `#!/bin/sh
# Set file permissions for a small web app before deploying it.
# Each digit is owner, group, everyone else: read = 4, write = 2, run = 1.

chmod 755 bin/deploy.sh         # owner: read, write, run; others: read, run
chmod 644 config/app.json       # owner: read, write; others: read only
chmod 600 config/secrets.env    # owner only: read and write
chmod 700 private               # only the owner can open this folder

chmod u+x bin/start.sh          # add run for the owner, change nothing else
chmod go-w shared/notes.txt     # take write away from group and others
chmod -R a+rX public            # everyone reads; X adds run to folders only

ls -l bin config`,
    shows: [
      {
        concept: "the three digits",
        text: "Each digit is a sum: read 4, write 2, run 1. The first digit is the file's owner, the second its group and the third everyone else. So 7 is 4+2+1, all three; 5 is read and run; 4 is read only; 0 is nothing. After the script, `ls -l` showed `-rwxr-xr-x` for deploy.sh (755) and `-rw-------` for secrets.env (600).",
      },
      {
        concept: "letter modes",
        text: "Letters change one thing and leave the rest: `u` is the owner, `g` the group, `o` others and `a` all three, with `+` to add and `-` to take away. `chmod u+x` turned start.sh from 644 into 744, `-rwxr--r--`, and `chmod go-w` turned notes.txt from 666 into 644.",
      },
      {
        concept: "folders",
        text: "On a folder, read lets you list the names in it, and run lets you go inside and open what's there. Capital `X` adds run only to folders, and to files that already have it: `chmod -R a+rX public` turned a 700 folder into 755 and a 600 page into 644, with no run bit on the page.",
      },
      {
        concept: "running scripts",
        text: "A script needs the run bit to start as `./run.sh`. At 644, `./run.sh` stopped with `Permission denied`; `sh run.sh` still ran it, because then `sh` is the program being run and only reads the file. After `chmod u+x run.sh` it started directly.",
      },
    ],
    notes: [
      "Run with chmod from GNU coreutils 9.11 as a normal user, in a test folder, with umask 022: new files came out 644 and new folders 755.",
      "`chmod 777` gives everyone read, write and run: `ls -l` showed `-rwxrwxrwx`. Any account on the machine can then change the file, so it's rarely the fix it looks like.",
      "750 is `-rwxr-x---`: the owner does everything, the group can read and run, and everyone else gets nothing.",
    ],
    watchOut:
      "`chmod -R 644` on a folder locks you out of it, because it takes the run bit off folders too. `chmod -R 644 site` printed `chmod: cannot access 'site/img': Permission denied` partway through, and afterwards `cd site/img` and reading `site/img/a.txt` were refused. `chmod -R u=rwX,go=rX site` put it right: 755 for both folders and 644 for the file.",
  },
  {
    id: "find",
    fileName: "clean-project.sh",
    lead: "Paste find commands and Vibe explains what each test picks out, which folders are skipped and what happens to every file that matches.",
    description:
      "Paste find commands and get them explained in plain English, free online. The sample looks through a project for logs, big files, recent changes and empty folders, and counts lines in its code.",
    sampleSummary: "A shell script with six find commands for a project cleanup: .log files, node_modules folders, files over 1 MB, files changed this week outside .git, line counts for .js files and deleting empty folders.",
    sample: `#!/bin/sh
# Find files in a project folder before a cleanup.

# Every .log file anywhere under the project.
find . -name "*.log"

# Only folders called node_modules, without looking inside them.
find . -type d -name node_modules -prune

# Files bigger than 1 MB.
find . -type f -size +1M

# Files changed in the last 7 days, skipping .git.
find . -path ./.git -prune -o -type f -mtime -7 -print

# Count the lines in every .js file outside node_modules.
find . -name "*.js" -not -path "*/node_modules/*" -exec wc -l {} +

# Delete empty folders.
find . -type d -empty -delete`,
    shows: [
      {
        concept: "start folder and tests",
        text: "`find .` walks the current folder and everything below it, and each test after it narrows the list. `-name \"*.log\"` matched by file name and found `./debug.log` and `./logs/app.log` on a test project. `-type d` means folders and `-type f` means files.",
      },
      {
        concept: "-prune",
        text: "`-prune` stops find from going into a folder it matched. The second command printed `./node_modules` and `./web/node_modules` and nothing from inside them. In the fourth, `-path ./.git -prune -o ...` skips `.git` and checks everything else.",
      },
      {
        concept: "-size and -mtime",
        text: "`-size +1M` means bigger than 1 MB and found the 2 MB `logs/big.bin`. `-mtime -7` means changed less than 7 days ago: it printed `logs/big.bin` and `src/app.js`, and skipped files last changed 20 and 30 days ago.",
      },
      {
        concept: "-exec and -delete",
        text: "`-exec wc -l {} +` runs a command on the matches, with `{}` standing for the file names; the `+` hands them over in one go, so `wc` printed one line per file and a `3 total`. The node_modules files were left out by `-not -path`. `-delete` removes what matched: it removed both empty folders under `tmp`, and then `tmp` too, once it was empty.",
      },
    ],
    notes: [
      "Run with GNU find 4.11 on a test project with code, logs, node_modules folders, a .git folder and empty folders.",
      "Quote patterns like `\"*.log\"`. Unquoted, the shell filled in the .log files in the current folder first, and find stopped with `find: paths must precede expression`, naming one of those files, and asked about a possible unquoted pattern after `-name`.",
      "Run a find without `-delete` first and read the list. Nothing asks before `-delete` removes a file.",
    ],
    watchOut:
      "`-o` means or, and an action such as `-print` only belongs to the test right before it. `find . -name \"*.log\" -o -name \"*.bin\" -print` printed only `./logs/big.bin`. With parentheses, `find . \\( -name \"*.log\" -o -name \"*.bin\" \\) -print` printed all four matches.",
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
    id: "sqlite",
    fileName: "shop.sql",
    lead: "Paste a SQLite schema or query and Vibe explains each table, constraint and join, and where SQLite behaves differently from other databases.",
    description:
      "Paste SQLite code and get a plain English explanation, free online. The sample creates two tables with keys and checks, adds an index, inserts rows and runs a report.",
    sampleSummary: "A SQLite script for a small shop: customers and orders tables with a foreign key, a CHECK and a default date, an index, a few rows and a spending report per customer.",
    sample: `-- A small shop database. Run: sqlite3 shop.db < shop.sql
PRAGMA foreign_keys = ON;

CREATE TABLE customers (
  id    INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total       REAL NOT NULL CHECK (total >= 0),
  placed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX orders_by_customer ON orders(customer_id);

INSERT INTO customers (email) VALUES ('ana@example.com'), ('sam@example.com');
INSERT INTO orders (customer_id, total) VALUES (1, 12.50), (1, 48.00), (2, 9.99);

SELECT c.email, count(o.id) AS orders, round(sum(o.total), 2) AS spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id
ORDER BY spent DESC;`,
    shows: [
      {
        concept: "tables and keys",
        text: "`INTEGER PRIMARY KEY` makes `id` the row's own number, filled in when you leave it out: the two customers got 1 and 2. `REFERENCES customers(id)` says each order belongs to a customer, and `UNIQUE` refuses a second row with the same email: `UNIQUE constraint failed: customers.email`.",
      },
      {
        concept: "constraints",
        text: "`CHECK (total >= 0)` is tested on every insert and update, so a total of -3 stopped with `CHECK constraint failed: total >= 0`. `DEFAULT (datetime('now'))` fills in `placed_at` when an insert leaves it out, as text in UTC: `2026-11-05 18:38:24`, the same second `date -u` showed.",
      },
      {
        concept: "joins and grouping",
        text: "`LEFT JOIN` keeps every customer, even one with no orders, and `GROUP BY c.id` folds each customer's orders into one row. Run with `sqlite3 -header -column`, the report showed `ana@example.com` with 2 orders and 60.5 spent, then `sam@example.com` with 1 and 9.99.",
      },
      {
        concept: "indexes",
        text: "`orders_by_customer` lets SQLite go straight to one customer's orders. `EXPLAIN QUERY PLAN` for `WHERE customer_id = 1` said `SEARCH orders USING INDEX orders_by_customer (customer_id=?)`; for `WHERE total > 10`, which has no index, it said `SCAN orders`, every row.",
      },
    ],
    notes: [
      "Run with the sqlite3 command-line tool, SQLite 3.53.4, on a new shop.db. Every error quoted here is that tool's own message.",
      "`PRAGMA foreign_keys = ON` lasts only for that connection. In a new `sqlite3 shop.db` session, `PRAGMA foreign_keys` printed 0 and an order for customer 99, who doesn't exist, was saved. With the pragma on, the same insert stopped with `FOREIGN KEY constraint failed`.",
      "Column types are loose unless you ask otherwise: `total` is `REAL`, yet inserting `'lots'` was stored as text, and `typeof(total)` said `text`. The text `'7.25'` was turned into the number 7.25. In a table declared `STRICT`, `'lots'` was refused with `cannot store TEXT value in REAL column t.total`.",
    ],
    watchOut:
      "Running the script a second time doesn't stop at the first error. sqlite3 reported `table customers already exists` and `UNIQUE constraint failed: customers.email` but went on, and the orders `INSERT` ran again: ana now had 4 orders and 121.0 spent. `sqlite3 -bail` stopped at the first error and left the 3 orders as they were. `CREATE TABLE IF NOT EXISTS` is not enough on its own: with it, the second run still doubled the orders to 6.",
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
    id: "xml",
    fileName: "catalog.xml",
    lead: "Paste XML and Vibe explains its structure: which elements hold which, what each attribute adds, and what `&amp;` and `<![CDATA[` are doing there.",
    description:
      "Paste XML and get a plain English explanation of its structure, free online. The sample is a product catalog with attributes, an escaped character and a CDATA block.",
    sampleSummary: "An XML product catalog: a root element with a schema reference, two products with attributes, nested tags, an escaped ampersand and a CDATA description.",
    sample: `<?xml version="1.0" encoding="UTF-8"?>
<!-- A shop's product list, checked against catalog.xsd -->
<catalog xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="catalog.xsd"
         updated="2026-11-05">
  <product id="mug-blue" inStock="true">
    <name>Blue mug</name>
    <price currency="USD">12.50</price>
    <tags>
      <tag>kitchen</tag>
      <tag>gift</tag>
    </tags>
  </product>
  <product id="plate-set" inStock="false">
    <name>Plates &amp; bowls set</name>
    <price currency="USD">48.00</price>
    <description><![CDATA[Fits <b>4 people</b>; dishwasher safe]]></description>
  </product>
</catalog>`,
    shows: [
      {
        concept: "elements and nesting",
        text: "An XML file is one tree: a single root element, here `<catalog>`, with every other element inside it, and each opening tag closed in the right order. Tag names are case-sensitive, so `<Name>Blue mug</name>` stopped the parser with `Opening and ending tag mismatch: Name line 7 and name`.",
      },
      {
        concept: "attributes",
        text: "Attributes add small facts to an element, in quotes inside its opening tag: `id=\"mug-blue\"`, `inStock=\"true\"`, `currency=\"USD\"`. The XPath query `//product[@inStock=\"true\"]/name/text()` picked out `Blue mug`, and `string(/catalog/@updated)` read `2026-11-05`.",
      },
      {
        concept: "escaping and CDATA",
        text: "`<` and `&` have jobs in XML, so in text they're written `&lt;` and `&amp;`: `Plates &amp; bowls set` reads back as `Plates & bowls set`. A plain `&` there stopped the parser with `xmlParseEntityRef: no name`. Inside `<![CDATA[ ... ]]>` nothing is read as markup, so the description came back as the text `Fits <b>4 people</b>; dishwasher safe`.",
      },
      {
        concept: "schemas",
        text: "A schema (.xsd) says which elements may appear, in what order and with what types. Well-formed isn't the same as valid: with the first `<name>` removed, the file still parsed, but the schema check said `Element 'price': This element is not expected. Expected is ( name ).` A price written `12,50` failed with `'12,50' is not a valid value of the atomic type 'xs:decimal'`.",
      },
    ],
    notes: [
      "Checked with xmllint, libxml2 2.15.3: `xmllint --noout catalog.xml` found no errors, `--schema catalog.xsd` printed `catalog.xml validates`, and XPath counted 2 tags and summed the prices to 60.5.",
      "`<?xml version=\"1.0\" encoding=\"UTF-8\"?>` is the declaration, and it has to come first. With a comment or even one blank line above it, xmllint stopped with `XML declaration allowed only at the start of the document`.",
      "In the schema, `id` has the type `xs:ID`, so two products with `id=\"mug-blue\"` failed with `'mug-blue' is not a valid value of the atomic type 'xs:ID'`: each ID can be used once per file.",
    ],
    watchOut:
      "A comment can't contain two hyphens in a row. With `check with xmllint --schema` in the comment on line 2, the whole file failed to parse with `Double hyphen within comment`, before any element was read.",
  },
  {
    id: "markdown",
    fileName: "README.md",
    lead: "Paste Markdown and Vibe explains what each mark turns into: headings, lists, links, code blocks and tables, and why a line sometimes doesn't break where you expect.",
    description:
      "Paste a Markdown file and get it explained in plain English, free online. The sample is a project README with headings, a numbered list, a code block, a quote and a table.",
    sampleSummary: "A README for a small command line tool: a title, bold text and a link, a numbered install list, a shell code block, a bullet list, a tip in a quote and a table of flags.",
    sample: `# Invoicer

Turn a CSV of hours into a **PDF invoice**. See the [changelog](CHANGELOG.md).

## Install

1. Install Python 3.10 or newer.
1. Run \`pip install .\` in this folder.
1. Check it works with \`invoicer --version\`.

## Use

\`\`\`sh
invoicer hours.csv --client "Acme Ltd" --out march.pdf
\`\`\`

- Rates come from \`rates.toml\`.
- Dates are read as *day/month/year*.

> Tip: keep one CSV per client.

| Flag    | Meaning              |
|---------|----------------------|
| \`--out\` | Where to save the PDF |`,
    shows: [
      {
        concept: "headings and emphasis",
        text: "`#` starts the main heading and `##` a section heading; they came out as `<h1>` and `<h2>`. Two stars make bold and one makes italic: `**PDF invoice**` became `<strong>` and `*day/month/year*` became `<em>`. `[changelog](CHANGELOG.md)` is a link with its text in the brackets and its address in the parentheses.",
      },
      {
        concept: "lists",
        text: "Lines starting with a number and a dot make a numbered list, and lines starting with `-` a bullet list. The numbers you type don't have to count up: writing `1.` on every line still gave one `<ol>` with three items. Only the first number matters, and a list that starts at `3.` became `<ol start=\"3\">`.",
      },
      {
        concept: "code",
        text: "Single backticks mark code inside a sentence, such as `rates.toml`. Three backticks on their own lines fence a block, and the word after them names the language: the block came out as `<pre><code class=\"language-sh\">`, with the quotes in the command escaped as `&quot;`.",
      },
      {
        concept: "quotes and tables",
        text: "`>` makes a quote, `<blockquote>`. A table is rows of cells between `|` marks, and the row of dashes splits the header from the body: the renderer made `<th>` cells for Flag and Meaning and `<td>` cells below. The columns don't have to line up for it to work.",
      },
    ],
    notes: [
      "Rendered with markdown-it 15.0.3, which follows CommonMark and also renders tables like the one here.",
      "A `#` needs a space after it: `#Install` stayed a normal paragraph with the `#` showing.",
      "Underscores inside a word are left alone: `get_user_name` came out as written. Stars are not: `2*3*4` turned the 3 into italics, and `2\\*3\\*4` with backslashes showed the stars.",
      "Four spaces at the start of a line, after a blank line, make a code block: the indented line came out in `<pre><code>`.",
    ],
    watchOut:
      "A single line break doesn't start a new line. `Line one` and `Line two` on back-to-back lines came out in one paragraph and show as one line. End the first line with two spaces or a backslash to get a `<br>`, or leave a blank line between them to make two paragraphs.",
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
    id: "cron",
    fileName: "crontab",
    lead: "Paste a crontab line or a whole crontab and Vibe explains when each job runs, what `*/15` and `1-5` mean and where the job's output goes.",
    description:
      "Paste a cron expression or crontab and get a plain English explanation, free online. The sample schedules checks, a nightly backup, weekday reports and a monthly job.",
    sampleSummary: "A crontab for an app server: a check every 15 minutes, a nightly backup with a log, a weekday report, a monthly archive job and one schedule that runs far more often than meant.",
    sample: `# Jobs for the app server. Edit with: crontab -e
# minute  hour  day-of-month  month  day-of-week  command
MAILTO=ops@example.com

# Every 15 minutes: check the site is up.
*/15 * * * *   /opt/app/bin/healthcheck.sh

# 02:30 every night: back up the database, keeping a log.
30 2 * * *     /opt/app/bin/backup-db.sh >> /var/log/backup.log 2>&1

# 08:00 Monday to Friday: email yesterday's sales report.
0 8 * * 1-5    /opt/app/bin/sales-report.sh

# 03:00 on the 1st of every month: rotate the archive.
0 3 1 * *      /opt/app/bin/rotate-archive.sh

# Meant as 09:00 on the first Monday of the month.
0 9 1-7 * 1    /opt/app/bin/monthly-review.sh`,
    shows: [
      {
        concept: "five time fields",
        text: "Each job line starts with five fields: minute, hour, day of the month, month and day of the week, then the command. `*` means every value, so `30 2 * * *` is 02:30 every day. Counted from Thursday 5 November at 08:40, the backup's next runs were Fri 6 Nov 02:30 and Sat 7 Nov 02:30.",
      },
      {
        concept: "steps and ranges",
        text: "`*/15` in the minute field means every 15 minutes counting from 0, so the check's next runs were 08:45, 09:00 and 09:15. `1-5` in the day-of-week field is Monday to Friday, with 0 as Sunday, so after Fri 6 Nov the sales report skipped the weekend and ran next on Mon 9 Nov.",
      },
      {
        concept: "day-of-month and day-of-week",
        text: "When both day fields are set, a day that matches either one runs the job; it doesn't have to match both. The POSIX rule for crontab says \"any day matching either the month and day of month, or the day of week, shall be matched.\" When one of them is `*`, only the other one counts, which is why `0 3 1 * *` runs on the 1st alone: Tue 1 Dec, then Fri 1 Jan 2027.",
      },
      {
        concept: "commands and output",
        text: "Everything after the fifth field is the command, run with `sh`. `>> /var/log/backup.log` adds the job's output to the end of the log, and `2>&1` sends its error messages there as well. Run with sh, `{ echo out; echo err >&2; } >> file 2>&1` wrote both lines to the file.",
      },
    ],
    notes: [
      "The run times on this page were worked out with croniter 6.2.4, a Python library that follows cron's rules, from Thursday 5 November 2026 at 08:40. No cron daemon ran these jobs.",
      "`MAILTO=` is a setting, not a job. In cronie, if `MAILTO` is set, mail goes to that address whenever a job sends output, and `MAILTO=\"\"` turns the mail off. The backup line writes its output to a log instead, so it sends none.",
      "croniter rejected `60 * * * *`, because minutes go from 0 to 59, and `*/15 * * *`, which has only four time fields.",
    ],
    watchOut:
      "`0 9 1-7 * 1` is not the first Monday. Because both day fields are set, it runs every day from the 1st to the 7th and also every Monday: its next runs were Thu 5, Fri 6 and Sat 7 Nov, then Mon 9, 16 and 23 Nov, 31 runs from November to January in place of 3. Keep `*` for the weekday and test it in the command: `0 9 1-7 * * [ \"$(date +\\%u)\" = 1 ] && /opt/app/bin/monthly-review.sh`. Run with sh for 1 to 7 November 2026, that test passed only on Monday the 2nd. The `\\%` is needed because cron turns a bare `%` into a new line.",
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
    id: "zshrc",
    fileName: ".zshrc",
    lead: "Paste a .zshrc and Vibe explains what each line sets up in a new terminal: history options, `path`, completion, aliases, functions and what the `%` codes in `PROMPT` show.",
    description:
      "Paste a .zshrc and get a plain English explanation, free online. The sample sets up shared history, PATH, tab completion, two aliases, a function and a colored prompt.",
    sampleSummary: "A personal .zshrc: history shared between terminals, your own folder first on the path without duplicates, tab completion, two aliases, a make-and-enter folder function and a short colored prompt.",
    sample: `# ~/.zshrc: read by every new interactive zsh, the default shell on a Mac.

# History: keep more, share it between open terminals, skip repeats
HISTFILE=~/.zsh_history
HISTSIZE=5000
SAVEHIST=5000
setopt SHARE_HISTORY HIST_IGNORE_DUPS

# My own tools first; typeset -U drops any folder that's already in the list
typeset -U path
path=(~/bin $path)
export EDITOR=nano

# Tab completion for commands like git
autoload -Uz compinit && compinit

# Shortcuts
alias ll='ls -lah'
alias gs='git status --short'

# Make a folder and go into it: mkcd projects/new-app
mkcd() { mkdir -p "$1" && cd "$1"; }

# Prompt: folder in blue, then % (or # for root)
PROMPT='%F{blue}%~%f %# '`,
    shows: [
      {
        concept: "when it runs",
        text: "zsh reads ~/.zshrc each time it starts an interactive shell, a terminal you type into, and that includes a login shell: `zsh -l -i` had the `ll` alias too. A script run with `zsh -c` doesn't read it: there `whence -v ll` said `ll not found`. bash ignores the file completely.",
      },
      {
        concept: "history and options",
        text: "`HISTSIZE` is how many commands a session keeps in memory and `SAVEHIST` how many the history file keeps. With `SHARE_HISTORY` on, each command is written to `HISTFILE` as you type it, so every open terminal sees the others' commands, and `HIST_IGNORE_DUPS` skips a command typed twice in a row. `setopt` listed both as `sharehistory` and `histignoredups`.",
      },
      {
        concept: "path and typeset -U",
        text: "In zsh, the array `path` and the text `PATH` are the same list, so `path=(~/bin $path)` puts ~/bin first, and `command -v hello` found the `hello` script there. `typeset -U path` keeps each folder once: after adding ~/bin again and re-reading the file, it was still listed 1 time. Without that line, two re-reads left it listed 3 times.",
      },
      {
        concept: "aliases, functions and the prompt",
        text: "`whence -v ll` printed `ll is an alias for ls -lah`, and `mkcd a/b` made both folders and moved into them. In `PROMPT`, `%F{blue}` and `%f` start and stop the color, `%~` is the folder with your home shown as `~` and `%#` is `%` for you or `#` for root: in ~/proj the prompt read `~/proj %` with the folder in blue.",
      },
    ],
    notes: [
      "Run with zsh 5.9.2 on a test home folder, so nothing touched a real ~/.zshrc. `compinit` wrote its cache, a `.zcompdump` file, into that folder on the first run.",
      "zsh doesn't split a variable on spaces the way bash does: with `f=\"my file.txt\"`, `set -- $f` gave 1 argument in zsh and 2 in bash. Code copied from a bash script can behave differently here.",
      "zsh arrays start at 1, not 0: with `a=(x y z)`, `${a[1]}` was `x`.",
    ],
    watchOut:
      "Settings that scripts need don't belong in .zshrc. A script run as `zsh -c` saw none of it: `ll not found`, ~/bin wasn't on its `path` and `command -v hello` found nothing. A variable exported in ~/.zshenv, which zsh reads for every shell, reached the same script: it printed `SHOP_ENV=[dev]`.",
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
    id: "ini",
    fileName: "settings.ini",
    lead: "Paste an .ini file and Vibe explains what each section and setting is for, which defaults every section shares and how a value like `%(log_dir)s` gets filled in.",
    description:
      "Paste an INI file and get it explained in plain English, free online. The sample is an app's settings with shared defaults, a server, a database and an email section.",
    sampleSummary: "An app's settings.ini: a comment, a [DEFAULT] section shared by every section, then server, database and email sections, with one value built from another.",
    sample: `; settings.ini: settings for the invoicer app, one [section] per area.

[DEFAULT]
log_dir = /var/log/invoicer
debug = no

[server]
host = 127.0.0.1
port = 8080
debug = yes

[database]
path = data/invoices.db
backup_file = %(log_dir)s/backup.log
timeout_seconds = 5

[email]
sender = billing@example.com
subject = Your invoice from Acme`,
    shows: [
      {
        concept: "sections and keys",
        text: "`[server]` starts a section, and each `name = value` line below it belongs to that section until the next one. A line starting with `;` is a comment. Python's `configparser` listed the sections as `['server', 'database', 'email']`: `[DEFAULT]` isn't listed, because it's special.",
      },
      {
        concept: "[DEFAULT]",
        text: "Every section can see the keys in `[DEFAULT]`, unless it sets its own. `[email]` has no `debug` line, so it got the default `no`, read as `False`; `[server]` sets `debug = yes` and read as `True`. `[email]` also had `log_dir` without ever naming it.",
      },
      {
        concept: "%(name)s values",
        text: "`%(log_dir)s` is filled in from another key, here the one in `[DEFAULT]`. `backup_file` came out as `/var/log/invoicer/backup.log`.",
      },
      {
        concept: "everything is text",
        text: "Every value is read as text: `port` came back as the string `'8080'`. `getint`, `getfloat` and `getboolean` convert it, and `getboolean` took `yes` and `no`. Key names don't care about case, so `PORT` found `port`, but section names do: there was no `SERVER` section.",
      },
    ],
    notes: [
      "Read with `configparser` in Python 3.14. Other programs that read .ini files may follow different rules, so check the docs of the one reading yours.",
      "A `%` in a value has to be written `%%`. With `password = 50%off`, reading it raised `InterpolationSyntaxError: '%' must be followed by '%' or '(', found: '%off'`. `ConfigParser(interpolation=None)` read it as `50%off`.",
      "A missing file isn't an error: `read(\"nope.ini\")` returned `[]` and there were no sections. Check what `read` returns.",
      "The same key twice in one section stopped the read with `DuplicateOptionError`.",
    ],
    watchOut:
      "A comment at the end of a line becomes part of the value. `port = 8080 ; dev only` read as `'8080 ; dev only'`, and `getint` failed with `ValueError: invalid literal for int() with base 10: '8080 ; dev only'`. Put comments on their own line, or pass `inline_comment_prefixes=(\";\",)`, which read it as `'8080'`.",
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
    id: "csv",
    fileName: "orders.csv",
    lead: "Paste a CSV file and Vibe explains what each column holds and how the quoting works: why some values sit in quotes, what a doubled quote means and why one row can run over two lines.",
    description:
      "Paste a CSV file and get it explained in plain English, free online. The sample is an orders export with a header row, commas inside quoted values, a doubled quote and a note that runs over two lines.",
    sampleSummary: "An orders export: a header row, then six orders with an id, customer, item, quantity, price and note, including quoted values with commas, a doubled quote, a note over two lines and empty notes.",
    sample: `order_id,customer,item,qty,price,note
1001,Ana Ruiz,Blue mug,2,12.50,
1002,"Lee, Sam",Teapot,1,34.00,gift wrap
1003,Priya Shah,"Mug, large",3,14.00,"said ""no rush"""
1004,Tom Berg,Coasters,4,3.25,"leave at
back door"
1005,Mei Lin,Teapot,1,34.00,
1006,Ana Ruiz,Coasters,2,3.25,`,
    shows: [
      {
        concept: "header and rows",
        text: "The first line names the columns, and every other row gives one value per column, separated by commas. Python's `csv.DictReader` used the header as keys and read 6 orders, each with `order_id`, `customer`, `item`, `qty`, `price` and `note`.",
      },
      {
        concept: "quotes",
        text: "A value with a comma in it goes in double quotes, so the comma is part of the value. `\"Lee, Sam\"` came out as `Lee, Sam` and `\"Mug, large\"` as `Mug, large`. Inside quotes, two double quotes stand for one: `\"said \"\"no rush\"\"\"` came out as `said \"no rush\"`.",
      },
      {
        concept: "line breaks in a value",
        text: "A quoted value can hold a line break. Order 1004's note runs over two lines of the file, and the reader kept it as one value, `leave at` and `back door` with a line break between, so the file has 8 lines but 6 orders.",
      },
      {
        concept: "empty values and text",
        text: "A trailing comma means an empty last value: orders 1001, 1005 and 1006 came out with a note of `''`. Every value is text, quantities and prices too, so code has to convert them: `int(qty) * float(price)` over all rows gave 154.5.",
      },
    ],
    notes: [
      "Read with the `csv` module in Python 3.14, opening the file with `newline=\"\"` as the module's docs ask.",
      "Not every CSV uses commas. A file separated by `;` came back as one column, `['id;name']`, until it was read with `delimiter=\";\"`.",
      "A space after a comma counts as part of the value: `a, \"b, c\"` gave `' \"b'` and `' c\"'`, while `skipinitialspace=True` read it as `b, c`.",
      "Writing with `csv.writer` quoted `Lee, Sam` and doubled the quotes in `said \"hi\"` by itself, and ended the row with `\\r\\n`.",
    ],
    watchOut:
      "Splitting lines on commas breaks on quoted values. `line.split(\",\")` on the Lee, Sam row gave 7 pieces for 6 columns, with `\"Lee` and ` Sam\"` apart, and reading line by line would cut order 1004's note in two. Use a CSV reader instead of `split`.",
  },
  {
    id: "env",
    fileName: ".env",
    lead: "Paste a .env file, with real keys and passwords swapped for placeholders, and Vibe explains what each setting is for, which part a `#` cuts off and why every value reaches your code as text.",
    description:
      "Paste a .env file, with placeholders in place of real keys, and get a plain English explanation, free online. The sample holds an app's local settings: a port, a database URL, a test key and quoted text.",
    sampleSummary: "A .env file for running a web shop on your own machine: the port, a database URL, a test API key, quoted values, a comment after a value and one value built from another.",
    sample: `# Settings for running the shop on your own machine.
# Copy .env.example to .env, fill in your values, and keep .env out of git.
NODE_ENV=development
PORT=3000

# Database on this machine
DATABASE_URL=postgres://shop:devpass@localhost:5432/shop
DB_POOL_SIZE=5

# Keys for outside services: test keys only, never the live ones
PAYMENTS_API_KEY=replace-with-your-test-key
MAIL_FROM="Shop Team <team@example.com>"

# Quotes keep spaces and a # inside the value
WELCOME_TEXT="Hello # this is part of the value"
DEBUG=true # this part is a comment

# One value built from another
APP_URL=http://localhost:\${PORT}`,
    shows: [
      {
        concept: "names and values",
        text: "Each line is `NAME=value`, and the app reads it as an environment variable: `process.env[\"PORT\"]` in Node, `os.environ[\"PORT\"]` in Python. Lines starting with `#` are comments, and blank lines are skipped.",
      },
      {
        concept: "quotes and comments",
        text: "A `#` after a value starts a comment, so `DEBUG=true # this part is a comment` came through as `true`. Inside double quotes it doesn't: `WELCOME_TEXT` kept `Hello # this is part of the value`, and the quotes around `MAIL_FROM` kept its spaces and `<team@example.com>` in one value.",
      },
      {
        concept: "text only",
        text: "Every value arrives as a string. In Node, `process.env[\"PORT\"] + 1` printed `30001`, not 3001, and `process.env[\"DEBUG\"] === true` was false while `=== \"true\"` was true. Numbers and true/false have to be converted in your code.",
      },
      {
        concept: "loading the file",
        text: "Nothing reads a .env file on its own: plain `node show.js` saw every value as `undefined`. `node --env-file=.env show.js` loaded it, and in Python `load_dotenv()` from python-dotenv does. A variable already set wins: with `PORT=8080` set, both kept 8080, and only `load_dotenv(override=True)` let the file's 3000 win.",
      },
    ],
    notes: [
      "This box sends what you paste to Unvibe and Anthropic, and only common key formats are refused, so paste your .env.example or swap each real value for a placeholder first.",
      "Run with Node 25.7.0 (`--env-file`) and python-dotenv 1.2.4 on this file: both read the same values, apart from `APP_URL` (see below).",
      "A missing file stops Node before your code runs: `node --env-file=.env.missing` printed `node: .env.missing: not found` and exited with code 9. `--env-file-if-exists` printed `.env.missing not found. Continuing without it.` and ran.",
      "Keep the real .env out of git and commit a `.env.example` with the same names and placeholder values, so others know which settings to fill in.",
    ],
    watchOut:
      "`\${PORT}` isn't filled in everywhere. python-dotenv turned `APP_URL` into `http://localhost:3000`, but Node's `--env-file` passed it through as the text `http://localhost:\${PORT}`, so the same file gave the two apps different URLs. Write the full value out when more than one tool reads the file.",
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
    id: "fish",
    fileName: "config.fish",
    lead: "Paste a fish config or script and Vibe explains what each line does: `set -gx`, `fish_add_path`, abbreviations, functions and where fish differs from bash.",
    description:
      "Paste fish shell code and get a plain English explanation, free online. The sample is a config.fish with PATH, an exported variable, an abbreviation, an alias and a function.",
    sampleSummary: "A personal config.fish: your own folder on the PATH, an exported EDITOR, an abbreviation and an alias for interactive shells, no greeting and a make-and-enter folder function.",
    sample: `# ~/.config/fish/config.fish: read by every new fish shell.

# My own tools first; fish_add_path skips a folder that's already there
fish_add_path ~/bin

# set -gx: a global variable, exported to programs fish starts
set -gx EDITOR nano

if status is-interactive
    # Abbreviations expand as you type: gs becomes git status --short
    abbr --add gs git status --short
    alias ll 'ls -lah'

    # No greeting when a terminal opens
    set -g fish_greeting
end

# Make a folder and go into it: mkcd projects/new-app
function mkcd --description 'Make a folder and go into it'
    mkdir -p $argv[1]; and cd $argv[1]
end`,
    shows: [
      {
        concept: "variables",
        text: "fish sets variables with `set`, not `NAME=value`. `-g` makes one global and `-x` exports it to the programs fish starts, so `set -gx EDITOR nano` gave `EDITOR=nano`. `set -g fish_greeting` with no value empties the greeting, so a new terminal opens without one.",
      },
      {
        concept: "PATH",
        text: "`fish_add_path ~/bin` puts ~/bin first on the PATH and leaves it alone if it's already there: after running it again and re-reading the file, ~/bin was still listed once. `command -v hello` then found the `hello` script in ~/bin.",
      },
      {
        concept: "abbreviations and aliases",
        text: "An abbreviation is expanded on the command line as you type, so the full `git status --short` lands in your history. `alias` in fish writes a small function: `type ll` showed `function ll --wraps='ls -lah'`. fish already ships an `ll` of its own, `ls -lh`, and the alias replaces it.",
      },
      {
        concept: "functions and status",
        text: "`function ... end` defines a command, and `$argv` holds its arguments, starting at 1: `mkcd a/b` made both folders and moved into them. `; and` runs the next command only if the one before it worked. `if status is-interactive` keeps the shortcuts to terminals you type into; the rest of the file runs for every fish, so a `fish -c` script still had `EDITOR` and `mkcd`.",
      },
    ],
    notes: [
      "Run with fish 4.8.1 on a test home folder, so nothing touched a real config.",
      "Some bash habits work in fish 4.8.1: `export FOO=bar`, `$(echo hi)` and `true && echo ok` all ran. A bash `if [ 1 = 1 ]; then echo yes; fi` didn't: fish stopped with `Missing end to balance this if statement`, because fish ends an `if` with `end`.",
      "fish doesn't split variables on spaces: with `set f \"my file.txt\"`, `count $f` printed 1. Lists start at 1, and `$l[-1]` is the last item.",
    ],
    watchOut:
      "Abbreviations exist only while you type. In a fish script, `abbr --add gs git status --short` followed by `gs` didn't run git: it ran the real `gs` command, which on the test machine was GPL Ghostscript 10.07.1. Write the full command, or a function, in scripts.",
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
    id: "gitignore",
    fileName: ".gitignore",
    lead: "Paste a .gitignore and Vibe explains which files each line leaves out, what a leading or trailing `/` changes and why a `!` line sometimes can't bring a file back.",
    description:
      "Paste a .gitignore and get a plain English explanation, free online. The sample keeps secrets, build output and editor files out of git, with a few exceptions kept in.",
    sampleSummary: "A .gitignore for a web project: dependencies, build output, logs, secrets and editor files left out, with the example settings file, one editor file and an empty folder kept in.",
    sample: `# Dependencies and build output
node_modules/
dist/
*.log

# Local settings and secrets: keep the example, never the real one
.env
.env.*
!.env.example

# Editor and OS files, but share the recommended extensions
.DS_Store
.vscode/*
!.vscode/extensions.json

# Only the build folder at the top, not src/build/
/build/

# Keep the empty uploads folder, not what people upload
uploads/*
!uploads/.gitkeep`,
    shows: [
      {
        concept: "patterns",
        text: "Each line is a pattern, and `#` starts a comment. `*` matches any run of characters except `/`, so `*.log` left out both `debug.log` at the top and `logs/today.log` one folder down: a pattern with no slash in it matches in every folder. `.env.*` caught `.env.local`.",
      },
      {
        concept: "slashes and folders",
        text: "A slash at the end, as in `dist/`, matches only folders and everything inside them: a plain file called `dist` was still listed by `git status`. A slash at the start ties the pattern to the folder the .gitignore is in, so `/build/` left out `build/out.js` but kept `src/build/helper.js`.",
      },
      {
        concept: "negation",
        text: "A line starting with `!` brings back a file an earlier line left out, and the last line that matches wins. That kept `.env.example`, `.vscode/extensions.json` and `uploads/.gitkeep` while the rest of `.env.*`, `.vscode/` and `uploads/` stayed out.",
      },
      {
        concept: "tracked files",
        text: "A .gitignore only affects files git isn't tracking yet. With `.env` already committed, adding it here changed nothing: `git status` still showed ` M .env` after an edit. `git rm --cached .env` stopped tracking it and left the file on disk, and from then on git ignored it.",
      },
    ],
    notes: [
      "Run with git 2.55.0 on a test project with 15 files besides the .gitignore, `git status` listed only `.gitignore`, `.env.example`, `.vscode/extensions.json`, `src/app.js`, `src/build/helper.js` and `uploads/.gitkeep`; everything else was left out.",
      "`git check-ignore -v <file>` prints the line that decides a file, with its line number. For a file a `!` line keeps, it prints that `!` line, so check that the pattern it names doesn't start with `!` before reading the file as ignored.",
      "Commit the .gitignore itself, so everyone working on the project gets the same rules. Rules that are only yours go in `.git/info/exclude`, which works the same way and is never shared: `notes-to-self.md` listed there was left out of `git status` in this repo only.",
    ],
    watchOut:
      "`!` can't bring back a file whose folder is left out, because git never looks inside that folder. With `logs/` and then `!logs/keep.txt`, `git status` still didn't list `logs/keep.txt`. Writing `logs/*` leaves out the folder's contents instead of the folder, and then `!logs/keep.txt` worked.",
  },
  {
    id: "ssh-config",
    fileName: "config",
    lead: "Paste an ~/.ssh/config and Vibe explains what each `Host` block sets, which key goes to which server and what ssh actually uses when several blocks match.",
    description:
      "Paste an SSH config file and get a plain English explanation, free online. The sample sets keys for two GitHub accounts, a server behind a jump host and defaults for every host.",
    sampleSummary: "An ~/.ssh/config with two GitHub identities, a staging server reached through a bastion on a custom port, the bastion itself and defaults for every other host.",
    sample: `# ~/.ssh/config: shortcuts and settings for ssh, scp and git over SSH.

Host github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_github
    IdentitiesOnly yes

Host work-github
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes

Host staging
    HostName staging.example.com
    User deploy
    Port 2222
    ProxyJump bastion

Host bastion
    HostName bastion.example.com
    User deploy

Host *
    ServerAliveInterval 60`,
    shows: [
      {
        concept: "Host and HostName",
        text: "`Host` is the name you type, and `HostName` is the real server. So `ssh staging` goes to `staging.example.com` as `deploy` on port 2222: `ssh -G staging`, which prints the settings ssh would use without connecting, showed `hostname staging.example.com`, `user deploy` and `port 2222`.",
      },
      {
        concept: "keys per host",
        text: "`IdentityFile` picks the key, and `IdentitiesOnly yes` tells ssh to offer only that one. `work-github` is a second name for github.com with the work key: `ssh -G work-github` showed `hostname github.com` and only `id_ed25519_work`. `git clone git@work-github:acme/app.git` called ssh with `git@work-github`, so the clone used the work key.",
      },
      {
        concept: "jump hosts",
        text: "`ProxyJump bastion` makes ssh connect to `bastion` first and reach `staging` through it. The bastion's own block applies to that first hop: `ssh -G bastion` showed `hostname bastion.example.com`, `user deploy` and the default port 22.",
      },
      {
        concept: "Host * and first match",
        text: "`Host *` matches every host, so `ServerAliveInterval 60` showed up for all of them, including a host with no block of its own. With it, after 60 seconds without data from the server, ssh sends a message asking for a reply; the default, 0, never does. For each setting, ssh keeps the first value it reads, which is why the catch-all block goes last.",
      },
    ],
    notes: [
      "Checked with OpenSSH 10.6 using `ssh -G -F config <host>` on a test home folder: nothing connected anywhere.",
      "A misspelled option stops ssh before it connects: with `HostNme`, ssh printed `Bad configuration option: hostnme` and `terminating, 1 bad configuration options`.",
      "Hosts without `IdentitiesOnly yes` got ssh's whole list of default key files, six of them from `~/.ssh/id_rsa` to `~/.ssh/id_mldsa44_ed25519`, and ssh can offer keys from your agent too. Each key ssh offers counts as a try, and the OpenSSH server's `MaxAuthTries` default is 6, so with many keys the right one can come too late.",
    ],
    watchOut:
      "Put `Host *` first and its values win over everything below it. With a `Host *` block holding `User nobody` at the top of the file, `ssh -G staging` showed `user nobody`, although the `staging` block says `User deploy`. Keep specific hosts at the top and the catch-all at the end.",
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
  {
    id: "grep",
    fileName: "find-problems.sh",
    lead: "Paste grep commands and Vibe explains what each one finds: what the flags change, what the pattern matches and what the command prints back.",
    description:
      "Paste grep commands and get every flag explained in plain English, free online. The sample searches an app's logs and code with -i, -n, -c, -w, -v, -r, -l, -o and -E.",
    sampleSummary: "A shell script with six grep searches: errors in any case with line numbers, a count of timeouts, a whole word, every line but the health checks, files with a TODO, and just the error status codes.",
    sample: `#!/bin/sh
# Search an app's logs and code for problems.

# Lines with "error" in any case, with their line numbers.
grep -in "error" logs/app.log

# How many lines mention a timeout.
grep -c "timeout" logs/app.log

# The whole word "fail" only, not "failed" or "failure".
grep -w "fail" logs/app.log

# Every line except the health checks.
grep -v "GET /health" logs/access.log

# Search a whole folder and print only the file names.
grep -rl "TODO" src

# Extended pattern: print just the 4xx and 5xx status codes.
grep -oE " [45][0-9]{2} " logs/access.log`,
    shows: [
      {
        concept: "-i and -n",
        text: "grep prints every line that contains the pattern. `-i` ignores case and `-n` adds line numbers: on a test log it printed `2:09:00:05 ERROR could not reach database` and `5:09:02:30 Error: disk almost full`.",
      },
      {
        concept: "-c and -w",
        text: "`-c` prints how many lines matched instead of the lines: `2` for timeout. `-w` only matches the whole word, so `-w \"fail\"` printed only `WARN fail count 3` and skipped the lines with `failed` and `failure`.",
      },
      {
        concept: "-v, -r and -l",
        text: "`-v` turns the search around and prints the lines that don't match: the access log came back without its two health checks. `-r` searches every file in a folder and its subfolders, and `-l` prints only the names of files with a match: `src/cart.js` and `src/lib/retry.py`, but not `src/price.js`.",
      },
      {
        concept: "-o and -E",
        text: "`-E` allows extended patterns such as `{2}` for exactly two, and `-o` prints only the matched part. `[45][0-9]{2}` is a 4 or 5 followed by two digits, so the command printed ` 500 ` and ` 404 ` and left out the 200s.",
      },
    ],
    notes: [
      "Run with GNU grep 3.12 on a test log, access log and source folder.",
      "grep's exit code says what happened: 0 when something matched, 1 when nothing did, and 2 for an error such as `nope.log: No such file or directory`.",
      "In a script with `set -e`, a search that finds nothing ends the script. `grep -c \"panic\"` printed `0`, exited with 1, and the next line never ran.",
    ],
    watchOut:
      "A `.` in the pattern matches any character, not just a dot. `grep \"10.0.0.5\"` also matched a line with `10a0b0c5`. Use `grep -F` to search for the text exactly as written, or write `\\.` for a dot.",
  },
  {
    id: "git-diff",
    fileName: "changes.diff",
    lead: "Paste what `git diff` printed and Vibe explains each change: what the `@@` line counts, which lines a `-` or `+` marks and what a rename or `index` line is telling you.",
    description:
      "Paste git diff output and get a plain English explanation, free online. The sample is a staged change: a cart total gets tax, and a file moves into lib/.",
    sampleSummary: "The output of `git diff --staged` for a small change of the kind an AI assistant makes: a tax rate added to a cart total, items with a quantity of 0 or less skipped, and utils.js moved to lib/money.js.",
    sample: `$ git diff --staged
diff --git a/cart.js b/cart.js
index 9853b5d..97c2803 100644
--- a/cart.js
+++ b/cart.js
@@ -1,11 +1,13 @@
-const { formatPrice } = require("./utils");
+const { formatPrice } = require("./lib/money");
+const TAX = 0.08;
 
 function total(items) {
   let sum = 0;
   for (const item of items) {
+    if (item.qty <= 0) continue;
     sum += item.price * item.qty;
   }
-  return sum;
+  return Math.round(sum * (1 + TAX));
 }
 
 function receipt(items) {
diff --git a/utils.js b/lib/money.js
similarity index 100%
rename from utils.js
rename to lib/money.js`,
    shows: [
      {
        concept: "file headers",
        text: "Each file starts with `diff --git a/... b/...`, where `a/` is the old version and `b/` the new one. The `index 9853b5d..97c2803 100644` line gives short hashes of the file's contents before and after, and its mode: `100644` is an ordinary file that isn't executable (`100755` would be). Then `--- a/cart.js` and `+++ b/cart.js` say which side the `-` and `+` lines come from.",
      },
      {
        concept: "hunks",
        text: "`@@ -1,11 +1,13 @@` reads: this part starts at line 1 and covers 11 lines in the old file, and starts at line 1 and covers 13 lines in the new one. Counting the sample agrees: 11 lines are context or `-`, and 13 are context or `+`. With `-U1`, git kept 1 line of context instead of 3 and split the change into two hunks. The second header, `@@ -5,5 +6,6 @@ function total(items) {`, ends with the nearest line above the change that looks like a heading, here the function it sits in.",
      },
      {
        concept: "added and removed lines",
        text: "A `-` line was removed, a `+` line was added, and a line that starts with a space is unchanged context. An edited line shows up as both: `-  return sum;` and then `+  return Math.round(sum * (1 + TAX));`. Before the change, `receipt()` for 2 items at 1250 cents printed `Total: $25.00`; after it, `Total: $27.00`.",
      },
      {
        concept: "renames",
        text: "`similarity index 100%` with `rename from` and `rename to` means utils.js moved to lib/money.js with nothing inside it changed. `git diff --staged --name-status` printed `R100 utils.js lib/money.js`. With `--no-renames`, the same move showed as `D utils.js` and `A lib/money.js`: one file deleted and another added.",
      },
    ],
    notes: [
      "Made with git 2.55.0 in a test repo with a fixed name and date. In git's output, an unchanged blank line is a single space, and it's kept that way here.",
      "`git diff --staged --stat` summed it up as `cart.js | 6 ++++--`, `utils.js => lib/money.js | 0` and `2 files changed, 4 insertions(+), 2 deletions(-)`.",
      "`--word-diff` marks the change inside a line instead of whole lines: `return [-sum;-]{+Math.round(sum * (1 + TAX));+}`.",
      "One added line can change more than it looks. Before `if (item.qty <= 0) continue;`, an item priced 999 with `qty: -1` took 999 off the total: `total()` returned `1501` for it and 2 items at 1250. After the change, the same cart returned `2700`: the item is skipped and tax is added.",
    ],
    watchOut:
      "Plain `git diff` only shows changes you haven't staged yet. Once everything was added with `git add -A`, `git diff` printed nothing at all, and only `git diff --staged` showed the change. Before staging, plain `git diff` listed utils.js as deleted and left lib/money.js out completely, because git doesn't track a new file until it's added.",
  },
  {
    id: "react-useeffect",
    fileName: "Profile.jsx",
    lead: "Paste a React component and Vibe explains what its `useEffect` does: when it runs, what the dependency array changes and what the cleanup function stops.",
    description:
      "Paste React code with useEffect and get it explained in plain English, free online. The sample loads a user when userId changes and cancels the old request.",
    sampleSummary: "A React component that fetches a user whenever its `userId` prop changes, shows Loading... or an error, and aborts the previous request in the effect's cleanup.",
    sample: `import { useEffect, useState } from "react";

export function Profile({ userId }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setUser(null);
    setError(null);
    fetch(\`/api/users/\${userId}\`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        return res.json();
      })
      .then(setUser)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [userId]);

  if (error) return <p>Couldn't load: {error}</p>;
  return <h2>{user ? user.name : "Loading..."}</h2>;
}`,
    shows: [
      {
        concept: "when it runs",
        text: "React runs the effect after the component is on screen, not while it renders. The first render showed `Loading...` and sent 1 request, to `/api/users/1`; when the reply came, the heading changed to `Ana`.",
      },
      {
        concept: "the dependency array",
        text: "`[userId]` tells React to run the effect again only when `userId` changes: changing it from 1 to 2 sent a second request. With `[]`, the effect ran once, so after the prop became 2 the page still showed `Ana`. With no array at all, it ran after every render. Each reply set the user, which rendered and ran the effect, and the effect's `setUser(null)` rendered and ran it once more: 5 replies led to 11 requests, and after the 5th the page showed `Loading...` again.",
      },
      {
        concept: "cleanup",
        text: "The function the effect returns runs before the effect runs again, and when the component is removed. Here it calls `controller.abort()`: switching from user 1 to 2 aborted the request for 1, and so did removing the component before the reply. An aborted `fetch` rejects with an `AbortError`, which the `catch` ignores on purpose.",
      },
      {
        concept: "StrictMode",
        text: "Inside `<StrictMode>`, React's development build ran the effect, its cleanup and then the effect again on the first render: 2 requests for user 1, the first one aborted, and the page still ended on `Ana`. React does this only in development, to show up effects that don't clean up after themselves.",
      },
    ],
    notes: [
      "Run with React 19.3.1 and react-dom 19.3.1 in jsdom 29.1.1 on Node 25.7.0, with a stand-in `fetch` whose replies were sent by hand, so the order they arrived in could be chosen.",
      "A 404 reply resolves the `fetch` like any other, so the `res.ok` check is what turns it into an error: the page showed `Couldn't load: HTTP 404`.",
      "`setUser(null)` and `setError(null)` at the start of the effect clear the last user's name or error. With user 1 loaded, switching to 2 showed `Loading...` once the effect ran, then `Sam` when 2 replied.",
    ],
    watchOut:
      "Without the cleanup, a slow reply can overwrite a newer one. With the `return () => controller.abort();` line taken out, the page switched from user 1 to 2, showed `Sam` when 2 replied, then went back to `Ana` when the late reply for 1 arrived. With the line in, request 1 was aborted and the page stayed on `Sam`.",
  },
  {
    id: "python-traceback",
    fileName: "traceback.txt",
    lead: "Paste a Python traceback and Vibe explains what went wrong: which line in your code failed, how the program got there and what the error on the last line means.",
    description:
      "Paste a Python traceback and get the error explained in plain English, free online. The sample is a KeyError from a script that totals orders from a JSON file.",
    sampleSummary: "What Python 3.14 printed when a short script that totals orders met an item with `quantity` where the code expected `qty`: one good line of output, then a traceback ending in `KeyError: 'qty'`.",
    sample: `$ python3 report.py
A1 25.0
Traceback (most recent call last):
  File "/home/sam/shop/report.py", line 19, in <module>
    main()
    ~~~~^^
  File "/home/sam/shop/report.py", line 16, in main
    print(order["id"], order_total(order))
                       ~~~~~~~~~~~^^^^^^^
  File "/home/sam/shop/report.py", line 10, in order_total
    return sum(item["price"] * item["qty"] for item in order["items"])
  File "/home/sam/shop/report.py", line 10, in <genexpr>
    return sum(item["price"] * item["qty"] for item in order["items"])
                               ~~~~^^^^^^^
KeyError: 'qty'`,
    shows: [
      {
        concept: "reading order",
        text: "`most recent call last` means the list runs from the first call at the top to the line that failed at the bottom: `main()` on line 19 called `order_total(order)` on line 16, and line 10 failed. The error itself is on the last line, so that's the place to start reading.",
      },
      {
        concept: "frames",
        text: "Each `File \"...\", line N, in name` entry is one call that was still running, with the line it had reached. `in <module>` is the script's top level. `in <genexpr>` is the generator expression inside `sum(...)`, which Python runs as its own small function, so line 10 appears twice.",
      },
      {
        concept: "the error line",
        text: "`KeyError: 'qty'` means the code asked a dictionary for a key it doesn't have, and names the key. The `~` and `^` marks under the code point at the part that failed, `item[\"qty\"]`. In orders.json, the second order's item has `\"quantity\": 3`, not `\"qty\"`.",
      },
      {
        concept: "chained errors",
        text: "When code catches one error and raises another, Python prints both tracebacks. A plain `raise ValueError(...)` inside `except KeyError` put `During handling of the above exception, another exception occurred:` between them. With `raise ... from e`, the line read `The above exception was the direct cause of the following exception:`.",
      },
    ],
    notes: [
      "Run with Python 3.14.7 in a test folder, which is why the paths start with /home/sam/shop. On your computer they show where your own script is.",
      "`A1 25.0` was printed before the traceback: the first order was fine, and output from before a crash stays on screen. The traceback goes to a different place, stderr: with `2>/dev/null` only `A1 25.0` was left. The script ended with exit code 1.",
    ],
    watchOut:
      "A quick fix can hide the problem instead of solving it. `item.get(\"qty\")` only moved the crash, to `TypeError: unsupported operand type(s) for *: 'int' and 'NoneType'`. `item.get(\"qty\", 1)` stopped the error but printed `A2 4`, counting 3 items as 1 without a word. Reading `quantity` when `qty` is missing printed the right `A2 12`.",
  },
  {
    id: "package-lock",
    fileName: "package-lock.json",
    lead: "Paste a package-lock.json and Vibe explains what it pins: the exact version of every package, where npm downloaded it, the hash that proves the file is the same, and why one package can sit inside another.",
    description:
      "Paste a package-lock.json and get it explained in plain English, free online. The sample is 3 packages from a small project's lock file, one of them nested inside another.",
    sampleSummary: "Lines 15 to 35 of the package-lock.json npm 11.10.1 wrote for a project whose package.json asks for `debug` `^2.6.9` and `ms` `^2.1.1`, after `npm install ms@2.1.1`.",
    sample: `$ sed -n '15,35p' package-lock.json
    "node_modules/debug": {
      "version": "2.6.9",
      "resolved": "https://registry.npmjs.org/debug/-/debug-2.6.9.tgz",
      "integrity": "sha512-bC7ElrdJaJnPbAP+1EotYvqZsb3ecl5wi6Bfi6BJTUcNowp6cvspg0jXznRTKDjm/E7AdgFBVeAPVMNcKGsHMA==",
      "license": "MIT",
      "dependencies": {
        "ms": "2.0.0"
      }
    },
    "node_modules/debug/node_modules/ms": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.0.0.tgz",
      "integrity": "sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A==",
      "license": "MIT"
    },
    "node_modules/ms": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.1.tgz",
      "integrity": "sha512-tgp+dl5cGk28utYktBsrFqA7HKgrhgPsg6Z/EfhWI4gl1Hwq8B/GmY/0oXZ6nF8hDVesS/FpnYaD/kOWhYQvyg==",
      "license": "MIT"
    }`,
    shows: [
      {
        concept: "version and resolved",
        text: "Each key is a folder npm creates, and `version` is the exact version that goes in it. package.json asks for a range, `^2.1.1`, meaning 2.1.1 or any newer 2.x. The lock pins one answer, `2.1.1`, so every `npm ci` installs that same version. `resolved` is the address the file was downloaded from.",
      },
      {
        concept: "integrity",
        text: "`integrity` is a fingerprint of the downloaded file: its SHA-512 hash, written in base64. Downloading each of the 3 `resolved` files and hashing it gave exactly these values. With one character of the `ms` hash changed and an empty npm cache, `npm ci` stopped with `EINTEGRITY` and `integrity checksum failed`.",
      },
      {
        concept: "nested packages",
        text: "`debug` 2.6.9 needs `ms` `2.0.0` exactly, but the project asked for `^2.1.1`. Both can't sit in `node_modules/ms`, so npm gave debug its own copy at `node_modules/debug/node_modules/ms`. After `npm ci`, `ms` looked up from the project resolved to 2.1.1, and from debug's folder to 2.0.0.",
      },
      {
        concept: "npm ci and npm install",
        text: "`npm ci` installs exactly what the lock says, or nothing. After `is-odd` was added to package.json but not to the lock, it stopped with `EUSAGE`, `Missing: is-odd@3.0.1 from lock file` and exit code 1. `npm install` with the same change worked out the new versions and added `node_modules/is-odd` and `node_modules/is-number` to the lock.",
      },
    ],
    notes: [
      "Run with npm 11.10.1 on Node 25.7.0, against the public npm registry. `lockfileVersion` 3, at the top of the full file, is the format npm 9 and later write.",
      "The sample leaves out the first 14 lines, which hold the project's own name and version, `lockfileVersion` and the ranges copied from package.json, and the 2 closing lines.",
    ],
    watchOut:
      "Deleting the lock to make an error go away quietly changes your versions. With the lock gone, `npm install` picked `ms` 2.1.3, the newest version in the `^2.1.1` range, not the 2.1.1 the project had been running. Commit package-lock.json, and use `npm ci` on servers and in CI so they install what you tested.",
  },
  {
    id: "prisma-schema",
    fileName: "prisma/schema.prisma",
    lead: "Paste a Prisma schema and Vibe explains the tables it describes: each model and field, what `?`, `@id` and `@default` do, and how two models point at each other.",
    description:
      "Paste a schema.prisma file and get it explained in plain English, free online. The sample is a small blog's schema: users and their posts, with a relation between them.",
    sampleSummary: "A schema.prisma for a small blog, of the kind an AI assistant writes when asked for users and posts: a generator, a SQLite datasource and 2 models joined by a relation.",
    sample: `generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  Int
}`,
    shows: [
      {
        concept: "models and fields",
        text: "Each `model` becomes a table and each field a column, written as name, type, then attributes, except relation fields like `author` and `posts`, which link tables instead of storing a value. `prisma migrate diff` turned `model User` into `CREATE TABLE \"User\"`. `name String?` became `\"name\" TEXT` and a new user with no name stored `NULL`; without the `?` it became `\"name\" TEXT NOT NULL`.",
      },
      {
        concept: "attributes",
        text: "`@id` marks the primary key and `@default(autoincrement())` gives each new row the next number: the first user got id 1. `@unique` on `email` became a unique index: adding a second `ana@example.com` failed with `UNIQUE constraint failed: User.email`. `@default(now())` became `DEFAULT CURRENT_TIMESTAMP`, which filled `createdAt`, and `@default(false)` left a new post unpublished.",
      },
      {
        concept: "relations",
        text: "`author User @relation(...)` says `authorId` holds a `User`'s `id`, and became a foreign key: a post for user 99, who doesn't exist, failed with `FOREIGN KEY constraint failed`. `posts Post[]` is the other side, a list with no column of its own. Without it, `prisma validate` stopped: the relation field `author` `is missing an opposite relation field on the model User`.",
      },
      {
        concept: "the generator and datasource",
        text: "`generator client` tells `prisma generate` to write the code your app uses to query the database: it wrote client.ts and the files next to it into src/generated/prisma, the `output` folder. `datasource db` names the database type, here SQLite. In Prisma 7 the address the command line tool uses lives in prisma.config.ts, and your app passes its own connection to `new PrismaClient()`: with `url = env(\"DATABASE_URL\")` added here, `prisma validate` stopped, saying the datasource property `url` is no longer supported in schema files.",
      },
    ],
    notes: [
      "Run with Prisma 7.10.1 and SQLite 3.53.4: `prisma validate` passed, `prisma migrate diff --from-empty` printed the SQL, and that SQL was run against an empty SQLite file with foreign keys switched on.",
      "`onDelete: Cascade` made the foreign key `ON DELETE CASCADE`: deleting a user with 2 posts left 0 posts. With it taken out, Prisma wrote `ON DELETE RESTRICT` instead, and deleting a user who still had a post failed and left the user in place.",
    ],
    watchOut:
      "Changing this file doesn't change your database. The tables only change when you run a command such as `prisma migrate dev` or `prisma db push`, and your app's query code only changes when `prisma generate` runs. Before applying a migration, read the SQL it will run: making `name` required became `\"name\" TEXT NOT NULL`, which a table that already has users without a name can't hold.",
  },
  {
    id: "tailwind",
    fileName: "PlanCard.jsx",
    lead: "Paste a component full of Tailwind classes and Vibe explains what each one does: spacing, size, color, what changes on bigger screens, on hover and in dark mode, and the CSS each class becomes.",
    description:
      "Paste Tailwind CSS classes and get them explained in plain English, free online. The sample is a React card with up to 12 utility classes on one element, the way AI assistants write them.",
    sampleSummary: "A React component of the kind an AI assistant writes with Tailwind CSS: a pricing card whose layout, colors and button states all come from class names.",
    sample: `export function PlanCard({ plan }) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex md:max-w-2xl md:gap-6 dark:bg-gray-900">
      <img className="size-24 rounded-full object-cover md:size-32" src={plan.image} alt="" />
      <div className="mt-4 md:mt-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{plan.blurb}</p>
        <button className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50 sm:w-auto">
          Choose {plan.name}
        </button>
      </div>
    </div>
  );
}`,
    shows: [
      {
        concept: "utility classes",
        text: "Most classes set 1 or 2 CSS properties; `line-clamp-2` sets 4. Sizes count in steps of `--spacing`, 0.25rem: `p-6` became `padding: calc(var(--spacing) * 6)`, 1.5rem, and `size-24` set both width and height to 6rem. `max-w-sm` is 24rem, `rounded-2xl` 1rem, and `line-clamp-2` cuts the blurb off after 2 lines.",
      },
      {
        concept: "breakpoints",
        text: "A prefix like `md:` applies the class only from a screen width up: `md:flex` became `display: flex` inside `@media (width >= 48rem)`, 768px, and `sm:` used `40rem`. Without a prefix a class applies at every width, so the card is a column on a phone and a row on a wider screen.",
      },
      {
        concept: "states and dark mode",
        text: "`hover:bg-indigo-500` only applies under `@media (hover: hover)`, so on a touch screen that can't hover the button keeps its normal color. `disabled:opacity-50` matches `:disabled`. `dark:` followed the system setting, `prefers-color-scheme: dark`. With `@custom-variant dark (&:where(.dark, .dark *))` in the CSS, it followed a `dark` class instead.",
      },
      {
        concept: "how classes are found",
        text: "Tailwind reads your files as plain text and writes CSS only for the class names it finds. This file has 35 different classes and the build had 35 rules, one for each. A class built from a variable, `bg-${color}-500`, got no rule, because the full name `bg-red-500` never appears in the file. A typo, `md:flx`, got no rule and no warning either.",
      },
    ],
    notes: [
      "Run with Tailwind CSS 4.3.4 and its command line tool, building CSS from this one file, with `source(none)` so no other file in the folder was read.",
      "With `p-2 p-4` and with `p-4 p-2` in the same `className`, the CSS had `.p-2` first and `.p-4` after it, so `p-4` wins either way: the order classes are written in doesn't decide which one applies.",
    ],
    watchOut:
      "Classes put together from pieces silently do nothing. `bg-${color}-500` looks fine in the code and produced no CSS at all, so the element just had no background. Write the full class name for every option, for example a map from `red` to `bg-red-500`, so Tailwind can find each one.",
  },
  {
    id: "sql-joins",
    fileName: "joins.sql",
    lead: "Paste a query with JOINs and Vibe explains what each join keeps and drops: which rows match, which customers come back with nothing, and why a total can come out twice as big as it should.",
    description:
      "Paste SQL joins and get them explained in plain English, free online. The sample is 4 queries over customers, orders and refunds, including one whose totals come out doubled.",
    sampleSummary: "4 queries of the kind an AI assistant writes for a small shop's report, over 3 tables: customers, orders and refunds. Run in SQLite 3.53.4 with 3 customers, 3 orders and 2 refunds.",
    sample: `-- Tables: customers(id, name), orders(id, customer_id, total),
-- refunds(id, customer_id, amount)

-- 1. Customers with their orders
SELECT c.name, o.total
FROM customers c
JOIN orders o ON o.customer_id = c.id;

-- 2. Every customer, with or without orders
SELECT c.name, o.total
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;

-- 3. Customers who never ordered
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;

-- 4. What each customer spent, and what was refunded
SELECT c.name, SUM(o.total) AS spent, SUM(r.amount) AS refunded
FROM customers c
JOIN orders o ON o.customer_id = c.id
LEFT JOIN refunds r ON r.customer_id = c.id
GROUP BY c.id;`,
    shows: [
      {
        concept: "JOIN and LEFT JOIN",
        text: "`JOIN` keeps only the rows that match on both sides: query 1 returned 3 rows, Ana twice and Ben once. `LEFT JOIN` keeps every row of the left table and fills the right side with NULL where nothing matches: query 2 returned 4 rows, the same 3 plus Cy with an empty total.",
      },
      {
        concept: "rows with no match",
        text: "Query 3 is a `LEFT JOIN` that keeps only the rows where the right side came back empty, `WHERE o.id IS NULL`, and it returned `Cy`, the one customer with no orders. The same question written with `NOT EXISTS` and a subquery also returned `Cy`.",
      },
      {
        concept: "the doubled total",
        text: "Query 4 joins orders and refunds to the same customer at once. Ana has 2 orders and 2 refunds, so the join made 4 rows for her, each order paired with each refund, and both sums counted everything twice: `spent` came out as 100.0 and `refunded` as 20.0, against 50 and 10. Ben has no refunds, so his `refunded` came back empty, NULL, not 0.",
      },
      {
        concept: "WHERE after a LEFT JOIN",
        text: "A condition like `o.total > 25` on the right-hand table in `WHERE` throws away the rows where that side came back NULL, so the `LEFT JOIN` acts like a plain `JOIN`. With `WHERE o.total > 25` added to query 2, only Ana's 30.0 came back. Moved into the join itself, `ON o.customer_id = c.id AND o.total > 25`, Ana's 30.0 came back with Ben and Cy, both with an empty total.",
      },
    ],
    notes: [
      "Run with SQLite 3.53.4 on a fresh database built from the 3 tables in the comment. `JOIN` and `LEFT JOIN` work the same way in PostgreSQL and MySQL. SQLite has accepted `FULL JOIN` since version 3.39, and here a `FULL JOIN` of orders and customers returned 4 rows; MySQL has no `FULL JOIN`.",
      "Query 2 has no `ORDER BY`, so the database can return its rows in any order: it listed Ana's 20.0 before her 30.0, the other way round from query 1.",
    ],
    watchOut:
      "A total that is too big, with no error, can come from the join, not the data. Add up each table on its own first, then join the results: with orders and refunds each summed per customer in a subquery, Ana came back as 50.0 spent and 10.0 refunded. Running the joined rows without `SUM` and `GROUP BY` shows the repeats: 4 rows for Ana.",
  },
  {
    id: "supabase-rls",
    fileName: "todos.sql",
    lead: "Paste Supabase row level security SQL and Vibe explains who can read and change which rows: what `using` and `with check` each test, what `auth.uid()` is, and what happens to a request no policy covers.",
    description:
      "Paste Supabase RLS policies and get them explained in plain English, free online. The sample is a todos table where each signed-in user reads, adds and updates only their own rows.",
    sampleSummary: "SQL of the kind an AI app builder writes for a Supabase todos table: the table, row level security switched on, and 3 policies that tie each row to the signed-in user.",
    sample: `-- todos: each signed-in user sees and changes only their own rows
create table todos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users,
  task text not null,
  done boolean not null default false
);

alter table todos enable row level security;

create policy "read own todos" on todos
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "add own todos" on todos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "update own todos" on todos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);`,
    shows: [
      {
        concept: "enabling RLS",
        text: "`enable row level security` makes every query from the `anon` and `authenticated` roles see only the rows a policy allows. Without that line the policies did nothing: Ana and a signed-out visitor both read every todo, hers and Sam's. With it on and no policies at all, Ana read 0 rows, and adding a todo failed with `new row violates row-level security policy`.",
      },
      {
        concept: "using and with check",
        text: "`using` decides which existing rows a query can see or touch, and `with check` decides what a new or changed row may look like. Ana read her 2 todos and Sam read his 1. Ana adding a todo with Sam's `user_id` failed the `with check` test. Her update to Sam's todo changed 0 rows, with no error, because `using` hid it from her.",
      },
      {
        concept: "auth.uid() and roles",
        text: "`auth.uid()` returns the id of the signed-in user making the request, read from their login token. `to authenticated` limits a policy to signed-in requests, so a signed-out visitor, the `anon` role, read 0 rows and couldn't add one. Supabase's docs recommend `(select auth.uid())` over a bare `auth.uid()` so Postgres works it out once per query, not once per row.",
      },
      {
        concept: "missing policies",
        text: "There is no `delete` policy, so nobody signed in can delete: Ana deleting her own todo changed 0 rows. The update policy also leans on the select policy: with the select policy taken out, Ana could still add a todo with a plain insert but read 0 rows, and marking it done changed 0 rows.",
      },
    ],
    notes: [
      "Run on PostgreSQL 18.6 through PGlite 0.5.15, with a small stand-in for Supabase's `auth` schema and its `anon` and `authenticated` roles, and `auth.uid()` copied from Supabase's own source. Each request set the role and the login token's claims in a transaction, the way Supabase's Data API does.",
      "The table's owner skips these policies, and in this run `postgres`, which owns the table and is a superuser, read all 3 todos. Supabase's `service_role` key skips them too, so it belongs on a server, never in the browser.",
      "Taking out the update policy's `with check` line didn't open a hole: Postgres then tests the changed row with `using`, so Ana giving all her todos to Sam failed. With `with check (true)` instead, the same update went through and the todo became Sam's.",
    ],
    watchOut:
      "A view can quietly skip every policy. A view over todos, created by the table owner and granted to signed-in users, showed Sam his own todo and Ana's. After `alter view ... set (security_invoker = true)`, which needs Postgres 15 or later, the view applied the policies and Sam saw only his own.",
  },
  {
    id: "cors-error",
    fileName: "cors-error.txt",
    lead: "Paste a CORS error and the server code behind it and Vibe explains what the browser blocked and why: which origin asked, which header was missing, and the fix, which goes on the server, not in the browser.",
    description:
      "Paste a CORS error and get it explained in plain English, free online. The sample is the console error a front end on port 5173 got from its own API on port 3000, with the API's code.",
    sampleSummary: "What Chromium logged when a page on http://localhost:5173 fetched a small Node API on port 3000, then that API's code: a common setup, with the front end and the API on different ports.",
    sample: `// Browser console on http://localhost:5173
Access to fetch at 'http://localhost:3000/api/todos' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
Failed to load resource: net::ERR_FAILED

// api/server.js: the API the front end calls
const http = require("node:http");

const server = http.createServer((req, res) => {
  if (req.url === "/api/todos" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([{ id: 1, task: "Buy milk" }]));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(3000);`,
    shows: [
      {
        concept: "origins",
        text: "An origin is the scheme, host and port together. `http://localhost:5173` and `http://localhost:3000` differ only in the port, and that is enough to make them different origins, so the browser treats the API as another origin and applies CORS.",
      },
      {
        concept: "the missing header",
        text: "The request did reach the API: the server logged `GET /api/todos` and answered 200. The browser then kept the reply from the page because it had no `Access-Control-Allow-Origin` header, and `fetch` threw `TypeError: Failed to fetch`. A request sent from outside the browser, with the same `Origin` header, got the JSON back.",
      },
      {
        concept: "the fix",
        text: "Adding `\"Access-Control-Allow-Origin\": \"http://localhost:5173\"` to the reply's headers made the same fetch work. `*` worked too, but it lets pages from any origin read the reply. A value naming another origin, `http://localhost:3000`, failed with `has a value 'http://localhost:3000' that is not equal to the supplied origin`.",
      },
      {
        concept: "preflight",
        text: "An `Authorization` header made the browser ask first: it sent `OPTIONS /api/todos`, which this server answered with 404 and no Allow-Origin, and stopped with `Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present`, without sending the GET. Answering `OPTIONS` with 204, Allow-Origin and `Access-Control-Allow-Headers: Authorization` let the GET through, and the todos came back.",
      },
    ],
    notes: [
      "Run with Node 25.7.0 and Chromium 156, driven by Playwright. The 2 console lines in the sample are what Chromium logged; the page's own `catch` printed `TypeError Failed to fetch`.",
      "`mode: 'no-cors'` doesn't fix it. The request went out and the server answered 200, but the page got an empty response with status 0, and `res.json()` failed with `Unexpected end of input`.",
    ],
    watchOut:
      "CORS doesn't protect your API. It decides what pages from other origins, in a browser, can do with a reply: the plain GET reached the server and got its 200 even when the page couldn't read the answer, and a request from outside a browser read the todos although the reply had no `Access-Control-Allow-Origin` header. Keep real checks, such as who is signed in, on the server.",
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
