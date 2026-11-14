import { loadModels } from "@/lib/models";
import { Card } from "@/components/Card";
import { SimpleTable } from "@/components/SimpleTable";
import { EntryAccordion } from "@/components/EntryAccordion";
import { EntryHashController } from "@/components/EntryHashController";
import packageJson from "@/package.json";

const REPO =
  "https://github.com/incarterseyes/listofaimodelsthatarefullyonchain";

const TERMS: [string, string][] = [
  [
    "CALL",
    "A request that asks a contract to run one of its functions. The calls on this page only read a result. They change nothing on Ethereum.",
  ],
  [
    "BLOCK",
    "Ethereum adds data in numbered groups called blocks. A live check reads every answer at the same block.",
  ],
  [
    "BYTE",
    "One unit of computer data. This page shows returned bytes as hexadecimal text, two characters for each byte.",
  ],
  ["CONTRACT STORAGE", "The data area that belongs to one contract."],
  [
    "DATA CONTRACT",
    "A contract that only holds data, such as weights. Other contracts and programs read from it.",
  ],
  [
    "BYTECODE",
    "The program code of a contract, in the form that Ethereum runs.",
  ],
  [
    "DERIVED AT READ TIME",
    "The model calculates its weights each time it runs. Ethereum does not store them.",
  ],
  [
    "NFT",
    "A unique token on Ethereum. Each token has a token ID. To mint a token is to create it. To burn a token is to destroy it.",
  ],
  [
    "SEED",
    "A number that a model starts from. The same seed always gives the same output.",
  ],
];

function Divider() {
  return (
    <span className="divider" aria-hidden="true">
      {"═".repeat(400)}
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
        <span className="badge">VERSION {packageJson.version}</span>
      </header>

      <main id="content">
        <p className="text">
          This site lists neural networks that are stored fully on Ethereum
          mainnet. A neural network is a program that learns from examples,
          and this page also calls it a model. The numbers that it learns are
          its weights. Ethereum is a public network of computers that all keep
          the same copy of shared programs and data. Mainnet is the main
          Ethereum network, not a test network.
        </p>
        <p className="text">
          For each model, Ethereum stores both the weights and the program that
          uses them. Data and programs that Ethereum stores are
          &ldquo;onchain&rdquo;, and everything else is
          &ldquo;offchain&rdquo;. A program stored on Ethereum is a contract,
          and each contract has an address. Each entry gives a contract address
          and a live check that you can run from this page.
        </p>

        <Divider />

        <div className="window">
          <Card title="MODELS">
            <SimpleTable
              caption="Models on this list"
              header={["MODEL", "AUTHOR", "YEAR"]}
              rows={census}
              firstColumnHeader
            />
          </Card>
        </div>

        <p className="text dim">
          A model does not qualify if its weights or its program are stored
          offchain. A model also does not qualify if it runs on another
          computer and sends Ethereum only a proof of the result. Each entry
          says where the model runs: inside Ethereum, or in your browser.
        </p>

        <Divider />

        <section aria-label="Model entries">
          <EntryHashController />
          {models.map((model) => (
            <EntryAccordion key={model.slug} entry={model} />
          ))}
        </section>

        <Divider />

        <Card title="METHOD">
          <p className="text dim">
            Before this site is published, software checks each entry file.
            Each file must have the required fields, the correct file name,
            valid links, and a declared result size. A live check then sends
            the entry&apos;s call to several public Ethereum servers. At least
            two servers must return the same contract code and the same call
            result at the same block. These checks prove that anyone can repeat
            the call and get the same result. They do not prove that the
            contract code is the neural network that the entry describes. A
            person also reviews the source code and the project evidence. To
            correct or add an entry, open a{" "}
            <a href={REPO}>pull request</a> on GitHub.
          </p>
        </Card>

        <Card title="TERMS">
          <SimpleTable
            caption="Terms used on this page"
            header={["TERM", "MEANING"]}
            rows={TERMS}
            firstColumnHeader
            wrap
          />
        </Card>
      </main>
    </div>
  );
}
