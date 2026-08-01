import { loadModels } from "@/lib/models";
import { Card } from "@/components/Card";
import { SimpleTable } from "@/components/SimpleTable";
import { EntryAccordion } from "@/components/EntryAccordion";
import { EntryHashController } from "@/components/EntryHashController";
import packageJson from "@/package.json";

const REPO =
  "https://github.com/incarterseyes/listofaimodelsthatarefullyonchain";

function Divider({ heavy = false }: { heavy?: boolean }) {
  return (
    <span className="divider" aria-hidden="true">
      {(heavy ? "═" : "─").repeat(400)}
    </span>
  );
}

export default function Page() {
  const models = loadModels();

  const census = models.map((model) => [
    <a href={`#${model.slug}`} key={model.slug}>
      {model.title}
    </a>,
    model.author,
    model.mode.replaceAll("_", " "),
    String(model.year),
  ]);

  return (
    <div className="shell">
      <header className="nav">
        <span className="nav-logo" aria-hidden="true">
          ✶
        </span>
        <h1 className="nav-title">listofaimodelsthatarefullyonchain.com</h1>
        <span className="badge">REGISTER {packageJson.version}</span>
      </header>

      <main id="content">
        <p className="text">
          Neural-network programs whose weights and executable model artifacts
          are stored on Ethereum mainnet. Every entry includes a contract
          address and a reproducible read-only call you can run from this page.
        </p>
        <p className="text dim">
          EVM INFERENCE means the forward pass executes in EVM opcodes. ONCHAIN
          RENDERER means the weights and renderer program are stored onchain but
          execute in the client. Proofs of off-chain inference and off-chain
          storage pointers do not qualify.
        </p>

        <Divider heavy />

        <div className="window">
          <Card title="CENSUS">
            <SimpleTable
              caption="Registered onchain models"
              header={["MODEL", "AUTHOR", "MODE", "YEAR"]}
              rows={census}
              firstColumnHeader
            />
            <p className="text legend">
              <span className="status-key-active">EVM INFERENCE</span>{" "}
              forward
              pass in EVM opcodes &nbsp;·&nbsp;{" "}
              <span className="status-key">ONCHAIN RENDERER</span> artifacts
              stored onchain, execution in the client
            </p>
            <p className="text">
              {models.length} registered {models.length === 1 ? "entry" : "entries"}.
              Each passed deterministic registry checks; select an entry to run
              a fresh live check.
            </p>
          </Card>
        </div>

        <Divider />

        <section aria-label="Model entries">
          <EntryHashController />
          {models.map((model) => (
            <EntryAccordion key={model.slug} entry={model} />
          ))}
        </section>

        <Divider heavy />

        <Card title="METHOD">
          <p className="text dim">
            Deterministic validation checks the schema, file identity,
            evidence links, and declared return size. CI then requires
            at least two public RPCs to agree, at one block, on the deployed
            bytecode and the exact eth_call result. Those checks make each call
            reproducible; they do not, by
            themselves, prove that arbitrary bytes implement the described
            neural architecture. Source evidence still receives human review.
            Corrections and additions are made through an{" "}
            <a href={REPO}>open pull request</a>.
          </p>
        </Card>
      </main>
    </div>
  );
}
