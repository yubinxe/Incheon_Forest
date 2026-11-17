export function SectionHead({ no, title, lede }: { no: string; title: string; lede?: string }) {
  return (
    <header className="sec-head">
      <span className="sec-no">{no}</span>
      <h2>{title}</h2>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}
