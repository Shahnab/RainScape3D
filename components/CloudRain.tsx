import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CloudRainProps {
  position: [number, number, number];
  intensity: number; // 0 to 1, derived from rainValue
  active: boolean;
}

export default function CloudRain({ position, intensity, active }: CloudRainProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [cloudX, cloudY, cloudZ] = position;
  
  // Max particles per cloud - increased for density and realism
  const MAX_PARTICLES = 1500;

  // Wind settings for realistic slant
  const windX = -0.04;
  const windZ = 0.01;

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
        // Initial spread
      const x = (Math.random() - 0.5) * 3.5;
      // Distribute vertically to prevent "waves" of rain starting together
      const y = -Math.random() * 20; 
      const z = (Math.random() - 0.5) * 2.5;
      // Vary speed for depth
      const speed = 0.2 + Math.random() * 0.4;
      // Randomize streak length slightly
      const len = 0.8 + Math.random() * 0.4;
      temp.push({ x, y, z, speed, len });
    }
    return temp;
  }, []); // Empty deps so we don't reset rain when cloud moves

  const dummy = new THREE.Object3D();

  useFrame(() => {
    if (!meshRef.current) return;

    // Number of active particles based on intensity
    const activeCount = active ? Math.floor(intensity * MAX_PARTICLES) : 0;

    particles.forEach((particle, i) => {
      // Move down and apply wind
      particle.y -= particle.speed;
      particle.x += windX;
      particle.z += windZ;

      // Check floor collision (approx y=0) in world space
      // absY = cloudY + particle.y
      if ((cloudY + particle.y) < 0) {
        particle.y = 0; // Reset to cloud height (relative 0)
        // Re-randomize horizontal position within cloud bounds to avoid patterns
        particle.x = (Math.random() - 0.5) * 3.0;
        particle.z = (Math.random() - 0.5) * 2.0;
      }

      if (i < activeCount) {
        dummy.position.set(cloudX + particle.x, cloudY + particle.y, cloudZ + particle.z);
        
        // Stretch the drop based on speed/randomness
        dummy.scale.set(1, particle.len, 1);

        // Rotate to match the velocity vector (slant)
        // V = (windX, -speed, windZ)
        const angleZ = -Math.atan2(windX, particle.speed);
        const angleX = Math.atan2(windZ, particle.speed);
        dummy.rotation.set(angleX, 0, angleZ);
      } else {
        dummy.scale.set(0, 0, 0);
      }
      
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      {/* Enhanced Rain Streaks */}
      <boxGeometry args={[0.02, 1.0, 0.02]} /> 
      <meshBasicMaterial 
        color="#cceeff" 
        transparent 
        opacity={0.7} 
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
