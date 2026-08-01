"use client";

import { useEffect, useRef } from "react";
import { decodePreview, type DecodedPreview } from "@/lib/preview";
import type { OutputPreview as OutputPreviewSpec } from "@/lib/types";
import { SimpleTable } from "./SimpleTable";

function ImagePreview({
  decoded,
}: {
  decoded: Extract<DecodedPreview, { kind: "image" }>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const image = context.createImageData(decoded.width, decoded.height);
    for (let i = 0; i < decoded.pixels.length; i += 1) {
      const gray = decoded.pixels[i];
      image.data[i * 4] = gray;
      image.data[i * 4 + 1] = gray;
      image.data[i * 4 + 2] = gray;
      image.data[i * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }, [decoded]);

  return (
    <canvas
      ref={canvasRef}
      className="preview-canvas"
      width={decoded.width}
      height={decoded.height}
      role="img"
      aria-label={`Decoded ${decoded.width} by ${decoded.height} grayscale image returned by the contract`}
    />
  );
}

export function OutputPreview({
  spec,
  bytes,
}: {
  spec: OutputPreviewSpec;
  bytes: string;
}) {
  const decoded = decodePreview(spec, bytes);
  if (!decoded) {
    return (
      <p className="text dim">
        The returned bytes did not match the entry&apos;s declared preview
        shape.
      </p>
    );
  }

  return (
    <>
      <p className="text dim">DECODED OUTPUT · {decoded.heading}</p>
      {decoded.kind === "image" ? (
        <ImagePreview decoded={decoded} />
      ) : (
        <SimpleTable
          caption={`Decoded output: ${decoded.heading}`}
          header={decoded.header}
          rows={decoded.rows}
          firstColumnHeader
        />
      )}
      {spec.note && <p className="text dim">{spec.note}</p>}
    </>
  );
}
