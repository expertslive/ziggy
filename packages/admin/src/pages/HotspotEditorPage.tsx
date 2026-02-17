import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchFloorMap, updateFloorMap } from '../lib/api';
import { SUPPORTED_LANGUAGES } from '@ziggy/shared';
import type { Hotspot } from '@ziggy/shared';

const DEFAULT_COLOR = '#E30613';

type Mode = 'select' | 'draw';

interface ImageBounds {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export function HotspotEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Floor map data
  const [mapName, setMapName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [mode, setMode] = useState<Mode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);

  // Image dimensions for coordinate conversion
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageBounds, setImageBounds] = useState<ImageBounds | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Load floor map data
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchFloorMap(id)
      .then((map: any) => {
        setMapName(map.name || '');
        setImageUrl(map.imageUrl || '');
        setHotspots(map.hotspots || []);
      })
      .catch(() => setError('Failed to load floor map'))
      .finally(() => setLoading(false));
  }, [id]);

  // Calculate image bounds within container on load/resize
  const calcBounds = useCallback(() => {
    if (!containerRef.current || !naturalSize) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const imgAspect = naturalSize.w / naturalSize.h;
    const containerAspect = cw / ch;

    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (imgAspect > containerAspect) {
      // Image is wider - fit to width
      renderW = cw;
      renderH = cw / imgAspect;
      offsetX = 0;
      offsetY = (ch - renderH) / 2;
    } else {
      // Image is taller - fit to height
      renderH = ch;
      renderW = ch * imgAspect;
      offsetX = (cw - renderW) / 2;
      offsetY = 0;
    }
    setImageBounds({ offsetX, offsetY, width: renderW, height: renderH });
  }, [naturalSize]);

  useEffect(() => {
    calcBounds();
    window.addEventListener('resize', calcBounds);
    return () => window.removeEventListener('resize', calcBounds);
  }, [calcBounds]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // Convert pixel coordinates (relative to container) to normalized 0-1
  const pixelToNorm = useCallback(
    (px: number, py: number): [number, number] | null => {
      if (!imageBounds) return null;
      const nx = (px - imageBounds.offsetX) / imageBounds.width;
      const ny = (py - imageBounds.offsetY) / imageBounds.height;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
      return [nx, ny];
    },
    [imageBounds],
  );

  // Convert normalized 0-1 to pixel coordinates within container
  const normToPixel = useCallback(
    (nx: number, ny: number): [number, number] => {
      if (!imageBounds) return [0, 0];
      return [imageBounds.offsetX + nx * imageBounds.width, imageBounds.offsetY + ny * imageBounds.height];
    },
    [imageBounds],
  );

  // Handle SVG click for drawing
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'draw' || !imageBounds) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const norm = pixelToNorm(px, py);
    if (!norm) return;

    // Check if clicking near the first point to close the polygon
    if (drawingPoints.length >= 3) {
      const [firstPx, firstPy] = normToPixel(drawingPoints[0][0], drawingPoints[0][1]);
      const dist = Math.hypot(px - firstPx, py - firstPy);
      if (dist < 12) {
        completePolygon();
        return;
      }
    }

    setDrawingPoints((prev) => [...prev, norm]);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    if (drawingPoints.length >= 3) {
      completePolygon();
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'draw' || !imageBounds) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const norm = pixelToNorm(px, py);
    setCursorPos(norm);
  };

  const completePolygon = () => {
    if (drawingPoints.length < 3) return;
    const newHotspot: Hotspot = {
      id: crypto.randomUUID(),
      roomName: '',
      label: {},
      points: [...drawingPoints],
      color: DEFAULT_COLOR,
    };
    setHotspots((prev) => [...prev, newHotspot]);
    setDrawingPoints([]);
    setCursorPos(null);
    setSelectedId(newHotspot.id);
    setMode('select');
  };

  const handleSelectHotspot = (hotspotId: string) => {
    if (mode === 'draw') return;
    setSelectedId(hotspotId);
  };

  const handleDeleteHotspot = (hotspotId: string) => {
    setHotspots((prev) => prev.filter((h) => h.id !== hotspotId));
    if (selectedId === hotspotId) setSelectedId(null);
  };

  const updateHotspot = (hotspotId: string, updates: Partial<Hotspot>) => {
    setHotspots((prev) => prev.map((h) => (h.id === hotspotId ? { ...h, ...updates } : h)));
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateFloorMap(id, { hotspots });
      navigate('/floor-maps');
    } catch {
      setError('Failed to save hotspots');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/floor-maps');
  };

  const startDrawing = () => {
    setMode('draw');
    setSelectedId(null);
    setDrawingPoints([]);
    setCursorPos(null);
  };

  const cancelDrawing = () => {
    setMode('select');
    setDrawingPoints([]);
    setCursorPos(null);
  };

  // Handle Escape key to cancel drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'draw') {
          cancelDrawing();
        } else {
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  const selectedHotspot = hotspots.find((h) => h.id === selectedId);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-alt">
        <p className="text-sm text-gray-400">Loading floor map...</p>
      </div>
    );
  }

  if (error && !imageUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-alt">
        <div className="text-center">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => navigate('/floor-maps')} className="mt-4 text-sm font-medium text-primary hover:text-primary-dark">
            Back to Floor Maps
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-surface-alt">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-secondary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Floor Maps
          </button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-bold text-secondary">{mapName}</h1>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-500">{error}</span>}
          <button
            onClick={handleCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Canvas area */}
        <div className="relative flex-1 overflow-hidden p-4">
          {/* Mode indicator */}
          {mode === 'draw' && (
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-secondary/90 px-3 py-2 text-sm text-white shadow-lg">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              Drawing mode — click to add points, close polygon by clicking first point or double-click
              <button onClick={cancelDrawing} className="ml-2 rounded bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30">
                Cancel (Esc)
              </button>
            </div>
          )}

          <div
            ref={containerRef}
            className="relative h-full w-full cursor-crosshair overflow-hidden rounded-lg border border-border bg-white shadow-sm"
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            onMouseMove={handleCanvasMouseMove}
            style={{ cursor: mode === 'draw' ? 'crosshair' : 'default' }}
          >
            {/* Floor map image */}
            <img
              src={imageUrl}
              alt={mapName}
              onLoad={handleImageLoad}
              className="h-full w-full object-contain"
              draggable={false}
            />

            {/* SVG overlay - positioned exactly over the rendered image */}
            {imageBounds && (
              <svg
                className="absolute top-0 left-0"
                style={{
                  left: imageBounds.offsetX,
                  top: imageBounds.offsetY,
                  width: imageBounds.width,
                  height: imageBounds.height,
                }}
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
              >
                {/* Existing hotspots */}
                {hotspots.map((hotspot) => (
                  <g key={hotspot.id}>
                    <polygon
                      points={hotspot.points.map(([x, y]) => `${x},${y}`).join(' ')}
                      fill={`${hotspot.color || DEFAULT_COLOR}40`}
                      stroke={hotspot.color || DEFAULT_COLOR}
                      strokeWidth="0.003"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectHotspot(hotspot.id);
                      }}
                      className="cursor-pointer"
                      style={
                        selectedId === hotspot.id
                          ? { strokeDasharray: '0.01 0.005', strokeWidth: '0.004' }
                          : undefined
                      }
                    />
                    {/* Label */}
                    {hotspot.roomName && (
                      <text
                        x={hotspot.points.reduce((sum, [px]) => sum + px, 0) / hotspot.points.length}
                        y={hotspot.points.reduce((sum, [, py]) => sum + py, 0) / hotspot.points.length}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={hotspot.color || DEFAULT_COLOR}
                        fontSize="0.02"
                        fontWeight="bold"
                        style={{ pointerEvents: 'none' }}
                      >
                        {hotspot.roomName}
                      </text>
                    )}
                  </g>
                ))}

                {/* Drawing in-progress polygon */}
                {mode === 'draw' && drawingPoints.length > 0 && (
                  <g>
                    {/* Completed edges */}
                    <polyline
                      points={drawingPoints.map(([x, y]) => `${x},${y}`).join(' ')}
                      fill="none"
                      stroke={DEFAULT_COLOR}
                      strokeWidth="0.003"
                      strokeDasharray="0.008 0.004"
                    />
                    {/* Preview line from last point to cursor */}
                    {cursorPos && (
                      <line
                        x1={drawingPoints[drawingPoints.length - 1][0]}
                        y1={drawingPoints[drawingPoints.length - 1][1]}
                        x2={cursorPos[0]}
                        y2={cursorPos[1]}
                        stroke={DEFAULT_COLOR}
                        strokeWidth="0.002"
                        strokeDasharray="0.006 0.004"
                        opacity="0.6"
                      />
                    )}
                    {/* Closing preview line (from cursor to first point) */}
                    {cursorPos && drawingPoints.length >= 2 && (
                      <line
                        x1={cursorPos[0]}
                        y1={cursorPos[1]}
                        x2={drawingPoints[0][0]}
                        y2={drawingPoints[0][1]}
                        stroke={DEFAULT_COLOR}
                        strokeWidth="0.001"
                        strokeDasharray="0.006 0.004"
                        opacity="0.3"
                      />
                    )}
                    {/* Vertex dots */}
                    {drawingPoints.map(([x, y], i) => (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={i === 0 ? '0.008' : '0.005'}
                        fill={i === 0 ? DEFAULT_COLOR : 'white'}
                        stroke={DEFAULT_COLOR}
                        strokeWidth="0.002"
                      />
                    ))}
                  </g>
                )}
              </svg>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="flex w-80 flex-col border-l border-border bg-white">
          {/* Hotspot list */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-secondary">Hotspots ({hotspots.length})</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {hotspots.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No hotspots yet. Click &quot;Draw New&quot; to add one.
              </div>
            )}

            <div className="divide-y divide-border">
              {hotspots.map((hotspot) => (
                <div
                  key={hotspot.id}
                  onClick={() => handleSelectHotspot(hotspot.id)}
                  className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors ${
                    selectedId === hotspot.id ? 'bg-primary/5' : 'hover:bg-surface-alt'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: hotspot.color || DEFAULT_COLOR }}
                    />
                    <span className="text-sm font-medium text-secondary">
                      {hotspot.roomName || 'Unnamed hotspot'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteHotspot(hotspot.id);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Delete hotspot"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Draw button */}
          <div className="border-t border-border px-4 py-3">
            {mode === 'draw' ? (
              <button
                onClick={cancelDrawing}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-surface-alt"
              >
                Cancel Drawing
              </button>
            ) : (
              <button
                onClick={startDrawing}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                + Draw New Hotspot
              </button>
            )}
          </div>

          {/* Selected hotspot properties */}
          {selectedHotspot && mode === 'select' && (
            <div className="border-t border-border px-4 py-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                Selected Hotspot
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Room Name</label>
                  <input
                    value={selectedHotspot.roomName}
                    onChange={(e) => updateHotspot(selectedHotspot.id, { roomName: e.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. Room A"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedHotspot.color || DEFAULT_COLOR}
                      onChange={(e) => updateHotspot(selectedHotspot.id, { color: e.target.value })}
                      className="h-8 w-8 cursor-pointer rounded border border-border"
                    />
                    <input
                      value={selectedHotspot.color || DEFAULT_COLOR}
                      onChange={(e) => updateHotspot(selectedHotspot.id, { color: e.target.value })}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="#E30613"
                    />
                  </div>
                </div>

                {/* Labels per language */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Labels</label>
                  <div className="space-y-2">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <div key={lang} className="flex items-center gap-2">
                        <span className="w-6 text-xs font-medium uppercase text-gray-400">{lang}</span>
                        <input
                          value={selectedHotspot.label[lang] || ''}
                          onChange={(e) =>
                            updateHotspot(selectedHotspot.id, {
                              label: { ...selectedHotspot.label, [lang]: e.target.value },
                            })
                          }
                          className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          placeholder={`Label in ${lang}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Points ({selectedHotspot.points.length} vertices)
                  </label>
                </div>

                <button
                  onClick={() => handleDeleteHotspot(selectedHotspot.id)}
                  className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete Hotspot
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
