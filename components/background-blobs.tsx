/**
 * Soft organic gradient shapes scattered behind the content.
 * Pure CSS; no images. Sits as `pointer-events-none` under everything.
 */
export function BackgroundBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Top-left coral / peach */}
      <div
        className="absolute -left-32 -top-32 size-[420px] rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,107,92,0.45), rgba(255,107,92,0) 60%)",
          filter: "blur(60px)",
        }}
      />
      {/* Top-right peach */}
      <div
        className="absolute -right-40 -top-24 size-[380px] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,216,107,0.45), rgba(255,216,107,0) 60%)",
          filter: "blur(60px)",
        }}
      />
      {/* Bottom-left green */}
      <div
        className="absolute -left-32 bottom-0 size-[420px] rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(123,207,169,0.45), rgba(123,207,169,0) 60%)",
          filter: "blur(70px)",
        }}
      />
      {/* Bottom-right yellow */}
      <div
        className="absolute -right-32 bottom-0 size-[460px] rounded-full opacity-55"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,216,107,0.50), rgba(255,216,107,0) 60%)",
          filter: "blur(70px)",
        }}
      />
    </div>
  );
}
