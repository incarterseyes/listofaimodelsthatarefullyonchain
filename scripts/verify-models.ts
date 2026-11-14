import { describeResult, performCall } from "@/lib/ethCall";
import { loadModels } from "@/lib/models";

const INTER_ENTRY_DELAY_MS = 1_250;

async function main() {
  const entries = loadModels();
  const results: Array<{
    entry: (typeof entries)[number];
    result: Awaited<ReturnType<typeof performCall>>;
  }> = [];
  // Run the live checks one at a time. Many requests at once can reach the
  // rate limits of the public endpoints. CI then fails for a reason that is
  // not in an entry.
  for (const [index, entry] of entries.entries()) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, INTER_ENTRY_DELAY_MS));
    }
    results.push({ entry, result: await performCall(entry) });
  }

  let failures = 0;
  for (const { entry, result } of results) {
    const described = describeResult(result);
    if (described.ok) {
      console.log(`✓ ${entry.slug}: ${described.message}`);
      for (const detail of described.details ?? []) {
        console.log(`  ${detail}`);
      }
      continue;
    }

    failures += 1;
    console.error(`✗ ${entry.slug}: ${described.message}`);
    for (const detail of described.details ?? []) {
      console.error(`  ${detail}`);
    }
  }

  if (failures > 0) {
    console.error(`\nThe live check failed for ${failures} of ${results.length} entries.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} entries passed the live check.`);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
