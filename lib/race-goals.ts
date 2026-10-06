// Original text offsets stay stable across goals, reconnects and in-flight input.
export type RemovedWord = { start: number; end: number };
export const SHOT_MS = 1200;
export const GOAL_CHANCE = .5;

export function withoutRemoved(text: string, removed: RemovedWord[]) {
  return text.split("").filter((_, index) => !removed.some(range => index >= range.start && index < range.end)).join("");
}

export function restoreRemoved(value: string, content: string, removed: RemovedWord[]) {
  let original = "", cursor = 0;
  for (let index = 0; index < content.length; index++) {
    if (removed.some(range => index >= range.start && index < range.end)) original += content[index];
    else if (cursor < value.length) original += value[cursor++];
    else break;
  }
  return original;
}

export function thirdWordAhead(content: string, cursor: number, removed: RemovedWord[]): RemovedWord | undefined {
  const words = [...content.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)]
    .filter(word => !removed.some(range => word.index >= range.start && word.index < range.end));
  let current = -1;
  for (let index = 0; index < words.length; index++) {
    if (words[index].index <= cursor) current = index;
  }
  const word = words[current + 3];
  if (!word || word.index <= cursor) return;
  let start = word.index;
  const end = start + word[0].length;
  // Remove the preceding separator, keeping sentence punctuation and later spaces.
  while (start > cursor && /\s/.test(content[start - 1])) start--;
  return { start, end };
}

export function completedSentences(content: string, typed: string) {
  return [...content.matchAll(/[.!?]+["”’')\]]*(?=\s|$)/gu)]
    .filter(match => match.index + match[0].length <= typed.length &&
      typed.slice(match.index, match.index + match[0].length) === match[0])
    .map(match => match.index + match[0].length);
}
