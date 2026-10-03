export const DEFAULT_LOOK = {
  resolution: 720,
  pixelSize: 2,
  ambient: 1.2,
  sunlight: 2.4,
  shadows: true,
  softness: 3,
  saturation: 1.1,
  palette: false,
};
export type LookSettings = typeof DEFAULT_LOOK;

// Integer screen pixels keep the nearest-neighbour grid consistent at any DPR.
export function renderDimensions(width: number, height: number, settings: LookSettings) {
  const scale = Math.max(settings.pixelSize, Math.ceil(width / settings.resolution), 1);
  return { width: Math.max(1, Math.floor(width / scale)), height: Math.max(1, Math.floor(height / scale)) };
}

export const LOOK_FRAGMENT = `
  uniform sampler2D worldTexture;
  uniform float saturation;
  uniform bool palette;
  uniform vec3 skyColor;
  uniform float night;
  uniform float hour;
  uniform vec2 renderSize;
  varying vec2 vUv;
  void main() {
    vec2 uv = (floor(vUv * renderSize) + 0.5) / renderSize;
    vec4 world = texture2D(worldTexture, uv);
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
