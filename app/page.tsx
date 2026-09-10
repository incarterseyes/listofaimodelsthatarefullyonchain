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
          This site lists neural networks whose weights and programs are stored
          fully on Ethereum mainnet. Each entry has a contract address and a
          live check that you can run from this page.
        </p>
        <p className="text dim">
          Models that store their files somewhere else, or run somewhere else
          and only post a proof, do not qualify. Each entry says where the
          model runs — inside Ethereum, or in your browser.
        </p>

        <Divider heavy />

        <div className="window">
          <Card title="CENSUS">
            <SimpleTable
              caption="Registered onchain models"
              header={["MODEL", "AUTHOR", "YEAR"]}
              rows={census}
              firstColumnHeader
            />
            <p className="text">
              {models.length} {models.length === 1 ? "entry" : "entries"}. Each
              entry passed the automatic registry checks. Select an entry to
              run a new live check.
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
            Software checks the schema, file name, evidence links, and declared
            return size of each entry. Two or more public Ethereum servers must
            then agree on the contract code and the exact call result at one
            block. These checks prove that the call is reproducible. They do
            not prove that the code is the described neural network. A person
            also reviews the source evidence. To correct or add an entry, open
            a <a href={REPO}>pull request</a>.
          </p>
        </Card>
      </main>
    </div>
  );
}
