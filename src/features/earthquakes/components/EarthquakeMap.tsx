"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type {
  CircleLayerSpecification,
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  GeoJSONSource,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Layer, NavigationControl, Popup, Source, type MapRef } from "react-map-gl/maplibre";
import { formatRelativeTime } from "@/lib/relativeTime";
import { toGeoJson, type EarthquakeFeatureCollection } from "../geojson";
import { magnitudeColorExpression, magnitudeRadiusExpression } from "../magnitude";
import type { EarthquakeEvent } from "../types";

const CIRCLE_LAYER_ID = "earthquakes-circles";
const PULSE_SOURCE_ID = "earthquakes-pulse-source";
const PULSE_LAYER_ID = "earthquakes-pulse";

// Free, no-API-key dark base map.
const CARTO_DARK_MATTER = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// Pulse animation tuning.
const PULSE_DURATION_MS = 900; // one ring expansion
const PULSE_REPEATS = 3;
const PULSE_MAX_SCALE = 3; // ring grows to 3× the dot radius before fading

const EMPTY_FC: EarthquakeFeatureCollection = { type: "FeatureCollection", features: [] };
// Stable empty default so an omitted `newEvents` prop doesn't retrigger effects.
const EMPTY_EVENTS: readonly EarthquakeEvent[] = [];

/**
 * Age-based opacity: events from the last hour render at full opacity, then
 * decay toward a floor across the rest of the feed window. `now` is baked into
 * the expression at build time and refreshed whenever new data arrives (once
 * per poll), which is granular enough — opacity barely moves within 60s.
 */
function ageOpacityExpression(
  now: number,
  windowMs: number,
): DataDrivenPropertyValueSpecification<number> {
  // Guarantee strictly ascending interpolation stops.
  const tail = Math.max(windowMs, HOUR_MS * 2);
  return [
    "interpolate",
    ["linear"],
    ["-", now, ["get", "timeMs"]],
    0,
    1,
    HOUR_MS,
    1,
    tail,
    0.25,
  ] as DataDrivenPropertyValueSpecification<number>;
}

/** Geographic viewport bounds emitted by the map (degrees). */
export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface EarthquakeMapProps {
  events: readonly EarthquakeEvent[];
  /**
   * Newly-arrived events to pulse. Sourced from the feed-level notifier lifted
   * to the page (so it diffs the raw feed, not the filtered view), then
   * intersected here with what's actually on screen.
   */
  newEvents?: readonly EarthquakeEvent[];
  /** Controlled selection: opens a popup and flies to this event. */
  selectedEvent?: EarthquakeEvent | null;
  /** Fired when the user clicks a dot (event) or dismisses the popup (null). */
  onSelect?: (event: EarthquakeEvent | null) => void;
  /** Fired on load and after each move with the current viewport bounds. */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** Feed window in ms; drives the opacity decay tail. Defaults to one day. */
  windowMs?: number;
}

interface HoverState {
  event: EarthquakeEvent;
  x: number;
  y: number;
}

/**
 * World map of earthquakes.
 *
 * Events are rendered as a native MapLibre GeoJSON source + circle layer, NOT
 * as individual React `<Marker>` components. The monthly feed carries ~10k
 * events; that many DOM markers would each be a React element + absolutely
 * positioned node reprojected every frame on pan/zoom, which tanks frame rate.
 * A single circle layer draws all points on the GPU and stays smooth.
 *
 * Styling (radius, color, opacity) is fully data-driven via MapLibre
 * expressions generated from the magnitude scale in `magnitude.ts`, so the TS
 * scale and the GPU rendering share one source of truth.
 */
