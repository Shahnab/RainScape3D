import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Html, Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { ProcessedData } from '../types';
import Cloud from './Cloud';

interface GraphProps {
  data: ProcessedData[];
  loading: boolean;
}

// --- SHADERS FOR MORE REALISTIC WATER GRAPH ---
const graphWaterVertexShader = `
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;

  // Simple noise for displacement
  float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
  float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Organic wave on Z axis
    float wave = sin(pos.x * 1.5 + uTime * 0.8) * 0.15;
    // Add detailed noise
    float n = noise(vec2(pos.x * 2.0 + uTime * 0.4, pos.y * 1.0));
    pos.z += wave + n * 0.1;

    vPosition = pos;
    vElevation = pos.y; // Used for gradients

    // Approximate normal for lighting
    vNormal = normalize(vec3(
        -0.2 * cos(pos.x * 1.5 + uTime * 0.8), // dx
        0.0,                                   // dy
        1.0                                    // dz
    ));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const graphWaterFragmentShader = `
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  
  float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
  float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    // Swimming Pool Palette
    vec3 deepColor = vec3(0.0, 0.35, 0.8);
    vec3 midColor = vec3(0.0, 0.6, 0.9);
    vec3 shallowColor = vec3(0.3, 0.8, 1.0);
    vec3 foamColor = vec3(0.95, 1.0, 1.0);

    float heightPct = smoothstep(0.0, 9.0, vElevation);
    
    // Vibrant Gradient
    vec3 color = mix(deepColor, midColor, smoothstep(0.0, 0.55, heightPct));
    color = mix(color, shallowColor, smoothstep(0.55, 1.0, heightPct));

    // Swimming Pool Caustics Animation
    // Lower scaling for larger, more visible caustic patterns
    vec2 st = vUv * vec2(15.0, 4.0);
    float t = uTime * 1.2;
    
    // UV Distortion for fluid movement
    vec2 pos = vUv * vec2(10.0, 2.0);
    float distortion = sin(pos.y * 5.0 + t) * 0.05 + sin(pos.x * 5.0 + t * 0.5) * 0.05;
    
    // Apply distortion to the noise lookup coordinates
    st += distortion;
    
    // Intersecting wave patterns to create "web" look
    // Using widely different angles/speeds for chaotic water feel
    float w1 = noise(st + vec2(t * 0.4, t * 0.7));
    float w2 = noise(st * 0.8 + vec2(-t * 0.5, t * 0.4));
    float w3 = noise(st * 1.2 - vec2(t * 0.3, -t * 0.6));
    
    // Combine waves
    float wave = w1 + w2 + w3;
    
    // Sharpen waves into caustic lines - High contrast
    float caustic = smoothstep(1.3, 1.8, wave * 1.2);
    
    // Second layer of smaller details for depth
    float w4 = noise(st * 2.5 + t);
    float smallCaustics = smoothstep(0.4, 0.6, w4) * 0.5;
    
    // Combine caustics
    float finalCaustic = caustic + smallCaustics * caustic;
    
    // Add refractive brightness - bright cyan/white lines
    color += vec3(0.5, 0.9, 1.0) * finalCaustic * 0.6;

    // Specular Highlight for wet surface look
    vec3 lightDir = normalize(vec3(0.5, 1.0, 1.0));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 norm = normalize(vNormal + vec3(w1*0.3, w2*0.3, 0.0));
    
    float diff = max(dot(norm, lightDir), 0.0);
    float spec = pow(max(dot(reflect(-lightDir, norm), viewDir), 0.0), 24.0);
    
    color += vec3(1.0) * spec * 0.5;
    
    // Glowing Top Edge (Foam/Surface Tension)
    float topEdge = smoothstep(0.95, 1.0, vUv.y);
    float foamNoise = noise(vec2(vUv.x * 40.0 + uTime * 2.0, vUv.y));
    
    // Mix foam at the very top
    color = mix(color, foamColor, topEdge * (0.6 + foamNoise * 0.4));
    
    // Fresnel-ish rim
    float rim = pow(vUv.y, 3.0) * 0.2;
    color += vec3(0.4, 0.7, 1.0) * rim;

    // Opacity
    float alpha = smoothstep(-0.05, 0.1, vUv.y) * 0.92 + 0.08;

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function Graph({ data, loading }: GraphProps) {
  const { invalidate } = useThree();
  // State
  const [currentHeights, setCurrentHeights] = useState<number[]>([]);
  const [finished, setFinished] = useState<boolean[]>([]);
  
  // Refs
  const heightsRef = useRef<number[]>([]);
  const lineRef = useRef<THREE.Line>(null);
  const areaRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Rain System
  const rainMeshRef = useRef<THREE.InstancedMesh>(null);
  const splashMeshRef = useRef<THREE.InstancedMesh>(null);
  
  // Memoize uniforms to prevent re-instantiation
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);
  
  // Max drops allocatable per column (buffer size)
  const maxDropsPerCol = 60;
  const totalDrops = data.length * maxDropsPerCol;
  
  useEffect(() => {
    if (data.length > 0) {
      const zeros = new Array(data.length).fill(0);
      heightsRef.current = [...zeros];
      setCurrentHeights([...zeros]);
      setFinished(new Array(data.length).fill(false));
    }
  }, [data]);

  const maxVal = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);
  const widthPerPoint = 2;
  const startX = useMemo(() => -((data.length - 1) * widthPerPoint) / 2, [data]);

  // Rain Particle Initialization with Data-Driven Intensity
  const rainParticles = useMemo(() => {
    const parts = [];
    for (let i = 0; i < data.length; i++) {
      // Calculate intensity for this column (0 to 1)
      const intensity = data[i].value / maxVal;
      // Active drops scale with intensity — more rain = denser curtain
      const activeCount = data[i].value === 0 ? 0 : Math.floor(4 + intensity * (maxDropsPerCol - 4));
      // Reduced speed scaling for heavy rain so it doesn't look chaotic
      const speedBase = 0.4 + intensity * 0.2;

      for (let j = 0; j < maxDropsPerCol; j++) {
        parts.push({
          colIndex: i,
          xOffset: (Math.random() - 0.5) * 1.6, 
          zOffset: (Math.random() - 0.5) * 0.8,
          // Start distributed below cloud level (13)
          y: Math.random() * 12.5,
          baseSpeed: speedBase + Math.random() * 0.4,
          active: j < activeCount,
          originalActive: j < activeCount 
        });
      }
    }
    return parts;
  }, [data, maxVal]);

  const segments = 200; // Curve resolution

  useFrame((state, delta) => {    
    // Ensure the loop continues even if OrbitControls is static
    invalidate();    if (loading || data.length === 0) return;

    if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }

    let needsUpdate = false;
    const newFinished = [...finished];

    // 1. Grow Columns
    data.forEach((d, i) => {
      const targetHeight = (d.value / maxVal) * 8; 
      
      if (heightsRef.current[i] < targetHeight) {
        // Growth proportional to rain intensity (value)
        const growthRate = (targetHeight + 0.5) * delta * 0.5; 
        heightsRef.current[i] = Math.min(targetHeight, heightsRef.current[i] + growthRate);
        needsUpdate = true;
      } else if (!finished[i]) {
        newFinished[i] = true;
      }
    });

    // 2. Curve Generation
    const points = data.map((_, i) => new THREE.Vector3(
        startX + i * widthPerPoint, 
        Math.max(0.05, heightsRef.current[i]), 
        0
    ));
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
    
    // 3. Update Line
    if (lineRef.current) {
        const curvePoints = curve.getPoints(segments);
        lineRef.current.geometry.setFromPoints(curvePoints);
    }

    // 4. Update Area Geometry (Water Body)
    if (areaRef.current) {
        const geo = areaRef.current.geometry;
        const positions = geo.attributes.position.array as Float32Array;
        const sampled = curve.getSpacedPoints(segments); 
        
        if (sampled.length >= segments + 1) {
            for (let i = 0; i <= segments; i++) {
                const v3 = sampled[i];
                if (!v3) continue;

                // Top Row
                const topIdx = i * 3;
                positions[topIdx + 0] = v3.x;
                positions[topIdx + 1] = v3.y;
                positions[topIdx + 2] = v3.z;

                // Bottom Row - Fixed at 0 (Ground)
                const botIdx = (segments + 1 + i) * 3;
                positions[botIdx + 0] = v3.x;
                positions[botIdx + 1] = 0; 
                positions[botIdx + 2] = v3.z;
            }
            geo.attributes.position.needsUpdate = true;
        }
    }

    // 5. Update Rain & Splashes
    if (rainMeshRef.current && splashMeshRef.current) {
        const dummy = new THREE.Object3D();
        const splashDummy = new THREE.Object3D();
        let splashIndex = 0;
        
        // Calculate curve width for precise mapping
        const totalGraphWidth = (data.length - 1) * widthPerPoint;

        rainParticles.forEach((p, idx) => {
            // Calculate exact position
            const particleX = startX + p.colIndex * widthPerPoint + p.xOffset;
            
            // Calculate boundary height at this X position using the curve
            let boundaryH = 0;
            if (totalGraphWidth > 0 && curve) {
                 const u = Math.max(0, Math.min(1, (particleX - startX) / totalGraphWidth));
                 // Use getPoint(u) (interpolated) to find surface height
                 boundaryH = curve.getPoint(u).y;
            } else {
                 boundaryH = heightsRef.current[p.colIndex];
            }
            
            // Continuous rain
            if (p.originalActive) {
               p.active = true;
            }

            if (p.active) {
                const moveSpeed = p.baseSpeed * (delta * 60);
                p.y -= moveSpeed;
                
                // Rain drop geometry logic for collision
                // Geometry height is 0.65
                const scaleY = 1 + p.baseSpeed * 2;
                const halfLen = (0.65 * scaleY) / 2;
                
                // Reset if the bottom tip hits the curve/surface
                if (p.y - halfLen <= boundaryH) {
                   p.y = 12.5 - Math.random() * 0.5;
                   
                   // Splash at intersection
                   splashDummy.position.set(particleX, boundaryH, p.zOffset);
                   const scale = Math.random() * 0.5 + 0.3;
                   splashDummy.scale.set(scale, scale, scale);
                   splashDummy.lookAt(particleX, boundaryH + 1, p.zOffset + (Math.random()-0.5));
                   splashDummy.updateMatrix();
                   splashMeshRef.current!.setMatrixAt(splashIndex++, splashDummy.matrix);
                }
                
                dummy.position.set(particleX, p.y, p.zOffset);
                dummy.scale.set(1, scaleY, 1);
                dummy.updateMatrix();
                rainMeshRef.current!.setMatrixAt(idx, dummy.matrix);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                rainMeshRef.current!.setMatrixAt(idx, dummy.matrix);
            }
        });
        
        // Clear unused splashes
        for (let i = splashIndex; i < totalDrops; i++) {
            splashDummy.scale.set(0,0,0);
            splashDummy.updateMatrix();
            splashMeshRef.current.setMatrixAt(i, splashDummy.matrix);
        }

        rainMeshRef.current.instanceMatrix.needsUpdate = true;
        splashMeshRef.current.instanceMatrix.needsUpdate = true;
        splashMeshRef.current.count = splashIndex;
    }
  });

  if (data.length === 0) return null;

  return (
    <group>
      {/* 1. Luminous Top Line */}
      <line ref={lineRef}>
        <bufferGeometry />
        <lineBasicMaterial color="#c0e8ff" linewidth={3} opacity={1} transparent />
      </line>

      {/* 2. Holographic Water Body */}
      <mesh ref={areaRef}>
        {/* We use PlaneGeometry(width, height, segW, segH) 
            segments X = segments variable. segments Y = 1. */}
        <planeGeometry args={[1, 1, segments, 1]} /> 
        <shaderMaterial
            ref={materialRef}
            vertexShader={graphWaterVertexShader}
            fragmentShader={graphWaterFragmentShader}
            uniforms={uniforms}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false} // For proper transparency blending
        />
      </mesh>

      {/* 3. Rain - Streaks - Enhanced Visibility */}
      <instancedMesh ref={rainMeshRef} args={[undefined, undefined, totalDrops]}>
        <boxGeometry args={[0.02, 0.65, 0.02]} />
        <meshBasicMaterial color="#ddeeff" transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* 4. Splashes - Particles */}
      <instancedMesh ref={splashMeshRef} args={[undefined, undefined, totalDrops]}>
        <ringGeometry args={[0.03, 0.08, 8]} />
        <meshBasicMaterial color="#aaccff" transparent opacity={0.7} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>

      {/* 5. Labels & Anchors */}
      {data.map((item, i) => (
         <LabelMarker 
            key={i} 
            index={i} 
            positionX={startX + i * widthPerPoint} 
            heightRef={heightsRef} 
            text={`${item.value}mm`} 
            day={item.label}
        />
      ))}
      
      {/* 6. Clouds - Only for data points with value > 0 */}
      {data.map((item, i) => {
        if (item.value === 0) return null;
        
        const intensity = item.value / maxVal;
        const cloudHeight = 13;
        
        return (
          <Cloud
            key={`cloud-${i}`}
            position={[startX + i * widthPerPoint, cloudHeight, 0]}
            intensity={intensity}
            active={true}
            rainValue={item.value}
          />
        );
      })}

      {/* 7. Rain column glow beams — vertical light shafts under clouds */}
      {data.map((item, i) => {
        if (item.value === 0) return null;
        const intensity = item.value / maxVal;
        const targetH = (item.value / maxVal) * 8;
        const beamHeight = 13 - targetH;
        return (
          <mesh
            key={`beam-${i}`}
            position={[startX + i * widthPerPoint, targetH + beamHeight / 2, 0]}
          >
            <planeGeometry args={[0.6 + intensity * 1.0, beamHeight]} />
            <meshBasicMaterial
              color={new THREE.Color(0.15, 0.35, 0.7)}
              transparent
              opacity={0.02 + intensity * 0.04}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
      
      {/* Base markers on floor */}
      {data.map((item, i) => (
          <group key={`base-${i}`}>
              <mesh position={[startX + i * widthPerPoint, 0.01, 0]} rotation={[-Math.PI/2,0,0]}>
                  <ringGeometry args={[0.12, 0.18, 24]} />
                  <meshBasicMaterial color="#2266cc" opacity={0.4} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>
              {/* Vertical reference line */}
              {item.value > 0 && (
                  <mesh position={[startX + i * widthPerPoint, 0.01, 0]} rotation={[-Math.PI/2,0,0]}>
                      <ringGeometry args={[0.2, 0.3, 24]} />
                      <meshBasicMaterial color="#1144aa" opacity={0.15} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
                  </mesh>
              )}
          </group>
      ))}
    </group>
  );
}

const LabelMarker = ({ index, positionX, heightRef, text, day }: any) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame(() => {
        if (groupRef.current) {
            const h = heightRef.current[index];
            groupRef.current.position.set(positionX, h + 0.5, 0);
            groupRef.current.visible = h > 0.05;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Glowing data point */}
            <mesh position={[0, -0.25, 0]}>
                <sphereGeometry args={[0.07, 12, 8]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
                <pointLight intensity={0.8} distance={3} color="#4499ff" />
            </mesh>
            {/* Outer halo */}
            <mesh position={[0, -0.25, 0]}>
                <sphereGeometry args={[0.15, 12, 8]} />
                <meshBasicMaterial
                    color="#4488ff"
                    transparent
                    opacity={0.15}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
            <Html center transform position={[0, 0.35, 0]} sprite>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}>
                    <span style={{
                        fontSize: '13px',
                        color: 'white',
                        fontWeight: 700,
                        fontFamily: '"SF Mono", "Fira Code", monospace',
                        textShadow: '0 0 8px rgba(68,153,255,0.9), 0 0 20px rgba(68,153,255,0.4)',
                        letterSpacing: '0.03em',
                    }}>{text}</span>
                    <span style={{
                        fontSize: '9px',
                        color: 'rgba(140,190,255,0.8)',
                        fontFamily: 'system-ui, sans-serif',
                        letterSpacing: '0.15em',
                        marginTop: '3px',
                        textTransform: 'uppercase',
                    }}>{day}</span>
                </div>
            </Html>
        </group>
    )
}
