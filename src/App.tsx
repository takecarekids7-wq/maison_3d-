import { useCallback, useEffect, useState } from 'react';
import {
  Armchair,
  ChevronDown,
  ChevronUp,
  Eye,
  Footprints,
  Layers,
  Map as MapIcon,
  Moon,
  Orbit,
  Sun,
  Sunset,
  Tag,
  X,
} from 'lucide-react';
import { Minimap2D } from './components/Minimap2D';
import { OriginalPlanModal } from './components/OriginalPlanModal';
import {
  CAMERA_PRESETS,
  ROOMS_BY_ID,
  TOTAL_INTERIOR_AREA_SQM,
} from './data/housePlanData';
import {
  CameraTelemetry,
  HouseViewport,
  LightingMode,
  NavMode,
} from './three/HouseViewport';

export default function App() {
  const [navMode, setNavMode] = useState<NavMode>('orbit');
  const [wallHeight, setWallHeight] = useState<number>(2.55);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const [showFurniture, setShowFurniture] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [lightingMode, setLightingMode] = useState<LightingMode>('day');
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);
  const [showMinimap, setShowMinimap] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  );
  const [showOriginalPlan, setShowOriginalPlan] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<CameraTelemetry | null>(null);
  const [presetRequest, setPresetRequest] = useState<{ id: string; seq: number } | null>(null);
  const [focusRoomRequest, setFocusRoomRequest] = useState<{
    roomId: string;
    seq: number;
  } | null>(null);

  const activeRoom =
    (selectedRoomId && ROOMS_BY_ID[selectedRoomId]) ||
    (navMode === 'walk' && telemetry?.currentRoomId && ROOMS_BY_ID[telemetry.currentRoomId]) ||
    (hoveredRoomId && ROOMS_BY_ID[hoveredRoomId]) ||
    null;

  const handleSelectRoom = useCallback((roomId: string | null, flyToRoom = false) => {
    setSelectedRoomId(roomId);
    if (roomId && flyToRoom) {
      setFocusRoomRequest((prev) => ({ roomId, seq: (prev?.seq ?? 0) + 1 }));
    }
  }, []);

  const triggerPreset = useCallback((id: string) => {
    setNavMode('orbit');
    setPresetRequest((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  // Keyboard shortcut 'H' to toggle HUD / Cinema Mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setIsHudCollapsed((v) => !v);
      } else if (e.key === 'Escape') {
        if (showOriginalPlan) setShowOriginalPlan(false);
        else setSelectedRoomId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showOriginalPlan]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#e8e6e1]">
      {/* Full-Viewport Three.js Architectural Scene */}
      <HouseViewport
        navMode={navMode}
        wallHeight={wallHeight}
        selectedRoomId={selectedRoomId}
        hoveredRoomId={hoveredRoomId}
        showFurniture={showFurniture}
        showLabels={showLabels}
        lightingMode={lightingMode}
        presetRequest={presetRequest}
        focusRoomRequest={focusRoomRequest}
        onSelectRoom={(id) => handleSelectRoom(id, false)}
        onHoverRoom={setHoveredRoomId}
        onCameraTelemetry={setTelemetry}
      />

      {/* Top-Left Minimal Architectural Title & Selected Room Readout */}
      {!isHudCollapsed && (
        <header className="pointer-events-none absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-[min(360px,calc(100vw-32px))]">
          <div className="pointer-events-auto rounded-xl border border-white/12 bg-[#181a1e]/92 px-4 py-3 text-zinc-100 shadow-lg">
            <h1 className="text-sm font-semibold tracking-tight text-white">
              Villa Contemporaine 22 × 15 m
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
              <span className="font-mono-tabular">{TOTAL_INTERIOR_AREA_SQM} m² int.</span>
              <span aria-hidden="true">·</span>
              <span>5 Chambres</span>
              <span aria-hidden="true">·</span>
              <span>2 Séjours</span>
              <span aria-hidden="true">·</span>
              <span>Aile 45°</span>
            </div>

            {activeRoom && (
              <div className="mt-2.5 border-t border-white/10 pt-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-amber-400 truncate">
                    {activeRoom.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-tabular text-xs font-medium text-zinc-200">
                      {activeRoom.areaSqm.toFixed(1)} m²
                    </span>
                    {selectedRoomId === activeRoom.id && (
                      <button
                        type="button"
                        onClick={() => setSelectedRoomId(null)}
                        aria-label="Désélectionner la pièce"
                        className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="font-mono-tabular">{activeRoom.dimensionsLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{activeRoom.description}</span>
                </div>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Top-Right Synchronized 2D Minimap & Original Plan Trigger */}
      {!isHudCollapsed && (
        <aside className="pointer-events-auto absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowOriginalPlan(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#181a1e]/92 px-3 py-2 text-xs font-medium text-zinc-200 shadow-lg transition-colors hover:border-amber-400/60 hover:text-white whitespace-nowrap shrink-0"
            >
              <Eye className="h-3.5 w-3.5 text-amber-400" />
              Plan original
            </button>
            <button
              type="button"
              onClick={() => setShowMinimap((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-lg transition-colors whitespace-nowrap shrink-0 ${
                showMinimap
                  ? 'border-amber-500/50 bg-[#181a1e]/92 text-amber-400'
                  : 'border-white/12 bg-[#181a1e]/92 text-zinc-200 hover:text-white'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Plan 2D
            </button>
          </div>

          {showMinimap && (
            <div className="rounded-xl border border-white/12 bg-[#181a1e]/92 p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Cliquer pour centrer</span>
                <span className="font-mono-tabular text-zinc-300">1:100</span>
              </div>
              <Minimap2D
                selectedRoomId={selectedRoomId}
                hoveredRoomId={hoveredRoomId}
                navMode={navMode}
                telemetry={telemetry}
                onSelectRoom={(id) => handleSelectRoom(id, true)}
                onHoverRoom={setHoveredRoomId}
              />
            </div>
          )}
        </aside>
      )}

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div
        className={`pointer-events-none fixed bottom-5 left-1/2 z-30 flex w-full max-w-[min(960px,94vw)] -translate-x-1/2 flex-col items-center transition-transform duration-300 ease-out ${
          isHudCollapsed ? 'translate-y-[calc(100%-16px)]' : 'translate-y-0'
        }`}
      >
        {/* Collapse / Expand Handle */}
        <button
          type="button"
          onClick={() => setIsHudCollapsed((v) => !v)}
          className="pointer-events-auto mb-1.5 flex items-center gap-1.5 rounded-t-lg border border-white/12 bg-[#181a1e]/92 px-3 py-1 text-[11px] font-medium text-zinc-300 shadow-md transition-colors hover:text-white whitespace-nowrap shrink-0"
          title="Basculer les contrôles (Touche H)"
        >
          {isHudCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 text-amber-400" />
              Afficher les contrôles (H)
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              Masquer (H)
            </>
          )}
        </button>

        {/* Main Horizontal Control Dock */}
        <div className="pointer-events-auto flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-xl border border-white/12 bg-[#181a1e]/95 px-4 py-2.5 text-zinc-100 shadow-2xl">
          {/* Navigation Mode Switcher */}
          <div className="flex items-center gap-1 rounded-lg bg-white/6 p-1 shrink-0">
            <button
              type="button"
              onClick={() => setNavMode('orbit')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                navMode === 'orbit'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Orbit className="h-3.5 w-3.5" />
              Orbite 3D
            </button>
            <button
              type="button"
              onClick={() => setNavMode('walk')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                navMode === 'walk'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Footprints className="h-3.5 w-3.5" />
              Visite 1ʳᵉ Pers.
            </button>
          </div>

          {/* Camera Presets (Orbit) or Walk Help (Walk) */}
          {navMode === 'orbit' ? (
            <div className="flex items-center gap-1 overflow-x-auto">
              {CAMERA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => triggerPreset(preset.id)}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white whitespace-nowrap shrink-0"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-zinc-300 whitespace-nowrap">
              <span className="font-mono-tabular text-amber-400">Z Q S D / Flèches</span>
              <span aria-hidden="true" className="text-zinc-500">
                ·
              </span>
              <span>Glisser pour regarder</span>
            </div>
          )}

          {/* Horizontal Wall Cutaway Slider */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Layers className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <label
              htmlFor="wall-cut-slider"
              className="text-xs font-medium text-zinc-300 whitespace-nowrap"
            >
              Coupe murs
            </label>
            <input
              id="wall-cut-slider"
              type="range"
              min={0.35}
              max={2.8}
              step={0.05}
              value={wallHeight}
              onChange={(e) => setWallHeight(parseFloat(e.target.value))}
              className="arch-slider w-24 sm:w-28"
            />
            <span className="font-mono-tabular w-11 text-right text-xs text-zinc-200">
              {wallHeight.toFixed(2)}m
            </span>
          </div>

          {/* Toggles & Lighting Presets */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowFurniture((v) => !v)}
              title="Afficher ou masquer le mobilier"
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                showFurniture
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <Armchair className="h-3.5 w-3.5" />
              Mobilier
            </button>
            <button
              type="button"
              onClick={() => setShowLabels((v) => !v)}
              title="Afficher ou masquer les noms des pièces"
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                showLabels
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              Pièces
            </button>

            <div className="ml-1 flex items-center rounded-lg bg-white/6 p-0.5">
              <button
                type="button"
                onClick={() => setLightingMode('day')}
                aria-label="Lumière Jour"
                title="Jour"
                className={`rounded-md p-1.5 transition-colors ${
                  lightingMode === 'day'
                    ? 'bg-white text-zinc-900'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLightingMode('golden')}
                aria-label="Lumière Dorée"
                title="Fin de journée"
                className={`rounded-md p-1.5 transition-colors ${
                  lightingMode === 'golden'
                    ? 'bg-amber-400 text-zinc-950'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sunset className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLightingMode('night')}
                aria-label="Ambiance Nuit"
                title="Nuit"
                className={`rounded-md p-1.5 transition-colors ${
                  lightingMode === 'night'
                    ? 'bg-slate-700 text-amber-300'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Original Blueprint Comparison Modal */}
      {showOriginalPlan && (
        <OriginalPlanModal onClose={() => setShowOriginalPlan(false)} />
      )}
    </div>
  );
}
