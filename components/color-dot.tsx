export function ColorDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full align-middle ring-1 ring-black/5"
      style={{ width: size, height: size, background: color }}
      aria-hidden
    />
  );
}
