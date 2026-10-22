import { useMemo } from "react";
import qrcode from "qrcode-generator";

// A QR code drawn as one SVG path (vector, so it prints crisp at any size and there's no image to wait for), with the white
// quiet zone scanners need built in. Error correction "M" survives a smudge or a folded flyer.
export default function FlyerQr({ value, className = "", label = "QR code" }) {
  const { size, d } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 2;
    let path = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
      }
    }
    return { size: n + quiet * 2, d: path };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
