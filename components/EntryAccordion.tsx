import type { ModelEntry } from "@/lib/types";
import { Card } from "./Card";
import { SimpleTable } from "./SimpleTable";
import { CallContractButton } from "./CallContractButton";

export function EntryAccordion({ entry }: { entry: ModelEntry }) {
  const meta: [string, string][] = [
    ...entry.facts,
    ["ADDRESS", entry.address],
    ["YEAR", String(entry.year)],
  ];

  return (
    <details className="accordion" id={entry.slug}>
      <summary className="accordion-summary">
        <span className="accordion-glyph" aria-hidden="true" />
        <h2 className="entry-title">{entry.title}</h2>
      </summary>
      <div className="accordion-body">
        <div className="window">
          <Card title={entry.author.toUpperCase()} headingLevel={3}>
            <SimpleTable
              caption={`${entry.title} facts`}
              header={["FIELD", "VALUE"]}
              rows={meta}
              firstColumnHeader
            />
            <p className="text">{entry.description}</p>
            <p className="text dim evidence-links">
              {entry.links.map((link, index) => (
                <span key={link.url}>
                  {index > 0 && " · "}
                  <a href={link.url}>{link.label}</a>
                </span>
              ))}
            </p>
          </Card>
          <Card title="VERIFICATION" headingLevel={3}>
            <CallContractButton
              target={{
                slug: entry.slug,
                address: entry.address,
                mode: entry.mode,
                call: entry.call,
                preview: entry.preview,
              }}
            />
          </Card>
        </div>
      </div>
    </details>
  );
}
