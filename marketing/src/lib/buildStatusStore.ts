import { promises as fs } from "node:fs";
import path from "node:path";
import { get, list, put } from "@vercel/blob";
import { defaultBuildStatus, normalizeBuildStatus, type BuildStatus } from "@/lib/buildStatus";

const BLOB_PATH = "public/build-status.v1.json";
const localFile = path.join(process.cwd(), ".data", "build-status.json");

function blobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

async function readBlob(token: string): Promise<BuildStatus> {
  const page = await list({ prefix: BLOB_PATH, limit: 1, token });
  const match = page.blobs.find((blob) => blob.pathname === BLOB_PATH);
  if (!match) return defaultBuildStatus();
  const result = await get(match.url, { access: "private", token, useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return defaultBuildStatus();
  const parsed: unknown = JSON.parse(await new Response(result.stream).text());
  return normalizeBuildStatus(parsed && typeof parsed === "object" ? parsed as Partial<BuildStatus> : null);
}

async function writeBlob(status: BuildStatus, token: string): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(status), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 30,
    contentType: "application/json",
    token,
  });
}

async function readLocal(): Promise<BuildStatus> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(localFile, "utf8"));
    return normalizeBuildStatus(parsed && typeof parsed === "object" ? parsed as Partial<BuildStatus> : null);
  } catch {
    return defaultBuildStatus();
  }
}

async function writeLocal(status: BuildStatus): Promise<void> {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  await fs.writeFile(localFile, JSON.stringify(status, null, 2), "utf8");
}

export async function getBuildStatus(): Promise<BuildStatus> {
  const token = blobToken();
  return token ? readBlob(token) : readLocal();
}

export async function saveBuildStatus(status: BuildStatus): Promise<void> {
  const token = blobToken();
  if (token) await writeBlob(status, token);
  else await writeLocal(status);
}
