import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, Environment, ContactShadows } from '@react-three/drei';

interface PieceProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  label: string;
}

const TimberPiece = ({ position, size, color, label }: PieceProps) => {
  const [hovered, setHovered] = useState(false);
  
  return (
    <group position={position}>
      <mesh 
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial 
          color={hovered ? '#fbbf24' : color} 
          roughness={0.4} 
          metalness={0.1}
        />
      </mesh>
      {hovered && (
        <Text
          position={[0, size[1] / 2 + 0.3, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          backgroundColor="#1e293b"
          padding={0.1}
        >
          {label}
        </Text>
      )}
    </group>
  );
};

interface ThreeDCuttingViewProps {
  bin: {
    length: number;
    used: number[];
    waste: number;
  };
}

export const ThreeDCuttingView: React.FC<ThreeDCuttingViewProps> = ({ bin }) => {
  const totalLength = bin.length;

  return (
    <div className="w-full h-48 bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800 group relative">
      <div className="absolute top-2 left-2 z-10 bg-slate-800/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-slate-300 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        DRAG TO ROTATE • HOVER PIECES
      </div>
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 2, 6]} fov={45} />
        <OrbitControls enableZoom={false} autoRotate={false} makeDefault />
        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />

        <group rotation={[0.2, -0.4, 0]}>
          {bin.used.map((len, i) => {
            const pieceWidth = len;
            // Calculate position based on previous pieces
            const previousWidths = bin.used.slice(0, i).reduce((sum, curr) => sum + curr, 0);
            const pos = (-totalLength / 2) + previousWidths + pieceWidth / 2;
            
            return (
              <TimberPiece
                key={i}
                position={[pos, 0, 0]}
                size={[pieceWidth, 0.4, 0.4]}
                color={i % 2 === 0 ? '#8b5cf6' : '#3b82f6'}
                label={`${len}m Piece`}
              />
            );
          })}
          
          {/* Waste */}
          {bin.waste > 0 && (
            <TimberPiece
              position={[(-totalLength / 2) + bin.used.reduce((sum, curr) => sum + curr, 0) + bin.waste / 2, 0, 0]}
              size={[bin.waste, 0.4, 0.4]}
              color="#475569"
              label={`Waste: ${bin.waste.toFixed(2)}m`}
            />
          )}
        </group>

        <ContactShadows position={[0, -0.3, 0]} opacity={0.6} scale={15} blur={2.5} far={4.5} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};
