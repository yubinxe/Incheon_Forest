import * as THREE from "three";

const NOISE = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 6; i++){ v += a * noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
  float cloud(vec2 w, float t, float cover){
    vec2 p = w * 0.00042 + vec2(t * 0.0045, t * 0.0018);
    float n = fbm(p) * 0.75 + fbm(p * 2.7 - t * 0.002) * 0.25;
    return smoothstep(1.0 - cover, 1.0 - cover + 0.32, n);
  }
`;

/** 적운층 — 높은 고도의 큰 평면에 흐르는 구름. 태양 쪽 가장자리는 밝게, 밤에는 어둡게 */
export function buildClouds() {
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color("#fff1dc") },
    uSky: { value: new THREE.Color("#c9ced6") },
    uNight: { value: 0 },
    uCover: { value: 0.42 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform float uNight; uniform float uCover;
      varying vec3 vW;
      ${NOISE}
      void main(){
        float d = cloud(vW.xz, uTime, uCover);
        float dn = cloud(vW.xz + uSunDir.xz * 260.0, uTime, uCover);
        float lit = clamp(1.0 - (dn - d) * 1.6, 0.0, 1.0);
        vec3 shadowCol = mix(uSky * 0.62, vec3(0.42, 0.44, 0.5), 0.5);
        vec3 col = mix(shadowCol, uSunCol * 1.15 + 0.1, lit * clamp(uSunDir.y * 4.0 + 0.35, 0.0, 1.0));
        col = mix(col, vec3(0.05, 0.07, 0.11), uNight);
        float r = length(vW.xz - cameraPosition.xz);
        vec3 vd = normalize(vW - cameraPosition);
        // 지평선 쪽 원거리 구름은 패턴이 뭉개져 회색 막처럼 보이므로 시야 고도각으로 걷어낸다
        float fade = (1.0 - smoothstep(5000.0, 9000.0, r)) * smoothstep(0.08, 0.22, vd.y);
        gl_FragColor = vec4(col, d * 0.92 * fade);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(26000, 26000, 1, 1), mat);
  mesh.rotation.x = Math.PI / 2; // 아래에서 올려다보이도록 뒤집음
  mesh.position.y = 1250;
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/** 구름 그림자 — 지면 위에 같은 패턴을 곱해 그림자가 도시 위를 흘러가게 한다 */
export function buildCloudShadows() {
  const uniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uStrength: { value: 0.3 }, uCover: { value: 0.42 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.MultiplyBlending,
    premultipliedAlpha: true,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSunDir; uniform float uStrength; uniform float uCover;
      varying vec3 vW;
      ${NOISE}
      void main(){
        // 구름층(고도 1900)에서 태양 방향으로 투영한 지점
        vec2 p = vW.xz + uSunDir.xz / max(uSunDir.y, 0.08) * 1250.0;
        float d = cloud(p, uTime, uCover);
        float k = 1.0 - d * uStrength;
        gl_FragColor = vec4(vec3(k), 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.95, 0);
  mesh.renderOrder = 1;
  return { mesh, uniforms };
}

/** 수목 흔들림 — 인스턴스 위치마다 위상을 달리한 바람 */
export function addWind(mat: THREE.Material, time: { value: number }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          float ph = ip.x * 0.05 + ip.z * 0.07;
          float h = clamp(position.y + 1.2, 0.0, 2.2);
          float gust = 0.6 + 0.4 * sin(uWind * 0.37 + ip.x * 0.004);
          transformed.x += sin(uWind * 1.7 + ph) * 0.07 * h * gust;
          transformed.z += cos(uWind * 1.3 + ph * 1.3) * 0.05 * h * gust;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => "wind";
}
