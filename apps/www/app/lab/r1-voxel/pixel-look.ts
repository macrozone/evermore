import { type OrthographicCamera, type Vector3 } from "three";

export const DEFAULT_LOOK = {
  resolution: 720,
  pixelSize: 2,
  ambient: 1.2,
  sunlight: 2.4,
  shadows: true,
  softness: 3,
  saturation: 1.1,
  palette: false,
  depthOfField: false,
  blurStrength: 3,
  focusRange: 6,
};
export type LookSettings = typeof DEFAULT_LOOK;

// Sprite billboards lie in a camera-facing plane through their world anchor.
export function playerFocusDepth(position: Vector3, camera: OrthographicCamera) {
  return -position.clone().applyMatrix4(camera.matrixWorldInverse).z;
}

// Integer screen pixels keep the nearest-neighbour grid consistent at any DPR.
export function renderDimensions(width: number, height: number, settings: LookSettings) {
  const scale = Math.max(settings.pixelSize, Math.ceil(width / settings.resolution), 1);
  return { width: Math.max(1, Math.floor(width / scale)), height: Math.max(1, Math.floor(height / scale)) };
}

export const LOOK_FRAGMENT = `
  uniform sampler2D worldTexture;
  uniform sampler2D worldDepth;
  uniform bool depthOfField;
  uniform float blurStrength;
  uniform float focusRange;
  uniform float focusDepth;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float saturation;
  uniform bool palette;
  uniform vec3 skyColor;
  uniform float night;
  uniform float hour;
  uniform vec2 renderSize;
  varying vec2 vUv;
  float viewDepth(vec2 uv) {
    // Orthographic depth is linear, unlike perspective depth.
    return mix(cameraNear, cameraFar, texture2D(worldDepth, uv).r);
  }
  vec4 focusedWorld(vec2 uv) {
    vec4 sharp = texture2D(worldTexture, uv);
    if (!depthOfField || blurStrength < 0.5) return sharp;
    float distanceFromFocus = abs(viewDepth(uv) - focusDepth);
    float blur = smoothstep(focusRange, focusRange + max(focusRange, 1.0), distanceFromFocus);
    float radius = floor(blurStrength * blur + 0.5);
    if (radius < 0.5) return sharp;
    vec4 sum = vec4(0.0);
    float weightSum = 0.0;
    for (int y = -2; y <= 2; y++) {
      for (int x = -2; x <= 2; x++) {
        // Every sample lands on a whole low-resolution pixel, before upscaling.
        vec2 kernel = vec2(float(x), float(y));
        vec2 offset = sign(kernel) * floor(abs(kernel) * radius / 2.0 + 0.5);
        vec2 sampleUv = clamp(uv + offset / renderSize, 0.5 / renderSize, 1.0 - 0.5 / renderSize);
        float weight = float(3 - abs(x)) * float(3 - abs(y));
        sum += texture2D(worldTexture, sampleUv) * weight;
        weightSum += weight;
      }
    }
    vec4 blurred = sum / weightSum;
    // Target colours are premultiplied by coverage at the transparent sky edge.
    // Unpremultiply before the sky mix to avoid a dark fringe.
    return vec4(blurred.rgb / max(blurred.a, 0.00001), blurred.a);
  }
  void main() {
    vec2 uv = (floor(vUv * renderSize) + 0.5) / renderSize;
    vec4 world = focusedWorld(uv);
    vec3 sky = skyColor * mix(0.65, 1.0, uv.y);
    vec2 starCell = floor(uv * renderSize / 7.0);
    float hash = fract(sin(dot(starCell, vec2(127.1, 311.7))) * 43758.5453);
    vec2 starPixel = mod(floor(uv * renderSize), 7.0);
    if (hash > 0.93 && starPixel.x == 3.0 && starPixel.y == 3.0) sky += vec3(0.65, 0.72, 0.9) * night;
    float phase = mod(hour + 18.0, 24.0) / 12.0;
    bool sunUp = phase < 1.0;
    phase = fract(phase);
    vec2 body = vec2(0.9 - phase * 0.8, 0.81 + sin(phase * 3.14159265) * 0.12);
    vec2 delta = uv - body;
    delta.x *= renderSize.x / renderSize.y;
    if (length(delta) < 0.028) sky = sunUp ? vec3(1.0, 0.82, 0.48) : vec3(0.72, 0.81, 1.0);
    vec3 color = mix(sky, world.rgb, world.a);
    float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = max(mix(vec3(grey), color, saturation), vec3(0.0));
    // Optional tonal palette; continuous colour is the default.
    if (palette) color = floor(color * 7.0 + 0.5) / 7.0;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
