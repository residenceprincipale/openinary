import { existsSync, readFileSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), "data", "transforms.json");

export function getDefaults() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return {};
}
