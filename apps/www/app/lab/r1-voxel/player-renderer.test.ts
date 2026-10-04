import { type Mesh, Texture, Vector3 } from "three";
import { expect, it } from "vitest";
import { createVoxelPlayer } from "./player-renderer";

it("keeps feet in world space, tests/writes alpha depth and casts a world-space body shadow", () => {
  const player = createVoxelPlayer(new Texture());
  const billboard = player.group.children[0] as Mesh;
  const body = player.group.children[1] as Mesh;
  for (const [rotation, inclination] of [[0, 45], [25, 38], [90, 0], [180, 90]]) {
    player.update({ x: 12.5, y: 45.5, z: 3 }, rotation!, inclination!);
    player.group.updateMatrixWorld(true);
    expect(player.group.position.toArray()).toEqual([12.5, -45.5, 3]);
    expect(new Vector3(0, 0, 1).transformDirection(billboard.matrixWorld).z).toBeCloseTo(Math.sin(inclination! * Math.PI / 180));
    expect(body.getWorldPosition(new Vector3()).toArray()).toEqual([12.5, -45.5, 4]);
  }
  expect(billboard.material).toMatchObject({ depthTest: true, depthWrite: true, transparent: false, alphaTest: 0.5 });
  expect(body.castShadow).toBe(true);
  expect(body.material).toMatchObject({ colorWrite: false, depthWrite: false });
  player.dispose();
});
