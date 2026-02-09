import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import Graph from './Graph';
import { ProcessedData } from '../types';

interface SceneProps {
  data: ProcessedData[];
  loading: boolean;
}

export default function Scene({ data, loading }: SceneProps) {
  const controlsRef = useRef<any>(null);

  return (
    <>
      {/* Updated camera position for a wider, more centered initial view matching the reference */}
      <PerspectiveCamera makeDefault position={[0, 5, 38]} fov={32} />
      <OrbitControls 
        ref={controlsRef}
        maxPolarAngle={Math.PI / 2 - 0.05} 
        minDistance={8} 
        maxDistance={80}
        enablePan={true}
        rotateSpeed={0.4}
        dampingFactor={0.05}
        target={[0, 5, 0]}
      />
      
      {/* Cinematic Lighting Rig */}
      <Environment preset="city" blur={1} background={false} />
      <ambientLight intensity={0.15} color="#0a1628" />
      
      {/* Key light — cool moonlight from above-right */}
      <directionalLight position={[12, 25, 8]} intensity={0.8} color="#b8d4f0" castShadow />
      
      {/* Fill light — warm accent from left */}
      <pointLight position={[-15, 12, -8]} intensity={0.4} color="#4466aa" />
      
      {/* Rim/accent lights — cinematic color contrast */}
      <pointLight position={[15, 8, 12]} intensity={0.3} color="#0066ff" />
      <pointLight position={[-8, 3, 10]} intensity={0.2} color="#6633cc" />
      
      {/* Upward bounce light for cloud illumination */}
      <pointLight position={[0, 0, 5]} intensity={0.3} color="#1a3366" />

      {/* Environment */}
      <Stars radius={120} depth={60} count={4000} factor={4} saturation={0.2} fade speed={0.8} />
      <fog attach="fog" args={['#030610', 15, 55]} />

      {/* Components */}
      <group position={[0, -2, 0]}> 
        <Graph data={data} loading={loading} />
        
        {/* Floor Reflective Surface */}
        <gridHelper args={[120, 60, '#0a1a33', '#040a15']} position={[0, 0.01, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[120, 120]} />
          <meshStandardMaterial 
            color="#040608" 
            roughness={0.05} 
            metalness={0.9}
            envMapIntensity={0.6}
          />
        </mesh>
      </group>
    </>
  );
}