/** "1 line", "2 lines", "0 lines": the count of selected or saved lines as shown in the panel and companion. */
export function linesLabel(count: number): string {
  return `${count} ${count === 1 ? 'line' : 'lines'}`;
}
