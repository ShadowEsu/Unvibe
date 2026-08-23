import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import Image from "../src/app/opengraph-image";

async function main() {
  const out = join(process.cwd(), "public/unvibe-social-preview-v6.png");
  const response = await Image();
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(out, buffer);
  console.log(`wrote ${out} (${buffer.length} bytes)`);
}

void main();
