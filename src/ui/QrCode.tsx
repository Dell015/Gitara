import { useMemo } from "react";
import qrcode from "../vendor/qrcode-generator";

/** A QR code drawn as one SVG path, so it stays sharp at any size. Dark on light for scanners. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { d, n } = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) {
      let run = -1;
      for (let c = 0; c <= n; c++) {
        const dark = c < n && q.isDark(r, c);
        if (dark && run < 0) run = c;
        if (!dark && run >= 0) {
          d += `M${run + 4} ${r + 4}h${c - run}v1h${-(c - run)}z`;
          run = -1;
        }
      }
    }
    return { d, n };
  }, [text]);
  return (
    <svg className="qr" viewBox={`0 0 ${n + 8} ${n + 8}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n + 8} height={n + 8} rx="2" fill="#fff" />
      <path d={d} fill="#0b0b0f" />
    </svg>
  );
}
