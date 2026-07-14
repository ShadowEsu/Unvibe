/**
 * Language explorer data.
 *
 * Powers the searchable/filterable grid. Each entry lists the concepts Unvibe can
 * explain in that language, common frameworks it recognizes in context, a short
 * learning path, and a tiny sample snippet for preview. Nothing here is a promise of
 * exhaustive coverage — it reflects the kinds of code the explanation engine handles.
 */

export type LanguageCategory =
  | "web"
  | "backend"
  | "systems"
  | "data"
  | "mobile"
  | "scripting";

export const categoryLabels: Record<LanguageCategory, string> = {
  web: "Web",
  backend: "Backend",
  systems: "Systems",
  data: "Data",
  mobile: "Mobile",
  scripting: "Scripting",
};

export interface Language {
  id: string;
  name: string;
  categories: LanguageCategory[];
  /** Short one liner shown on the card. */
  blurb: string;
  concepts: string[];
  frameworks: string[];
  learningPath: string[];
  sample: string;
}

export const languages: Language[] = [
  {
    id: "typescript",
    name: "TypeScript",
    categories: ["web", "backend"],
    blurb: "Typed JavaScript for apps that need to scale.",
    concepts: ["generics", "type narrowing", "async/await", "modules"],
    frameworks: ["React", "Next.js", "Node", "Express"],
    learningPath: ["Types and inference", "Generics", "Narrowing", "Declaration files"],
    sample: `const ids = users.map((u): number => u.id);`,
  },
  {
    id: "javascript",
    name: "JavaScript",
    categories: ["web", "scripting"],
    blurb: "The language of the browser and much of the server.",
    concepts: ["closures", "promises", "event loop", "prototypes"],
    frameworks: ["React", "Vue", "Node", "Express"],
    learningPath: ["Values and scope", "Closures", "Promises", "Modules"],
    sample: `const total = items.reduce((a, b) => a + b, 0);`,
  },
  {
    id: "python",
    name: "Python",
    categories: ["backend", "data", "scripting"],
    blurb: "Readable, batteries-included, everywhere from scripts to ML.",
    concepts: ["comprehensions", "decorators", "async", "generators"],
    frameworks: ["FastAPI", "Django", "Flask", "pandas"],
    learningPath: ["Data structures", "Comprehensions", "Decorators", "Async"],
    sample: `squares = [n * n for n in range(10)]`,
  },
  {
    id: "go",
    name: "Go",
    categories: ["backend", "systems"],
    blurb: "Small, fast, and built for concurrent services.",
    concepts: ["goroutines", "channels", "interfaces", "error values"],
    frameworks: ["net/http", "Gin", "gRPC"],
    learningPath: ["Types and structs", "Interfaces", "Goroutines", "Channels"],
    sample: `go func() { ch <- work() }()`,
  },
  {
    id: "rust",
    name: "Rust",
    categories: ["systems"],
    blurb: "Memory safety without a garbage collector.",
    concepts: ["ownership", "borrowing", "traits", "lifetimes"],
    frameworks: ["Tokio", "Axum", "Serde"],
    learningPath: ["Ownership", "Borrowing", "Traits", "Error handling"],
    sample: `let sum: i32 = nums.iter().sum();`,
  },
  {
    id: "java",
    name: "Java",
    categories: ["backend", "mobile"],
    blurb: "Mature, portable, and pervasive in the enterprise.",
    concepts: ["classes", "generics", "streams", "concurrency"],
    frameworks: ["Spring", "Jakarta EE", "Android"],
    learningPath: ["OOP basics", "Generics", "Collections", "Streams"],
    sample: `list.stream().map(User::id).toList();`,
  },
  {
    id: "csharp",
    name: "C#",
    categories: ["backend", "systems"],
    blurb: "Versatile language behind .NET services and games.",
    concepts: ["LINQ", "async/await", "records", "generics"],
    frameworks: ["ASP.NET", "Entity Framework", "Unity"],
    learningPath: ["Types", "LINQ", "Async", "Records"],
    sample: `var ids = users.Select(u => u.Id);`,
  },
  {
    id: "cpp",
    name: "C++",
    categories: ["systems"],
    blurb: "High-performance systems with fine-grained control.",
    concepts: ["RAII", "templates", "move semantics", "pointers"],
    frameworks: ["STL", "Boost", "Qt"],
    learningPath: ["Memory model", "RAII", "Templates", "Move semantics"],
    sample: `std::vector<int> v{1, 2, 3};`,
  },
  {
    id: "c",
    name: "C",
    categories: ["systems"],
    blurb: "Close to the metal — the foundation beneath much else.",
    concepts: ["pointers", "manual memory", "structs", "the stack"],
    frameworks: ["POSIX", "libc"],
    learningPath: ["Pointers", "Memory", "Structs", "The build"],
    sample: `int *p = malloc(n * sizeof(int));`,
  },
  {
    id: "sql",
    name: "SQL",
    categories: ["data", "backend"],
    blurb: "Query and shape relational data.",
    concepts: ["joins", "aggregation", "indexes", "window functions"],
    frameworks: ["PostgreSQL", "MySQL", "SQLite"],
    learningPath: ["SELECT basics", "Joins", "Aggregation", "Windows"],
    sample: `SELECT name FROM users WHERE active;`,
  },
  {
    id: "swift",
    name: "Swift",
    categories: ["mobile"],
    blurb: "Apple's modern language for apps across its platforms.",
    concepts: ["optionals", "protocols", "closures", "concurrency"],
    frameworks: ["SwiftUI", "UIKit", "Combine"],
    learningPath: ["Optionals", "Protocols", "Closures", "Concurrency"],
    sample: `let names = users.map { $0.name }`,
  },
  {
    id: "kotlin",
    name: "Kotlin",
    categories: ["mobile", "backend"],
    blurb: "Concise JVM language, first-class on Android.",
    concepts: ["null safety", "coroutines", "extensions", "data classes"],
    frameworks: ["Android", "Ktor", "Spring"],
    learningPath: ["Null safety", "Data classes", "Extensions", "Coroutines"],
    sample: `val ids = users.map { it.id }`,
  },
  {
    id: "ruby",
    name: "Ruby",
    categories: ["backend", "scripting"],
    blurb: "Expressive and productive, famous for Rails.",
    concepts: ["blocks", "mixins", "metaprogramming", "symbols"],
    frameworks: ["Rails", "Sinatra"],
    learningPath: ["Objects", "Blocks", "Modules", "Metaprogramming"],
    sample: `users.map(&:id)`,
  },
  {
    id: "php",
    name: "PHP",
    categories: ["web", "backend"],
    blurb: "Powers a large share of the web's backends.",
    concepts: ["arrays", "traits", "namespaces", "closures"],
    frameworks: ["Laravel", "Symfony", "WordPress"],
    learningPath: ["Syntax", "Arrays", "OOP", "Composer"],
    sample: `$ids = array_map(fn($u) => $u->id, $users);`,
  },
  {
    id: "html",
    name: "HTML",
    categories: ["web"],
    blurb: "The structure of every web page.",
    concepts: ["semantics", "forms", "accessibility", "the DOM"],
    frameworks: ["ARIA", "Web Components"],
    learningPath: ["Elements", "Semantics", "Forms", "Accessibility"],
    sample: `<button type="submit">Join</button>`,
  },
  {
    id: "css",
    name: "CSS",
    categories: ["web"],
    blurb: "Layout, spacing, and the feel of the interface.",
    concepts: ["the cascade", "flexbox", "grid", "custom properties"],
    frameworks: ["Tailwind", "Sass"],
    learningPath: ["Selectors", "Box model", "Flexbox", "Grid"],
    sample: `display: grid; gap: 1rem;`,
  },
  {
    id: "bash",
    name: "Bash",
    categories: ["scripting", "systems"],
    blurb: "Glue for the command line and automation.",
    concepts: ["pipes", "redirection", "variables", "exit codes"],
    frameworks: ["coreutils", "POSIX sh"],
    learningPath: ["Commands", "Pipes", "Variables", "Scripts"],
    sample: `grep -r "TODO" src/ | wc -l`,
  },
];

export const allCategories: LanguageCategory[] = [
  "web",
  "backend",
  "systems",
  "data",
  "mobile",
  "scripting",
];
