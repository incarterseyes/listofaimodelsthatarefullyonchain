import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import schema from "@/schema/model.schema.json";
import type { ModelEntry } from "./types";

const ajv = new Ajv2020({ allErrors: true });
const matchesSchema = ajv.compile(schema);

// Closed facts vocabulary: keeps entries comparable and tells contributors
// exactly what to fill in. Extend it via PR when a model genuinely needs a
// label no existing one covers. ADDRESS/MODE/YEAR are never facts — the site
// renders those rows from the top-level fields.
export const REQUIRED_FACT_LABELS = ["ARCHITECTURE", "WEIGHTS", "OUTPUT"] as const;
export const OPTIONAL_FACT_LABELS = [
  "TASK",
  "TRAINING",
  "INFERENCE",
  "RENDERER",
  "PIPELINE",
  "DIMENSIONS",
  "PARAMETERS",
  "NEURONS",
  "FEATURES",
  "VOCABULARY",
  "ACTIVATION",
  "INPUTS",
  "MATH",
  "INITIAL STATE",
  "CONTRACTS",
  "DEPENDENCIES",
] as const;
const FACT_LABELS = new Set<string>([
  ...REQUIRED_FACT_LABELS,
  ...OPTIONAL_FACT_LABELS,
]);

function semanticProblems(entry: ModelEntry, currentYear: number): string[] {
  const problems: string[] = [];

  if (entry.year > currentYear) {
    problems.push(`year ${entry.year} is in the future`);
  }

  const factLabels = new Set<string>();
  for (const [label] of entry.facts) {
    const normalized = label.trim().toUpperCase();
    if (!FACT_LABELS.has(normalized)) {
      problems.push(
        `unknown fact label "${label}"; valid labels are: ${[...FACT_LABELS].join(", ")}`,
      );
    }
    if (factLabels.has(normalized)) {
      problems.push(`fact label "${label}" is duplicated`);
    }
    factLabels.add(normalized);
  }
  for (const required of REQUIRED_FACT_LABELS) {
    if (!factLabels.has(required)) {
      problems.push(`missing required fact label "${required}"`);
    }
  }

  const preview = entry.preview;
  if (preview) {
    const expected = entry.call.expectedReturnBytes;
    if (preview.kind === "grayscale-image") {
      const size = preview.width * preview.height;
      if (expected !== size && expected !== size + 64) {
        problems.push(
          `preview declares a ${preview.width}×${preview.height} image (${size} bytes, or ${size + 64} with ABI framing) but expectedReturnBytes is ${expected}`,
        );
      }
    } else if (preview.kind === "fields") {
      if (expected !== preview.fields.length * 32) {
        problems.push(
          `preview declares ${preview.fields.length} fields (${preview.fields.length * 32} bytes) but expectedReturnBytes is ${expected}`,
        );
      }
    } else if (preview.kind === "logits") {
      if (expected < 96 || (expected - 64) % 32 !== 0) {
        problems.push(
          `logits preview requires an ABI dynamic array (64 header bytes + one 32-byte word per logit) but expectedReturnBytes is ${expected}`,
        );
      }
    } else if (expected % 32 !== 0) {
      problems.push(
        `words preview requires a multiple of 32 return bytes but expectedReturnBytes is ${expected}`,
      );
    }
  }

  const urls = new Set<string>();
  for (const link of entry.links) {
    try {
      const url = new URL(link.url);
      if (url.protocol !== "https:" || !url.hostname) {
        problems.push(`link "${link.label}" must use an absolute HTTPS URL`);
        continue;
      }
      if (urls.has(url.href)) {
        problems.push(`link URL "${link.url}" is duplicated`);
      }
      urls.add(url.href);
    } catch {
      problems.push(`link "${link.label}" is not a valid URL`);
    }
  }

  return problems;
}

export function parseModelEntry(
  raw: unknown,
  file: string,
  currentYear = new Date().getUTCFullYear(),
): ModelEntry {
  if (!matchesSchema(raw)) {
    throw new Error(
      `models/${file} failed schema validation:\n` +
        ajv.errorsText(matchesSchema.errors, { separator: "\n" }),
    );
  }

  const entry = raw as unknown as ModelEntry;
  if (`${entry.slug}.json` !== file) {
    throw new Error(
      `models/${file}: slug "${entry.slug}" must match the file name`,
    );
  }

  const problems = semanticProblems(entry, currentYear);
  if (problems.length > 0) {
    throw new Error(`models/${file} failed registry validation:\n${problems.join("\n")}`);
  }

  return entry;
}

// Build-time only: load and validate the registry before it reaches the page.
export function loadModels(root = process.cwd()): ModelEntry[] {
  const dir = path.join(root, "models");
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const entries = files.map((file) => {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`models/${file} is not valid JSON: ${message}`);
    }
    return parseModelEntry(raw, file);
  });

  const slugs = new Set<string>();
  for (const entry of entries) {
    if (slugs.has(entry.slug)) {
      throw new Error(`duplicate slug: ${entry.slug}`);
    }
    slugs.add(entry.slug);
  }

  return entries.sort(
    (a, b) => a.year - b.year || a.slug.localeCompare(b.slug),
  );
}
