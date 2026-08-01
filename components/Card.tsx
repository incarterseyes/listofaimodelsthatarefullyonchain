import type { ReactNode } from "react";

export function Card({
  title,
  headingLevel = 2,
  children,
}: {
  title: string;
  headingLevel?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section className="card">
      <Heading className="card-title">{title}</Heading>
      <div className="card-body">{children}</div>
    </section>
  );
}
