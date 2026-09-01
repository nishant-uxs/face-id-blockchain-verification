import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function sha256File(path: string): Promise<string> {
  const buf = await readFile(path);
  return sha256Hex(buf);
}

export function sha256HexWithPrefix(data: Buffer | string): `0x${string}` {
  return `0x${sha256Hex(data)}` as `0x${string}`;
}
