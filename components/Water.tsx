import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Updated Shader with Slosh/Tilt uniform
const vertexShader = `
  uniform float uTime;
  uniform float uBigWavesElevation;
  uniform vec2 uBigWavesFrequency;
  uniform float uBigWavesSpeed;
  uniform vec2 uTilt; // Physics tilt (x, z)

  varying float vElevation;
  varying vec2 vUv;

  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  
  // Fade function defined before usage in cnoise
  vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

  float cnoise(vec3 P){
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.y, Pi0.y, Pi1.y, Pi1.y);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) * 1.0 / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) * 1.0 / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g101, g101), dot(g011, g011), dot(g111, g111)));
    g001 *= norm1.x;
    g101 *= norm1.y;
    g011 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n010 = dot(g010, vec3(Pf0.x, Pf0.y, Pf1.z));
    float n110 = dot(g110, vec3(Pf0.x, Pf1.y, Pf1.z));
    float n001 = dot(g001, vec3(Pf1.x, Pf0.y, Pf0.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf1.y, Pf0.z));
    float n011 = dot(g011, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
    return 2.2 * n_xyz;
  }

  void main() {
    vUv = uv;
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    // Apply physics slosh tilt
    // The further from center, the more the tilt affects y
    float tiltEffect = (modelPosition.x * uTilt.x) + (modelPosition.z * uTilt.y);
    modelPosition.y += tiltEffect;

    // Basic wave
    float elevation = sin(modelPosition.x * uBigWavesFrequency.x + uTime * uBigWavesSpeed) * 
                      sin(modelPosition.z * uBigWavesFrequency.y + uTime * uBigWavesSpeed) * 
                      uBigWavesElevation;

    // Add noise
    float noise = cnoise(vec3(modelPosition.xz * 3.0, uTime * 0.5));
    elevation += noise * 0.15;

    modelPosition.y += elevation;

    vElevation = elevation + tiltEffect; // Pass total elevation for color mix
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uDepthColor;
  uniform vec3 uSurfaceColor;
  uniform float uColorOffset;
  uniform float uColorMultiplier;

  varying float vElevation;

  void main() {
    float mixStrength = (vElevation + uColorOffset) * uColorMultiplier;
    vec3 color = mix(uDepthColor, uSurfaceColor, mixStrength);
    
    // Add foam/highlight
    float highlight = step(0.1, vElevation);
    color += vec3(0.15) * highlight;

    gl_FragColor = vec4(color, 0.95);
  }
`;

export default function Water() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();

  // Physics state for sloshing
  const physics = useRef({
    velocity: new THREE.Vector2(0, 0),
    position: new THREE.Vector2(0, 0), // The "tilt" of the water
    lastCameraPos: new THREE.Vector3().copy(camera.position)
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBigWavesElevation: { value: 0.1 },
      uBigWavesFrequency: { value: new THREE.Vector2(0.5, 0.3) },
      uBigWavesSpeed: { value: 0.75 },
      uDepthColor: { value: new THREE.Color('#000f1f') },
      uSurfaceColor: { value: new THREE.Color('#0055aa') },
      uColorOffset: { value: 0.2 },
      uColorMultiplier: { value: 3.0 },
      uTilt: { value: new THREE.Vector2(0, 0) }
    }),
    []
  );

  useFrame((state, delta) => {
    if (!materialRef.current) return;

    // 1. Calculate camera acceleration/movement to drive physics
    const currentCameraPos = camera.position;
    const movement = new THREE.Vector3().subVectors(currentCameraPos, physics.current.lastCameraPos);
    
    // We care about X and Z movement (horizontal) inducing slosh
    // Reverse direction: if camera moves left, water sloshes right relative to view? 
    // Actually, if you rotate the "cup" (camera orbit), the water lags behind.
    // Simplifying: Camera movement adds velocity to the water tilt.
    const forceX = movement.x * 2.0; 
    const forceZ = movement.z * 2.0;

    // 2. Spring Physics (Hooke's Law + Damping)
    const tension = 3.0;
    const damping = 0.96;

    // Acceleration = -Tension * Position - Damping * Velocity + ExternalForce
    const accelX = -tension * physics.current.position.x - (1.0 - damping) * physics.current.velocity.x + forceX;
    const accelY = -tension * physics.current.position.y - (1.0 - damping) * physics.current.velocity.y + forceZ;

    physics.current.velocity.x += accelX * delta;
    physics.current.velocity.y += accelY * delta;

    physics.current.position.x += physics.current.velocity.x * delta;
    physics.current.position.y += physics.current.velocity.y * delta;

    // 3. Update Uniforms
    materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    materialRef.current.uniforms.uTilt.value.set(
      physics.current.position.x, 
      physics.current.position.y
    );

    // Update last camera pos
    physics.current.lastCameraPos.copy(currentCameraPos);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      {/* Increased segment count for smoother waves */}
      <planeGeometry args={[40, 40, 256, 256]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}