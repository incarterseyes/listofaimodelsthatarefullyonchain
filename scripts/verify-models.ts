import { describeResult, performCall } from "@/lib/ethCall";
import { loadModels } from "@/lib/models";

const INTER_ENTRY_DELAY_MS = 1_250;

async function main() {
  const entries = loadModels();
  const results: Array<{
    entry: (typeof entries)[number];
    result: Awaited<ReturnType<typeof performCall>>;
  }> = [];
  // Serialize live checks so many entries do not burst the same public
  // endpoints and turn rate limits into unrelated CI failures.
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
      continue;
    }

    failures += 1;
    console.error(`✗ ${entry.slug}: ${described.message}`);
    for (const detail of described.details ?? []) {
      console.error(`  ${detail}`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} live verification check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\n${results.length} entries passed strict live verification.`);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
