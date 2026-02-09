import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RainProps {
  count: number;
  active: boolean;
}

// Background rain that provides atmosphere but doesn't interact with data
export default function AmbientRain({ count, active }: RainProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Wind simulation matching CloudRain
  const windX = -0.04;
  const windZ = 0.01;

  // Distribute rain widely
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
        // Wider spread for ambient
      const x = (Math.random() - 0.5) * 60;
      const y = Math.random() * 40;
      const z = (Math.random() - 0.5) * 60;
      const speed = 0.5 + Math.random() * 0.5;
      const len = 1.0 + Math.random() * 0.4;
      temp.push({ x, y, z, speed, len });
    }
    return temp;
  }, [count]);

  const dummy = new THREE.Object3D();

  useFrame((state, delta) => {
    if (!meshRef.current || !active) return;

    particles.forEach((particle, i) => {
      particle.y -= particle.speed;
      particle.x += windX;
      particle.z += windZ;

      if (particle.y < -5) {
        particle.y = 40;
        // Re-randomize horizontal position to keep rain "everywhere"
        particle.x = (Math.random() - 0.5) * 60;
        particle.z = (Math.random() - 0.5) * 60;
      }

      dummy.position.set(particle.x, particle.y, particle.z);
      
      // Tilt to match wind direction
      const angleZ = -Math.atan2(windX, particle.speed);
      const angleX = Math.atan2(windZ, particle.speed);
      dummy.rotation.set(angleX, 0, angleZ);
      
      dummy.scale.set(1, particle.len, 1);
      
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current!.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} visible={active}>
      {/* Thicker, Brighter Ambient Rain */}
      <boxGeometry args={[0.02, 1.6, 0.02]} /> 
      <meshBasicMaterial 
        color="#88ccff" 
        transparent 
        opacity={0.45} 
        blending={THREE.AdditiveBlending} 
        depthWrite={false} 
      />
    </instancedMesh>
  );
}