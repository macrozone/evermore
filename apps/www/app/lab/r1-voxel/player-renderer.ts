import type { MovementPosition } from "@evermore/core";
import { PLAYER_HEIGHT } from "@evermore/world";
import { CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Texture } from "three";
import { PLAYER_RADIUS } from "./player-model";

/** Camera-facing billboard with world depth and a camera-independent shadow body. */
export function createVoxelPlayer(texture: Texture) {
  const group = new Group();
  const geometry = new PlaneGeometry(1.6, 3.2);
  // Logical feet are at row 28 of the 32-pixel texture.
  geometry.translate(0, 1.2, 0);
  const material = new MeshBasicMaterial({ map: texture, alphaTest: 0.5, side: DoubleSide, toneMapped: false });
  const billboard = new Mesh(geometry, material);
  group.add(billboard);
  const bodyGeometry = new CylinderGeometry(PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_HEIGHT, 8);
  bodyGeometry.rotateX(Math.PI / 2);
  const bodyMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const body = new Mesh(bodyGeometry, bodyMaterial);
  body.position.z = PLAYER_HEIGHT / 2;
  body.castShadow = true;
  group.add(body);
  return {
    group,
    update(position: MovementPosition, rotation: number, inclination: number) {
      group.position.set(position.x, -position.y, position.z);
      billboard.rotation.set((90 - inclination) * Math.PI / 180, 0, rotation * Math.PI / 180, "ZXY");
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      bodyGeometry.dispose();
      bodyMaterial.dispose();
    },
  };
}
