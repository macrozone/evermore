export const DEFAULT_LOOK = {
  resolution: 1280,
  pixelSize: 1,
  fineness: 4 as 1 | 2 | 4 | 8,
  textures: true,
  ambient: 1.1,
  sunlight: 1.8,
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
  varying vec2 vUv;
  void main() {
    vec3 color = texture2D(worldTexture, vUv).rgb;
    float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = max(mix(vec3(grey), color, saturation), vec3(0.0));
    // Optional tonal palette; continuous colour is the default.
    if (palette) color = floor(color * 7.0 + 0.5) / 7.0;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
