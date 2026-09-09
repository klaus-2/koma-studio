"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Line as DreiLine } from "@react-three/drei";
import * as THREE from "three";

function createParticlePositions(count: number) {
  let seed = 42;

  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const arr = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    arr[i * 3] = (random() - 0.5) * 20;
    arr[i * 3 + 1] = (random() - 0.5) * 12;
    arr[i * 3 + 2] = (random() - 0.5) * 10;
  }

  return arr;
}

function FloatingOrb({
  position,
  color,
  speed,
  distort,
  size,
}: {
  position: [number, number, number];
  color: string;
  speed: number;
  distort: number;
  size: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * speed * 0.3;
      meshRef.current.rotation.y = state.clock.elapsedTime * speed * 0.2;
    }
  });

  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={0.8}>
      <mesh ref={meshRef} position={position}>
        <icosahedronGeometry args={[size, 4]} />
        <MeshDistortMaterial
          color={color}
          transparent
          opacity={0.15}
          distort={distort}
          speed={speed * 2}
          roughness={0.2}
        />
      </mesh>
    </Float>
  );
}

function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null!);
  const count = 120;

  const positions = useMemo(() => createParticlePositions(count), [count]);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
      pointsRef.current.rotation.x = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#a855f7"
        size={0.03}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function MangaGrid() {
  const linesRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (linesRef.current) {
      linesRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.1) * 0.02;
    }
  });

  const lines = useMemo(() => {
    const result: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];
    for (let i = -5; i <= 5; i++) {
      result.push({
        start: new THREE.Vector3(i * 2, -6, -2),
        end: new THREE.Vector3(i * 2, 6, -2),
      });
      result.push({
        start: new THREE.Vector3(-10, i * 1.2, -2),
        end: new THREE.Vector3(10, i * 1.2, -2),
      });
    }
    return result;
  }, []);

  return (
    <group ref={linesRef}>
      {lines.map((line, i) => {
        return (
          <DreiLine
            key={i}
            points={[line.start, line.end]}
            color="#a855f7"
            transparent
            opacity={0.04}
            lineWidth={1}
          />
        );
      })}
    </group>
  );
}

export function MangaScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} color="#a855f7" />
        <directionalLight position={[-5, -3, 3]} intensity={0.3} color="#06b6d4" />

        <FloatingOrb
          position={[-4, 2, -3]}
          color="#a855f7"
          speed={1.2}
          distort={0.4}
          size={1.8}
        />
        <FloatingOrb
          position={[4, -1.5, -4]}
          color="#06b6d4"
          speed={0.8}
          distort={0.3}
          size={1.4}
        />
        <FloatingOrb
          position={[0, 3, -5]}
          color="#7c3aed"
          speed={1}
          distort={0.5}
          size={1}
        />

        <ParticleField />
        <MangaGrid />
      </Canvas>
    </div>
  );
}
