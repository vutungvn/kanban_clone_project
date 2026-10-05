/** Ghép className, bỏ qua giá trị falsy. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
