import React from 'react';
import { COLUMNS, ROOMS, RoomCategory, WALL_SEGMENTS } from '../data/housePlanData';
import { CameraTelemetry, NavMode } from '../three/HouseViewport';

interface Minimap2DProps {
  selectedRoomId: string | null;
  hoveredRoomId: string | null;
  navMode: NavMode;
  telemetry: CameraTelemetry | null;
  onSelectRoom: (roomId: string) => void;
  onHoverRoom: (roomId: string | null) => void;
}

const CATEGORY_FILL: Record<RoomCategory, string> = {
  living: '#2d333d',
  bedroom: '#332f2b',
  bathroom: '#26343a',
  service: '#2b3036',
  circulation: '#25282e',
  outdoor: '#2c322c',
};

export const Minimap2D: React.FC<Minimap2DProps> = ({
  selectedRoomId,
  hoveredRoomId,
  navMode,
  telemetry,
  onSelectRoom,
  onHoverRoom,
}) => {
  // ViewBox fits the 15.0m x 22.2m plan with subtle dimension margins
  const viewBox = '-1.2 -1.2 17.6 24.8';

  const renderCameraCone = () => {
    if (navMode !== 'walk' || !telemetry) return null;
    const { planX, planZ, yaw } = telemetry;
    // Camera forward in Three.js is (-sin(yaw), -cos(yaw))
    const angleRad = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    const angleDeg = (angleRad * 180) / Math.PI;
    return (
      <g transform={`translate(${planX.toFixed(2)}, ${planZ.toFixed(2)}) rotate(${angleDeg.toFixed(1)})`}>
        <path
          d="M 0 0 L 2.2 -1.0 A 2.4 2.4 0 0 1 2.2 1.0 Z"
          fill="rgba(245, 158, 11, 0.35)"
        />
        <circle cx={0} cy={0} r={0.34} fill="#f59e0b" stroke="#181a1e" strokeWidth={0.14} />
      </g>
    );
  };

  return (
    <div className="w-[230px] select-none">
      <svg
        viewBox={viewBox}
        className="h-[310px] w-full overflow-visible"
        role="img"
        aria-label="Plan 2D interactif de la villa"
      >
        {/* Overall Blueprint Dimension Guides: 15.00 m & 22.00 m */}
        <g stroke="rgba(255,255,255,0.22)" strokeWidth={0.07}>
          <line x1={0} y1={-0.65} x2={15} y2={-0.65} />
          <line x1={0} y1={-0.9} x2={0} y2={-0.4} />
          <line x1={15} y1={-0.9} x2={15} y2={-0.4} />

          <line x1={15.7} y1={0} x2={15.7} y2={22} />
          <line x1={15.45} y1={0} x2={15.95} y2={0} />
          <line x1={15.45} y1={22} x2={15.95} y2={22} />
        </g>
        <text
          x={7.5}
          y={-0.82}
          textAnchor="middle"
          fill="rgba(255,255,255,0.55)"
          fontSize={0.58}
          fontFamily="JetBrains Mono, monospace"
        >
          15,00 m
        </text>
        <text
          x={16.15}
          y={11}
          textAnchor="middle"
          fill="rgba(255,255,255,0.55)"
          fontSize={0.58}
          fontFamily="JetBrains Mono, monospace"
          transform="rotate(90 16.15 11)"
        >
          22,00 m
        </text>

        {/* Room Polygons */}
        {ROOMS.map((room) => {
          const pts = room.polygon.map((p) => `${p.x},${p.z}`).join(' ');
          const isSelected = selectedRoomId === room.id;
          const isHovered = hoveredRoomId === room.id;
          const isCurrentWalk = navMode === 'walk' && telemetry?.currentRoomId === room.id;

          let fill = CATEGORY_FILL[room.category];
          if (isSelected) fill = 'rgba(245, 158, 11, 0.34)';
          else if (isHovered || isCurrentWalk) fill = 'rgba(245, 158, 11, 0.18)';

          return (
            <g
              key={room.id}
              className="cursor-pointer"
              onClick={() => onSelectRoom(room.id)}
              onMouseEnter={() => onHoverRoom(room.id)}
              onMouseLeave={() => onHoverRoom(null)}
            >
              <polygon
                points={pts}
                fill={fill}
                stroke={isSelected ? '#f59e0b' : 'rgba(255,255,255,0.08)'}
                strokeWidth={isSelected ? 0.14 : 0.05}
              />
              <text
                x={room.center.x}
                y={room.center.z + 0.18}
                textAnchor="middle"
                fill={isSelected ? '#fef3c7' : 'rgba(244,244,245,0.82)'}
                fontSize={room.shortLabel.length > 6 ? 0.44 : 0.54}
                fontWeight={isSelected ? 700 : 500}
                fontFamily="Plus Jakarta Sans, sans-serif"
                pointerEvents="none"
              >
                {room.shortLabel}
              </text>
            </g>
          );
        })}

        {/* Wall Segments & Door Openings */}
        {WALL_SEGMENTS.map((w) => {
          const dx = w.end.x - w.start.x;
          const dz = w.end.z - w.start.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.01) return null;
          const ux = dx / len;
          const uz = dz / len;

          const sorted = [...w.openings].sort((a, b) => a.offset - b.offset);
          const solidLines: Array<{ x1: number; z1: number; x2: number; z2: number }> = [];
          const windowLines: Array<{ x1: number; z1: number; x2: number; z2: number }> = [];
          let cur = 0;

          for (const op of sorted) {
            if (op.offset > cur) {
              solidLines.push({
                x1: w.start.x + ux * cur,
                z1: w.start.z + uz * cur,
                x2: w.start.x + ux * op.offset,
                z2: w.start.z + uz * op.offset,
              });
            }
            if (op.type === 'window' || op.type === 'sliding') {
              windowLines.push({
                x1: w.start.x + ux * op.offset,
                z1: w.start.z + uz * op.offset,
                x2: w.start.x + ux * (op.offset + op.width),
                z2: w.start.z + uz * (op.offset + op.width),
              });
            }
            cur = op.offset + op.width;
          }
          if (cur < len) {
            solidLines.push({
              x1: w.start.x + ux * cur,
              z1: w.start.z + uz * cur,
              x2: w.end.x,
              z2: w.end.z,
            });
          }

          return (
            <g key={w.id} pointerEvents="none">
              {solidLines.map((l, idx) => (
                <line
                  key={`s-${idx}`}
                  x1={l.x1}
                  y1={l.z1}
                  x2={l.x2}
                  y2={l.z2}
                  stroke="#e4e4e7"
                  strokeWidth={w.isExterior ? 0.22 : 0.13}
                  strokeLinecap="square"
                />
              ))}
              {windowLines.map((l, idx) => (
                <line
                  key={`w-${idx}`}
                  x1={l.x1}
                  y1={l.z1}
                  x2={l.x2}
                  y2={l.z2}
                  stroke="#38bdf8"
                  strokeWidth={0.1}
                />
              ))}
            </g>
          );
        })}

        {/* Veranda Columns */}
        {COLUMNS.map((c) => (
          <rect
            key={c.id}
            x={c.x - c.size / 2}
            y={c.z - c.size / 2}
            width={c.size}
            height={c.size}
            fill="#e4e4e7"
            pointerEvents="none"
          />
        ))}

        {/* Live 1st-Person Camera Cone */}
        {renderCameraCone()}
      </svg>
    </div>
  );
};
