import type { RegionKind } from "./vision";
export type Point = [number, number];
export type Annotation = { id: string; label: string; kind: RegionKind; polygon: Point[]; groundAnchor: Point; baseAnchor: Point; level: number; probe: Point };
export type SceneId = "cabin" | "harbour";
/** Small hand-labelled comparison patches, not exhaustive scene segmentation. */
export const ANNOTATIONS: Record<SceneId, Annotation[]> = {
  cabin: [
    { id: "roof", label: "Cabin roof", kind: "roof", polygon: [[.216,.155],[.258,.155],[.35,0],[.387,0],[.469,.155],[.586,.155],[.586,.387],[.469,.389],[.371,.226],[.267,.389],[.216,.383]], groundAnchor: [.40,.559], baseAnchor: [.40,.559], level: 4, probe: [.42,.10] },
    { id: "wall", label: "Cabin facade", kind: "wall", polygon: [[.224,.389],[.267,.389],[.371,.226],[.469,.389],[.575,.389],[.575,.550],[.224,.550]], groundAnchor: [.40,.559], baseAnchor: [.40,.559], level: 3, probe: [.40,.45] },
    { id: "bridge", label: "River bridge", kind: "bridge", polygon: [[.325,.773],[.408,.773],[.408,.917],[.325,.917]], groundAnchor: [.365,.917], baseAnchor: [.365,.917], level: 2, probe: [.37,.86] },
    { id: "water", label: "River patch", kind: "water", polygon: [[.02,.816],[.30,.816],[.30,.902],[.02,.902]], groundAnchor: [.14,.86], baseAnchor: [.14,.86], level: 0, probe: [.14,.86] },
  ],
  harbour: [
    { id: "roof", label: "Central roof", kind: "roof", polygon: [[.299,.211],[.454,.033],[.565,.204],[.565,.324],[.454,.200],[.350,.324],[.299,.304]], groundAnchor: [.45,.448], baseAnchor: [.45,.448], level: 4, probe: [.45,.10] },
    { id: "wall", label: "Central facade", kind: "wall", polygon: [[.304,.322],[.350,.324],[.454,.200],[.562,.324],[.562,.448],[.304,.448]], groundAnchor: [.45,.448], baseAnchor: [.45,.448], level: 3, probe: [.41,.38] },
    { id: "bridge", label: "West dock patch", kind: "bridge", polygon: [[.177,.620],[.427,.620],[.427,.725],[.177,.725]], groundAnchor: [.30,.735], baseAnchor: [.30,.735], level: 2, probe: [.28,.66] },
    { id: "water", label: "Water patch", kind: "water", polygon: [[.02,.81],[.18,.81],[.18,.98],[.02,.98]], groundAnchor: [.10,.90], baseAnchor: [.10,.90], level: 0, probe: [.10,.90] },
  ],
};
export function contains(polygon: Point[], [x, y]: Point): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!; const b = polygon[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