export function EarthquakeMap({
  events,
  newEvents = EMPTY_EVENTS,
  selectedEvent = null,
  onSelect,
  onBoundsChange,
  windowMs = DAY_MS,
}: EarthquakeMapProps) {
  const mapRef = useRef<MapRef>(null);
  const reducedMotionRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const pulseStartRef = useRef(0);
  // Latest events read inside effects without making them a dependency.
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const [cursor, setCursor] = useState<"grab" | "pointer">("grab");

  const eventsById = useMemo(() => {
    const map = new Map<string, EarthquakeEvent>();
    for (const event of events) map.set(event.id, event);
    return map;
  }, [events]);

  const data = useMemo(() => toGeoJson(events), [events]);

  // Expressions are stable; the color/radius scales never change at runtime.
  const colorExpr = useMemo<ExpressionSpecification>(() => magnitudeColorExpression(), []);
  const radiusExpr = useMemo<ExpressionSpecification>(() => magnitudeRadiusExpression(), []);

  const circlePaint = useMemo<CircleLayerSpecification["paint"]>(
    () => ({
      "circle-color": colorExpr,
      "circle-radius": radiusExpr,
      // `now` is baked into the age ramp; recomputed whenever `data` changes
      // (once per poll) so it stays current. `data` is a dependency for that
      // freshness even though its value isn't read here.
      "circle-opacity": ageOpacityExpression(Date.now(), windowMs),
      "circle-stroke-color": "#05070a",
      "circle-stroke-width": 0.5,
      "circle-stroke-opacity": 0.5,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `data` intentionally re-anchors `now`
    [colorExpr, radiusExpr, windowMs, data],
  );

  // Track the reduced-motion preference in a ref (read inside rAF, no re-render).
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = query.matches;
    const onChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Cancel any in-flight animation on unmount.
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const emitBounds = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !onBoundsChange) return;
    // getBounds() reads the projection; guard against transient states where
    // the transform isn't ready so a bounds read can never crash the app.
    let bounds;
    try {
      bounds = map.getBounds();
    } catch {
      return;
    }
    onBoundsChange({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
  }, [onBoundsChange]);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    emitBounds();

    if (!map.getSource(PULSE_SOURCE_ID)) {
      map.addSource(PULSE_SOURCE_ID, { type: "geojson", data: EMPTY_FC });
    }
    if (!map.getLayer(PULSE_LAYER_ID)) {
      // Insert below the solid dots so the ring emanates from behind them.
      const beforeId = map.getLayer(CIRCLE_LAYER_ID) ? CIRCLE_LAYER_ID : undefined;
      map.addLayer(
        {
          id: PULSE_LAYER_ID,
          type: "circle",
          source: PULSE_SOURCE_ID,
          paint: {
            "circle-radius": radiusExpr,
            "circle-color": colorExpr,
            "circle-opacity": 0,
            "circle-stroke-color": colorExpr,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0,
          },
        },
        beforeId,
      );
    }
    setLoaded(true);
  }, [colorExpr, radiusExpr, emitBounds]);

  /**
   * Animate a pulse for freshly-arrived events.
   *
   * The animation runs entirely against the imperative MapLibre map object
   * (`setData` / `setPaintProperty`) inside a single `requestAnimationFrame`
   * loop — deliberately NOT through React state, which would re-render the tree
   * on every frame. React owns the declarative main layer; the pulse is a thin
   * imperative escape hatch layered on top.
   */
  const startPulse = useCallback(
    (added: readonly EarthquakeEvent[]) => {
      if (reducedMotionRef.current || added.length === 0) return;
      const map = mapRef.current?.getMap();
      if (!map) return;

      const source = map.getSource(PULSE_SOURCE_ID);
      if (!source || source.type !== "geojson") return;
      (source as GeoJSONSource).setData(toGeoJson(added));
      pulseStartRef.current = performance.now();

      // A loop is already running — it will pick up the new data and start time.
      if (animationRef.current !== null) return;

      const step = () => {
        const liveMap = mapRef.current?.getMap();
        if (!liveMap || !liveMap.getLayer(PULSE_LAYER_ID)) {
          animationRef.current = null;
          return;
        }

        const elapsed = performance.now() - pulseStartRef.current;
        if (elapsed >= PULSE_DURATION_MS * PULSE_REPEATS) {
          const pulseSource = liveMap.getSource(PULSE_SOURCE_ID);
          if (pulseSource && pulseSource.type === "geojson") {
            (pulseSource as GeoJSONSource).setData(EMPTY_FC);
          }
          liveMap.setPaintProperty(PULSE_LAYER_ID, "circle-opacity", 0);
          liveMap.setPaintProperty(PULSE_LAYER_ID, "circle-stroke-opacity", 0);
          animationRef.current = null;
          return;
        }

        const progress = (elapsed % PULSE_DURATION_MS) / PULSE_DURATION_MS; // 0→1 per ring
        const scale = 1 + progress * PULSE_MAX_SCALE;
        liveMap.setPaintProperty(PULSE_LAYER_ID, "circle-radius", [
          "*",
          radiusExpr,
          scale,
        ] as ExpressionSpecification);
        liveMap.setPaintProperty(PULSE_LAYER_ID, "circle-stroke-opacity", 1 - progress);
        liveMap.setPaintProperty(PULSE_LAYER_ID, "circle-opacity", (1 - progress) * 0.25);

        animationRef.current = requestAnimationFrame(step);
      };

      animationRef.current = requestAnimationFrame(step);
    },
    [radiusExpr],
  );

  // Pulse newly-arrived events, but only those currently on screen (a new event
  // filtered out of the view shouldn't leave an orphan ring). `events` is read
  // through a ref so changing the filter doesn't re-fire the pulse — only a new
  // `newEvents` batch (a genuine poll) does.
  useEffect(() => {
    if (newEvents.length === 0) return;
    const visibleIds = new Set(eventsRef.current.map((event) => event.id));
    const toPulse = newEvents.filter((event) => visibleIds.has(event.id));
    if (toPulse.length > 0) startPulse(toPulse);
  }, [newEvents, startPulse]);

  // Controlled selection: fly to the selected event so a table-row click reveals
  // it on the map.
  useEffect(() => {
    if (!selectedEvent) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.flyTo({
      center: [selectedEvent.longitude, selectedEvent.latitude],
      zoom: Math.max(map.getZoom(), 4),
      duration: 800,
    });
  }, [selectedEvent]);

  const resolveEvent = useCallback(
    (feature: MapGeoJSONFeature | undefined) => {
      const rawId = feature?.properties?.id;
      return typeof rawId === "string" ? eventsById.get(rawId) : undefined;
    },
    [eventsById],
  );

  const handleMouseMove = useCallback(
    (event: MapLayerMouseEvent) => {
      const resolved = resolveEvent(event.features?.[0]);
      if (!resolved) {
        setHovered(null);
        setCursor("grab");
        return;
      }
      setHovered({ event: resolved, x: event.point.x, y: event.point.y });
      setCursor("pointer");
    },
    [resolveEvent],
  );

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
    setCursor("grab");
  }, []);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const resolved = resolveEvent(event.features?.[0]);
      onSelect?.(resolved ?? null);
    },
    [resolveEvent, onSelect],
  );

  return (
    <div className="relative h-full w-full">
      <MapGL
        ref={mapRef}
        mapStyle={CARTO_DARK_MATTER}
        initialViewState={{ longitude: 0, latitude: 20, zoom: 1.6 }}
        style={{ width: "100%", height: "100%" }}
        // Render a single world (no duplicated continents on wide screens);
        // `minZoom` keeps it filling the viewport. We deliberately do NOT set
        // `maxBounds` here: maplibre-gl v5 throws during init when a full-world
        // `maxBounds` is combined with `renderWorldCopies: false` (it constrains
        // against an uninitialized projection matrix). `renderWorldCopies:false`
        // alone already prevents the duplicate-world artifact. Rotation is off
        // (no compass); attribution stays visible (compact) per the license.
        renderWorldCopies={false}
        minZoom={1.4}
        dragRotate={false}
        pitchWithRotate={false}
        attributionControl={{ compact: true }}
        interactiveLayerIds={[CIRCLE_LAYER_ID]}
        cursor={cursor}
        onLoad={handleLoad}
        onMoveEnd={emitBounds}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <NavigationControl position="top-right" showCompass={false} showZoom />
        <Source id="earthquakes" type="geojson" data={data} promoteId="id">
          <Layer id={CIRCLE_LAYER_ID} type="circle" paint={circlePaint} />
        </Source>

        {selectedEvent ? (
          <Popup
            longitude={selectedEvent.longitude}
            latitude={selectedEvent.latitude}
            anchor="bottom"
            offset={12}
            closeOnClick={false}
            onClose={() => onSelect?.(null)}
            maxWidth="280px"
          >
            <PopupContent event={selectedEvent} />
          </Popup>
        ) : null}
      </MapGL>

      {hovered ? <MapTooltip hovered={hovered} /> : null}

      {!loaded ? (
        <div className="text-fg-muted pointer-events-none absolute inset-0 grid place-items-center text-sm">
          Loading map…
        </div>
      ) : null}
    </div>
  );
}

