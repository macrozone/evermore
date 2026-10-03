import { MEADOW_HOUSE_LIGHTS } from "@evermore/world";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PointLight } from "three";
import { daylightAt, temperatureColor, type LightingSettings } from "./daylight";
import { fixtureSeed, flickerFactor } from "./light-flicker";
import type { LookSettings } from "./pixel-look";

/** Renderer-only glow surfaces; fixture cells still own collision and geometry. */
export function createLocalLights() {
  const group = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  const sources = MEADOW_HOUSE_LIGHTS.map((fixture) => {
    const light = new PointLight(fixture.color, 0, fixture.radius, 2);
    light.position.set(fixture.x + 0.5, -(fixture.y + 0.5), fixture.z + 0.2);
    if (fixture.kind === "window") light.position.y = -(fixture.y + 1.35);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 0.1;
    light.shadow.bias = -0.001;
    light.shadow.normalBias = 0.03;
    group.add(light);
    const material = new MeshBasicMaterial({ color: fixture.color });
    const glow = new Mesh(geometry, material);
    glow.position.set(fixture.x + 0.5, -(fixture.y + 0.5), fixture.kind === "lantern" ? fixture.z - 0.5 : fixture.z);
    glow.scale.set(0.55, 0.55, fixture.kind === "fire" ? 0.75 : 0.55);
    if (fixture.kind === "window") {
      // Cover the exposed south faces of both floors, without leaking indoors.
      glow.position.set(20.5, -44.02, 4.5);
      glow.scale.set(0.86, 0.04, 0.86);
      for (const x of [15.5, 20.5, 23.5]) {
        for (const z of [4.5, 7.5]) {
          if (x === 20.5 && z === 4.5) continue;
          const pane = new Mesh(geometry, material);
          pane.position.set(x, -44.02, z);
          pane.scale.copy(glow.scale);
          group.add(pane);
        }
      }
    }
    if (fixture.kind === "fire") {
      for (const dx of [-0.18, 0.18]) {
        const flame = new Mesh(geometry, material);
        flame.position.copy(glow.position);
        flame.position.x += dx;
        flame.position.z += dx < 0 ? 0.45 : 0.6;
        flame.scale.set(0.22, 0.3, 0.45);
        group.add(flame);
      }
    }
    group.add(glow);
    return { fixture, light, material, seed: fixtureSeed(fixture.id) };
  });
  return {
    group,
    update(settings: LightingSettings, look: LookSettings, seconds = 0) {
      const { day } = daylightAt(settings.hour);
      const temperature = temperatureColor(settings.temperature);
      for (const { fixture, light, material, seed } of sources) {
        const factor = settings.flicker && fixture.kind === "fire"
          ? flickerFactor(seed, seconds, settings.flickerStrength, settings.flickerSpeed) : 1;
        light.color.copy(temperature);
        if (fixture.kind === "fire") light.color.multiplyScalar(0.95);
        light.intensity = settings.localLights ? settings.intensity * (0.2 + (1 - day) * 0.8) * factor : 0;
        light.distance = fixture.radius * settings.radius * (1 + (factor - 1) * 0.35);
        light.shadow.camera.far = light.distance;
        light.shadow.camera.updateProjectionMatrix();
        light.shadow.radius = look.softness;
        light.castShadow = look.shadows;
        material.color.copy(temperature).multiplyScalar(settings.localLights ? (0.6 + (1 - day) * 1.4) * factor : 0.15);
      }
    },
    dispose() {
      geometry.dispose();
      for (const { light, material } of sources) {
        light.shadow.dispose();
        material.dispose();
      }
    },
  };
}
