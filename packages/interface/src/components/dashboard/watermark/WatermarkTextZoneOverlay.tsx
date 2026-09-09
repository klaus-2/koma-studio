import type {
  WatermarkLoadedImage,
  WatermarkTextAvoidanceZone,
} from './watermarkTypes';

type WatermarkTextZoneOverlayProps = {
  image: WatermarkLoadedImage;
  zones: WatermarkTextAvoidanceZone[];
};

export default function WatermarkTextZoneOverlay({
  image,
  zones,
}: WatermarkTextZoneOverlayProps) {
  return (
    <svg
      className="koma-wm-stage__text-zone-overlay"
      viewBox={`0 0 ${image.width} ${image.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {zones.map((zone) => (
        <rect
          key={zone.id}
          x={zone.bbox[0]}
          y={zone.bbox[1]}
          width={zone.bbox[2] - zone.bbox[0]}
          height={zone.bbox[3] - zone.bbox[1]}
          className="koma-wm-text-zone-rect"
        />
      ))}
    </svg>
  );
}
