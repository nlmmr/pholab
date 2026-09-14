import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface CameraCalibration {
  /** Millimeters in world space per screen pixel at the target plane */
  mmPerPixel: number;
  /** Pixels on screen per millimeter in world space */
  pixelsPerMm: number;
  /** Distance in meters along camera forward optical axis to the target plane */
  depthMeters: number;
  /** Camera vertical field of view in degrees */
  fov: number;
  /** Viewport dimensions in CSS pixels */
  viewportWidth: number;
  viewportHeight: number;
  /** Active camera focus target identifier */
  targetFocus?: string;
  /** Human-readable name of the plane/point calibrated against */
  targetName?: string;
  /** Dedicated calibration for the observation screen plane (X ≈ 1.37m) */
  screenCalibration?: {
    mmPerPixel: number;
    pixelsPerMm: number;
    depthMeters: number;
  };
}

export interface HUDOverlayRulerProps {
  /** Active perspective camera calibration */
  calibration: CameraCalibration | null;
  /** Callback fired to dismiss/close the ruler */
  onClose: () => void;
}

type DragMode = 'body' | 'jaw1' | 'jaw2' | 'rotate' | null;

export const HUDOverlayRuler: React.FC<HUDOverlayRulerProps> = ({ calibration, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ruler position and orientation in viewport pixels
  const [cx, setCx] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth * 0.5 : 400));
  const [cy, setCy] = useState<number>(() => (typeof window !== 'undefined' ? window.innerHeight * 0.5 : 300));
  const [angle, setAngle] = useState<number>(0);

  // Caliper jaws along the local ruler X-axis in pixels
  const [s1, setS1] = useState<number>(0);
  const [s2, setS2] = useState<number>(140);

  // Calibration plane mode: 'active' (active camera focus target) or 'screen' (observation screen at X ≈ 1.37m)
  const [planeMode, setPlaneMode] = useState<'active' | 'screen'>('screen');

  // Drag state tracking
  const [activeDrag, setActiveDrag] = useState<DragMode>(null);
  const dragStartRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startCx: number;
    startCy: number;
    startAngle: number;
    startS1: number;
    startS2: number;
    startAngleRad: number;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startCx: 0,
    startCy: 0,
    startAngle: 0,
    startS1: 0,
    startS2: 0,
    startAngleRad: 0,
  });

  // Effective mm per pixel based on chosen calibration plane
  const effectiveMmPerPixel = (
    planeMode === 'screen' && calibration?.screenCalibration
      ? calibration.screenCalibration.mmPerPixel
      : calibration?.mmPerPixel
  ) ?? 0.092;

  const effectivePixelsPerMm = 1 / Math.max(0.0001, effectiveMmPerPixel);

  // Calculated physical measurements
  const spanPixels = Math.abs(s2 - s1);
  const distanceMm = spanPixels * effectiveMmPerPixel;
  // Instrumental uncertainty based on visual reading and pixel resolution:
  const uncertaintyMm = Math.max(0.1, Number((0.5 * effectiveMmPerPixel).toFixed(1)));

  // Normalized display angle: -180° to +180°
  let normAngle = ((angle % 360) + 360) % 360;
  if (normAngle > 180) normAngle -= 360;

  // Initialize position and sensible default span if uninitialized
  useEffect(() => {
    if (calibration?.viewportWidth && calibration?.viewportHeight) {
      setCx((prev) => {
        // If out of bounds or default center, keep inside viewport
        if (prev <= 0 || prev > calibration.viewportWidth) return calibration.viewportWidth * 0.5;
        return prev;
      });
      setCy((prev) => {
        if (prev <= 0 || prev > calibration.viewportHeight) return calibration.viewportHeight * 0.5;
        return prev;
      });
    }
  }, [calibration?.viewportWidth, calibration?.viewportHeight]);

  // Convert screen coordinates (px, py) to local ruler coordinates along the axis
  const screenToLocal = useCallback((px: number, py: number, currentCx: number, currentCy: number, currentAngleDeg: number) => {
    const rad = (currentAngleDeg * Math.PI) / 180;
    const dx = px - currentCx;
    const dy = py - currentCy;
    const localX = dx * Math.cos(-rad) - dy * Math.sin(-rad);
    const localY = dx * Math.sin(-rad) + dy * Math.cos(-rad);
    return { localX, localY };
  }, []);

  // Pointer Down Handlers
  const handlePointerDown = (mode: DragMode, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const rad = Math.atan2(e.clientY - cy, e.clientX - cx);

    dragStartRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startCx: cx,
      startCy: cy,
      startAngle: angle,
      startS1: s1,
      startS2: s2,
      startAngleRad: rad,
    };
    setActiveDrag(mode);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const start = dragStartRef.current;
    if (!start.mode) return;

    if (start.mode === 'body') {
      const dx = e.clientX - start.startX;
      const dy = e.clientY - start.startY;
      setCx(start.startCx + dx);
      setCy(start.startCy + dy);
    } else if (start.mode === 'rotate') {
      const currentRad = Math.atan2(e.clientY - start.startCy, e.clientX - start.startCx);
      let deltaDeg = ((currentRad - start.startAngleRad) * 180) / Math.PI;
      let newAngle = start.startAngle + deltaDeg;

      if (e.shiftKey) {
        // Snap to nearest 15 degrees when holding Shift
        newAngle = Math.round(newAngle / 15) * 15;
      }
      setAngle(newAngle);
    } else if (start.mode === 'jaw1') {
      const { localX } = screenToLocal(e.clientX, e.clientY, cx, cy, angle);
      // Ensure jaw1 stays before jaw2 minus minimum 2px
      setS1(Math.min(s2 - 2, Math.round(localX)));
    } else if (start.mode === 'jaw2') {
      const { localX } = screenToLocal(e.clientX, e.clientY, cx, cy, angle);
      // Ensure jaw2 stays after jaw1 plus minimum 2px
      setS2(Math.max(s1 + 2, Math.round(localX)));
    }
  }, [cx, cy, angle, s1, s2, screenToLocal]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (dragStartRef.current.mode) {
      try {
        (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      } catch {
        // Ignored if capture wasn't held
      }
      dragStartRef.current.mode = null;
      setActiveDrag(null);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // Quick action presets
  const setHorizontal = () => setAngle(0);
  const setVertical = () => setAngle(90);
  const resetAndCenter = () => {
    const vpW = calibration?.viewportWidth ?? window.innerWidth;
    const vpH = calibration?.viewportHeight ?? window.innerHeight;
    setCx(vpW * 0.5);
    setCy(vpH * 0.5);
    setAngle(0);
    setS1(0);
    setS2(Math.round(25 * effectivePixelsPerMm));
  };

  const nudgeDistance = (deltaMm: number) => {
    const deltaPx = deltaMm * effectivePixelsPerMm;
    setS2((prev) => Math.max(s1 + 2, Math.round(prev + deltaPx)));
  };

  const nudgeAngle = (deltaDeg: number) => {
    setAngle((prev) => prev + deltaDeg);
  };

  // Dynamic ruler dimensions
  const minS = Math.min(s1, s2);
  const maxS = Math.max(s1, s2);
  const barStart = Math.min(-35, minS - 35);
  const barEnd = Math.max(maxS + 60, 360);
  const barWidth = barEnd - barStart;
  const barHeight = 46;

  // Generate millimeter graduation ticks
  const ticks: { x: number; height: number; stroke: string; strokeWidth: number; label?: string }[] = [];
  const minMm = Math.floor(barStart / effectivePixelsPerMm);
  const maxMm = Math.ceil(barEnd / effectivePixelsPerMm);

  // Adaptive tick interval to avoid clutter at extreme zoom-out
  const stepMm = effectivePixelsPerMm >= 3.5 ? 1 : effectivePixelsPerMm >= 1.8 ? 2 : 5;

  for (let m = minMm; m <= maxMm; m += stepMm) {
    const xPos = m * effectivePixelsPerMm;
    if (xPos < barStart + 12 || xPos > barEnd - 12) continue;

    const isMajor = m % 10 === 0;
    const isMedium = m % 5 === 0 && !isMajor;

    let height = 6;
    let stroke = 'rgba(148, 163, 184, 0.65)';
    let strokeWidth = 1;
    let label: string | undefined = undefined;

    if (isMajor) {
      height = 16;
      stroke = '#38bdf8';
      strokeWidth = 1.75;
      label = String(m);
    } else if (isMedium) {
      height = 10;
      stroke = '#7dd3fc';
      strokeWidth = 1.25;
    }

    ticks.push({ x: xPos, height, stroke, strokeWidth, label });
  }

  // Dimension line midpoint between jaws
  const midX = (s1 + s2) / 2;

  return (
    <div
      ref={containerRef}
      className="hud-ruler-overlay"
      aria-label="Calibrated 2D Viewport Overlay Ruler"
    >
      {/* Floating upright Digital Readout & Quick Action Toolbar */}
      <div
        className="hud-ruler-badge"
        style={{
          left: `${cx}px`,
          top: `${Math.max(20, cy - 85)}px`,
        }}
        onPointerDown={(e) => handlePointerDown('body', e)}
        title="Drag card to move ruler"
      >
        <div className="hud-badge-drag-grip" title="Drag to reposition">
          ⋮⋮
        </div>

        <div className="hud-metrics-container">
          <div className="hud-metric hud-metric-primary">
            <span className="hud-metric-label">DISTANCE</span>
            <strong className="hud-metric-value">
              d = {distanceMm.toFixed(1)} mm <small className="hud-metric-uncertainty">± {uncertaintyMm.toFixed(1)} mm</small>
            </strong>
          </div>

          <div className="hud-metric">
            <span className="hud-metric-label">ANGLE</span>
            <strong className="hud-metric-value">θ = {normAngle.toFixed(1)}°</strong>
          </div>

          <div className="hud-metric">
            <span className="hud-metric-label">SCALE</span>
            <strong className="hud-metric-value">1 px = {effectiveMmPerPixel.toFixed(3)} mm</strong>
          </div>

          <div
            className={`hud-plane-selector ${planeMode === 'screen' ? 'active-screen' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setPlaneMode((m) => (m === 'screen' ? 'active' : 'screen'));
            }}
            title="Click to toggle calibrated plane between Observation Screen and Focus Target"
          >
            <span className="hud-plane-dot" />
            <span className="hud-plane-label">
              Plane: {planeMode === 'screen' ? 'Screen (1.37m)' : (calibration?.targetName ?? 'Focus Target')}
            </span>
          </div>
        </div>

        <div className="hud-ruler-actions" onPointerDown={(e) => e.stopPropagation()}>
          <div className="hud-nudge-group" title="Fine measurement step">
            <button
              type="button"
              className="hud-action-btn hud-nudge-btn"
              onClick={() => nudgeDistance(-0.1)}
              title="Decrease distance by 0.1 mm"
            >
              -0.1
            </button>
            <button
              type="button"
              className="hud-action-btn hud-nudge-btn"
              onClick={() => nudgeDistance(+0.1)}
              title="Increase distance by 0.1 mm"
            >
              +0.1
            </button>
          </div>

          <div className="hud-nudge-group" title="Fine angle step">
            <button
              type="button"
              className="hud-action-btn hud-nudge-btn"
              onClick={() => nudgeAngle(-1)}
              title="Rotate counter-clockwise 1°"
            >
              -1°
            </button>
            <button
              type="button"
              className="hud-action-btn hud-nudge-btn"
              onClick={() => nudgeAngle(+1)}
              title="Rotate clockwise 1°"
            >
              +1°
            </button>
          </div>

          <button
            type="button"
            className="hud-action-btn"
            onClick={setHorizontal}
            title="Align ruler horizontally (0°)"
          >
            Horizontal
          </button>
          <button
            type="button"
            className="hud-action-btn"
            onClick={setVertical}
            title="Align ruler vertically (90°)"
          >
            Vertical
          </button>
          <button
            type="button"
            className="hud-action-btn"
            onClick={resetAndCenter}
            title="Center ruler in viewport and reset span"
          >
            Reset/Center
          </button>
          <button
            type="button"
            className="hud-action-btn hud-close-btn"
            onClick={onClose}
            title="Close ruler (or press 'R')"
            aria-label="Close ruler"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Full-viewport SVG layer */}
      <svg className="hud-ruler-svg" width="100%" height="100%">
        <defs>
          <linearGradient id="hud-ruler-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="0.94" />
          </linearGradient>

          <linearGradient id="hud-caliper-blade-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.28)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 0.65)" />
          </linearGradient>

          <filter id="hud-cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <marker
            id="hud-arrow-start"
            viewBox="0 0 10 10"
            refX="4"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 10 1 L 1 5 L 10 9 z" fill="#38bdf8" />
          </marker>
          <marker
            id="hud-arrow-end"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* Transformed group oriented with ruler center (cx, cy) and rotation angle */}
        <g transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
          {/* Subtle tether line up to floating card */}
          <line
            x1={0}
            y1={-barHeight / 2}
            x2={0}
            y2={-barHeight / 2 - 14}
            stroke="rgba(56, 189, 248, 0.35)"
            strokeDasharray="2 3"
            strokeWidth="1.5"
          />

          {/* 1. Main Ruler Bar Body (Draggable) */}
          <rect
            className="hud-ruler-bar"
            x={barStart}
            y={-barHeight / 2}
            width={barWidth}
            height={barHeight}
            rx={7}
            fill="url(#hud-ruler-body-grad)"
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth={1.5}
            onPointerDown={(e) => handlePointerDown('body', e)}
            style={{ cursor: activeDrag === 'body' ? 'grabbing' : 'grab' }}
          />

          {/* Longitudinal fiducial hairline */}
          <line
            x1={barStart + 10}
            y1={0}
            x2={barEnd - 10}
            y2={0}
            stroke="rgba(56, 189, 248, 0.22)"
            strokeWidth={1}
            pointerEvents="none"
          />

          {/* 2. Millimeter Graduation Ticks & Labels */}
          {ticks.map((tick, idx) => (
            <g key={idx} pointerEvents="none">
              <line
                x1={tick.x}
                y1={-barHeight / 2}
                x2={tick.x}
                y2={-barHeight / 2 + tick.height}
                stroke={tick.stroke}
                strokeWidth={tick.strokeWidth}
              />
              {tick.label && (
                <text
                  x={tick.x}
                  y={-barHeight / 2 + tick.height + 9}
                  fill="#cbd5e1"
                  fontSize={8.5}
                  fontWeight={700}
                  textAnchor="middle"
                  fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                >
                  {tick.label}
                </text>
              )}
            </g>
          ))}

          {/* 3. Translucent Measurement Span Highlight */}
          <rect
            x={minS}
            y={-barHeight / 2}
            width={spanPixels}
            height={barHeight + 70}
            fill="rgba(56, 189, 248, 0.08)"
            stroke="rgba(56, 189, 248, 0.2)"
            strokeDasharray="4 4"
            pointerEvents="none"
          />

          {/* 4. Dimension Line with Double Arrows & Real-time Badge */}
          <g pointerEvents="none">
            <line
              x1={s1}
              y1={barHeight / 2 + 34}
              x2={s2}
              y2={barHeight / 2 + 34}
              stroke="#38bdf8"
              strokeWidth={1.5}
              markerStart="url(#hud-arrow-start)"
              markerEnd="url(#hud-arrow-end)"
            />

            <g transform={`translate(${midX}, ${barHeight / 2 + 34})`}>
              <rect
                x={-38}
                y={-11}
                width={76}
                height={22}
                rx={5}
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth={1.2}
              />
              <text
                x={0}
                y={3}
                fill="#38bdf8"
                fontSize={10.5}
                fontWeight={800}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
              >
                {distanceMm.toFixed(1)} mm
              </text>
            </g>
          </g>

          {/* 5. Caliper Jaw 1 (Reference Pointer / Left Jaw) */}
          <g className="hud-caliper-jaw jaw-1">
            {/* Extended alignment blade */}
            <polygon
              points={`${s1},${-barHeight / 2} ${s1 - 16},${-barHeight / 4} ${s1 - 16},${barHeight / 2 + 45} ${s1},${barHeight / 2 + 65}`}
              fill="url(#hud-caliper-blade-grad)"
              stroke="rgba(56, 189, 248, 0.35)"
              strokeWidth={1}
              pointerEvents="none"
            />

            {/* Precision hairline */}
            <line
              x1={s1}
              y1={-barHeight / 2}
              x2={s1}
              y2={barHeight / 2 + 65}
              stroke="#f43f5e"
              strokeWidth={1.75}
              pointerEvents="none"
            />

            {/* Target crosshair bead */}
            <circle
              cx={s1}
              cy={barHeight / 2 + 50}
              r={3.5}
              fill="#f43f5e"
              stroke="#ffffff"
              strokeWidth={1}
              pointerEvents="none"
            />

            {/* Jaw 1 Drag Handle */}
            <g
              className="hud-jaw-handle"
              transform={`translate(${s1}, ${barHeight / 2 + 65})`}
              onPointerDown={(e) => handlePointerDown('jaw1', e)}
              style={{ cursor: 'ew-resize' }}
            >
              <rect
                x={-12}
                y={-2}
                width={24}
                height={22}
                rx={6}
                fill="#0f172a"
                stroke="#f43f5e"
                strokeWidth={1.5}
              />
              {/* Grip ridges */}
              <line x1={-5} y1={5} x2={-5} y2={13} stroke="#f43f5e" strokeWidth={1.5} />
              <line x1={0} y1={4} x2={0} y2={14} stroke="#f43f5e" strokeWidth={1.5} />
              <line x1={5} y1={5} x2={5} y2={13} stroke="#f43f5e" strokeWidth={1.5} />
            </g>
          </g>

          {/* 6. Caliper Jaw 2 (Measuring Pointer / Right Jaw) */}
          <g className="hud-caliper-jaw jaw-2">
            {/* Extended alignment blade */}
            <polygon
              points={`${s2},${-barHeight / 2} ${s2 + 16},${-barHeight / 4} ${s2 + 16},${barHeight / 2 + 45} ${s2},${barHeight / 2 + 65}`}
              fill="url(#hud-caliper-blade-grad)"
              stroke="rgba(56, 189, 248, 0.35)"
              strokeWidth={1}
              pointerEvents="none"
            />

            {/* Precision hairline */}
            <line
              x1={s2}
              y1={-barHeight / 2}
              x2={s2}
              y2={barHeight / 2 + 65}
              stroke="#10b981"
              strokeWidth={1.75}
              pointerEvents="none"
            />

            {/* Target crosshair bead */}
            <circle
              cx={s2}
              cy={barHeight / 2 + 50}
              r={3.5}
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth={1}
              pointerEvents="none"
            />

            {/* Jaw 2 Drag Handle */}
            <g
              className="hud-jaw-handle"
              transform={`translate(${s2}, ${barHeight / 2 + 65})`}
              onPointerDown={(e) => handlePointerDown('jaw2', e)}
              style={{ cursor: 'ew-resize' }}
            >
              <rect
                x={-12}
                y={-2}
                width={24}
                height={22}
                rx={6}
                fill="#0f172a"
                stroke="#10b981"
                strokeWidth={1.5}
              />
              {/* Grip ridges */}
              <line x1={-5} y1={5} x2={-5} y2={13} stroke="#10b981" strokeWidth={1.5} />
              <line x1={0} y1={4} x2={0} y2={14} stroke="#10b981" strokeWidth={1.5} />
              <line x1={5} y1={5} x2={5} y2={13} stroke="#10b981" strokeWidth={1.5} />
            </g>
          </g>

          {/* 7. Dedicated Angle / Rotation Handle at Tip */}
          <g
            className="hud-rotation-handle"
            transform={`translate(${barEnd + 20}, 0)`}
            onPointerDown={(e) => handlePointerDown('rotate', e)}
            style={{ cursor: activeDrag === 'rotate' ? 'grabbing' : 'grab' }}
            title="Drag to rotate (Hold Shift to snap 15°)"
          >
            {/* Connecting arm from ruler end */}
            <line x1={-20} y1={0} x2={0} y2={0} stroke="#38bdf8" strokeWidth={2} />

            <circle
              cx={0}
              cy={0}
              r={15}
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth={2}
              filter="url(#hud-cyan-glow)"
            />

            {/* Curved rotation arrows glyph */}
            <path
              d="M -7 -4 A 8 8 0 1 1 -7 4 M -7 -4 L -3 -5 M -7 -4 L -8 0"
              fill="none"
              stroke="#38bdf8"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
