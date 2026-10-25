export type DiffSegmentType = 'same' | 'added' | 'removed';

export interface DiffSegment {
  type: DiffSegmentType;
  text: string;
}

function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/gu) ?? [];
}

export function diffText(original: string, revised: string): DiffSegment[] {
  const left = tokenize(original);
  const right = tokenize(revised);
  if (left.length * right.length > 4_000_000) {
    return [
      { type: 'removed', text: original },
      { type: 'added', text: revised },
    ];
  }
  const width = right.length + 1;
  const table = new Uint32Array((left.length + 1) * width);

  for (let row = left.length - 1; row >= 0; row -= 1) {
    for (let column = right.length - 1; column >= 0; column -= 1) {
      const index = row * width + column;
      table[index] = left[row] === right[column]
        ? table[(row + 1) * width + column + 1] + 1
        : Math.max(table[(row + 1) * width + column], table[row * width + column + 1]);
    }
  }

  const raw: DiffSegment[] = [];
  let row = 0;
  let column = 0;

  while (row < left.length && column < right.length) {
    if (left[row] === right[column]) {
      raw.push({ type: 'same', text: left[row] });
      row += 1;
      column += 1;
    } else if (table[(row + 1) * width + column] >= table[row * width + column + 1]) {
      raw.push({ type: 'removed', text: left[row] });
      row += 1;
    } else {
      raw.push({ type: 'added', text: right[column] });
      column += 1;
    }
  }
  while (row < left.length) raw.push({ type: 'removed', text: left[row++] });
  while (column < right.length) raw.push({ type: 'added', text: right[column++] });

  return raw.reduce<DiffSegment[]>((segments, segment) => {
    const previous = segments.at(-1);
    if (previous?.type === segment.type) previous.text += segment.text;
    else segments.push({ ...segment });
    return segments;
  }, []);
}
