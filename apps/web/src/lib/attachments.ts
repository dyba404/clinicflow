import { join, resolve } from "node:path";

export function attachmentsRoot(): string {
  const base = process.env.ATTACHMENTS_DIR ?? join(process.cwd(), ".data", "attachments");
  return resolve(base);
}
