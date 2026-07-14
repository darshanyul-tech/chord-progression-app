export function SessionScoreLine({
  className,
  correct,
  total,
}: {
  className: string;
  correct: number;
  total: number;
}) {
  return <p className={className}>{`Session: ${correct} / ${total} (first-guess correct)`}</p>;
}
