export type StatusKind = '' | 'warn' | 'error';

export function StatusLine({ text, kind }: { text: string; kind: StatusKind }) {
  return <p className={`status${kind ? ` ${kind}` : ''}`}>{text}</p>;
}
