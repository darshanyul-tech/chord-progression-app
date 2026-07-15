export interface NotePaletteEntry {
  duration: number;
  label: string;
  title: string;
}

export const EXAM_PALETTE_ENTRIES: NotePaletteEntry[] = [
  { duration: 4, label: '1', title: 'Whole note (1)' },
  { duration: 2, label: '2', title: 'Half note (2)' },
  { duration: 1, label: '3', title: 'Quarter note (3)' },
  { duration: 0.5, label: '4', title: 'Eighth note (4)' },
  { duration: 0.25, label: '5', title: 'Sixteenth note (5)' },
  { duration: 1.5, label: '7', title: 'Dotted quarter (7)' },
  { duration: 0.75, label: '8', title: 'Dotted eighth (8)' },
];
