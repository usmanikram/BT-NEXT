export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full align-middle"
      style={{ width: size, height: size, background: color, boxShadow: "0 0 0 2px rgba(31,26,20,0.04)" }}
      aria-hidden
    />
  );
}
