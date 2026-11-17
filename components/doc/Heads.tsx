export function SectionHead({ no, group, title, lede }: { no: string; group?: string; title: string; lede?: string }) {
  return (
    <header className="sec-head">
      <p className="sec-kicker">
        <span className="sec-no">{no}</span>
        {group && <span className="sec-group">{group}</span>}
      </p>
      <h2>{title}</h2>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}