function MapTooltip({ hovered }: { hovered: HoverState }) {
  const { event, x, y } = hovered;
  return (
    <div
      className="border-border bg-surface-2/95 pointer-events-none absolute z-10 max-w-[220px] rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
      style={{ left: x + 14, top: y + 14 }}
    >
      <p className="text-fg mb-1 font-medium">{event.title}</p>
      <p className="text-fg-secondary flex justify-between gap-4">
        <span>Magnitude</span>
        <span className="text-fg tabular-nums">{event.magnitude?.toFixed(1) ?? "—"}</span>
      </p>
      <p className="text-fg-secondary flex justify-between gap-4">
        <span>Depth</span>
        <span className="text-fg tabular-nums">{event.depth.toFixed(1)} km</span>
      </p>
      <p className="text-fg-secondary flex justify-between gap-4">
        <span>When</span>
        <span className="text-fg tabular-nums">{formatRelativeTime(event.time, new Date())}</span>
      </p>
    </div>
  );
}

function PopupContent({ event }: { event: EarthquakeEvent }) {
  return (
    <div className="text-fg flex flex-col gap-2">
      <p className="text-sm leading-snug font-semibold">{event.title}</p>
      <dl className="text-fg-secondary grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt>Magnitude</dt>
        <dd className="text-fg text-right tabular-nums">{event.magnitude?.toFixed(1) ?? "—"}</dd>
        <dt>Depth</dt>
        <dd className="text-fg text-right tabular-nums">{event.depth.toFixed(1)} km</dd>
        <dt>Time</dt>
        <dd className="text-fg text-right tabular-nums">
          {formatRelativeTime(event.time, new Date())}
        </dd>
        {event.place ? (
          <>
            <dt>Place</dt>
            <dd className="text-fg text-right">{event.place}</dd>
          </>
        ) : null}
      </dl>
      <a
        href={event.url}
        target="_blank"
        rel="noreferrer"
        className="text-accent text-xs font-medium hover:underline"
      >
        View on USGS ↗
      </a>
    </div>
  );
}
