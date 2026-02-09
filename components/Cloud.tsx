import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { Html } from '@react-three/drei';

interface CloudProps {
  position: [number, number, number];
  intensity: number; // 0 to 1
  active: boolean;
  rainValue: number; // mm
}

/**
 * SVG-filter cloud matching the reference code exactly.
 * Each cloud gets a unique filter id, unique seed, and intensity-driven shadow opacities.
 * Lightning glow fires for intensity > 0.55.
 */
export default function Cloud({ position, intensity, active, rainValue }: CloudProps) {
  const filterId = useRef(`cf-${Math.random().toString(36).slice(2, 9)}`);
  const seed = useRef(Math.floor(Math.random() * 9000) + 100);
  const lightningGlowRef = useRef<HTMLDivElement>(null);
  const lightningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shadow opacities driven by intensity (mirrors updateWeather in reference)
  const shadows = useMemo(() => {
    const t = intensity;
    return {
      s2: lerp(0.05, 0.4, t),
      s3: lerp(0.1, 0.4, t),
      s4: lerp(0.2, 0.6, t),
      s5: lerp(0.2, 0.7, t),
    };
  }, [intensity]);

  // Cloud size scales with intensity
  const cloudW = useMemo(() => 260 + intensity * 150, [intensity]);
  const cloudH = useMemo(() => 110 + intensity * 60, [intensity]);

  // Container size needs to be big enough for the filter overflow
  const containerW = cloudW * 2.6;
  const containerH = cloudH * 3.2;

  // --- Lightning ---
  const triggerLightning = useCallback(() => {
    const el = lightningGlowRef.current;
    if (!el) return;
    const rx = (Math.random() - 0.5) * cloudW * 0.5;
    const ry = Math.random() * cloudH * 0.25;
    el.style.setProperty('--lx', `${rx}px`);
    el.style.setProperty('--ly', `${ry}px`);
    el.classList.remove('hg-flash');
    void el.offsetWidth; // reflow
    el.classList.add('hg-flash');
    setTimeout(() => el.classList.remove('hg-flash'), 800);
  }, [cloudW, cloudH]);

  const scheduleLightning = useCallback(() => {
    const delay = 300 + Math.random() * 1200;
    lightningTimeout.current = setTimeout(() => {
      triggerLightning();
      scheduleLightning();
    }, delay);
  }, [triggerLightning]);

  useEffect(() => {
    if (!active) return;
    if (intensity > 0.55) {
      scheduleLightning();
    }
    return () => {
      if (lightningTimeout.current) clearTimeout(lightningTimeout.current);
    };
  }, [active, intensity, scheduleLightning]);

  if (!active) return null;

  return (
    <Html
      position={position}
      center
      distanceFactor={10}
      zIndexRange={[0, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          position: 'relative',
          width: `${containerW}px`,
          height: `${containerH}px`,
        }}
      >
        {/* SVG filter — exact replica of the reference filter chain */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', width: 0, height: 0 }}
        >
          <filter
            id={filterId.current}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            {/* Noise layers */}
            <feTurbulence type="fractalNoise" seed={seed.current} baseFrequency="0.011" numOctaves="5" result="noise1" />
            <feTurbulence type="fractalNoise" seed={seed.current} baseFrequency="0.011" numOctaves="2" result="noise2" />

            {/* Layer 1 — base cloud */}
            <feGaussianBlur in="SourceGraphic" stdDeviation="20" />
            <feDisplacementMap in="blur1" scale="100" in2="noise1" result="cloud1" />

            {/* Layer 2 — light highlight */}
            <feFlood floodColor="rgb(215,215,215)" floodOpacity={shadows.s2} />
            <feComposite operator="in" in2="SourceGraphic" />
            <feOffset dx="-10" dy="-3" />
            <feMorphology radius="20" />
            <feGaussianBlur stdDeviation="20" />
            <feDisplacementMap scale="100" in2="noise1" result="cloud2" />

            {/* Layer 3 — mid shadow */}
            <feFlood floodColor="rgb(66,105,146)" floodOpacity={shadows.s3} />
            <feComposite operator="in" in2="SourceGraphic" />
            <feOffset dx="-10" dy="40" />
            <feMorphology radius="0 40" />
            <feGaussianBlur stdDeviation="20" />
            <feDisplacementMap scale="80" in2="noise2" result="cloud3" />

            {/* Layer 4 — dark underbelly */}
            <feFlood floodColor="rgb(0,0,0)" floodOpacity={shadows.s4} />
            <feComposite operator="in" in2="SourceGraphic" />
            <feOffset dx="20" dy="60" />
            <feMorphology radius="0 65" />
            <feGaussianBlur stdDeviation="30" />
            <feDisplacementMap scale="100" in2="noise2" result="cloud4" />

            {/* Layer 5 — deep base */}
            <feFlood floodColor="rgb(0,0,0)" floodOpacity={shadows.s5} />
            <feComposite operator="in" in2="SourceGraphic" />
            <feOffset dx="20" dy="70" />
            <feMorphology radius="0 200" />
            <feGaussianBlur stdDeviation="30" />
            <feDisplacementMap scale="100" in2="noise2" result="cloud5" />

            <feMerge>
              <feMergeNode in="cloud1" />
              <feMergeNode in="cloud2" />
              <feMergeNode in="cloud3" />
              <feMergeNode in="cloud4" />
              <feMergeNode in="cloud5" />
            </feMerge>
          </filter>
        </svg>

        {/* Cloud container with filter applied (mirrors .cloud-container) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            filter: `url(#${filterId.current})`,
          }}
        >
          {/* The cloud shape itself (mirrors .cloud textarea) */}
          <div
            style={{
              width: `${cloudW}px`,
              height: `${cloudH}px`,
              background: '#fff',
              borderRadius: '50%',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>

        {/* Lightning glow (mirrors .lightning-glow) */}
        <div
          ref={lightningGlowRef}
          className="hg-lightning-glow"
          style={{
            position: 'absolute',
            top: '42%',
            left: '50%',
            width: `${containerW * 0.33}px`,
            height: `${containerH * 0.33}px`,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, white, rgba(255,255,255,0))',
            pointerEvents: 'none',
            opacity: 0,
            mixBlendMode: 'overlay',
            filter: 'blur(50px)',
            transform: 'translate(calc(-50% + var(--lx, 0px)), calc(-50% + var(--ly, 0px)))',
          }}
        />
      </div>
    </Html>
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
