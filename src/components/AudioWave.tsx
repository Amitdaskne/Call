import React, { useEffect, useRef } from 'react';

interface AudioWaveProps {
  isTalking: boolean;
  colorClass?: string; // Tailwind bg color class
  waveCount?: number;
}

export const AudioWave: React.FC<AudioWaveProps> = ({
  isTalking,
  colorClass = "bg-emerald-500",
  waveCount = 3
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      ctx.clearRect(0, 0, width, height);

      // We draw wave paths
      const wavesNum = isTalking ? waveCount : 1;
      const amplitude = isTalking ? 24 : 3;
      const frequency = isTalking ? 0.045 : 0.015;
      const speed = isTalking ? 0.15 : 0.02;

      ctx.save();
      // Setup colors based on colors classes
      const isGreen = colorClass.includes('emerald') || colorClass.includes('green');
      const isBlue = colorClass.includes('blue');
      const isRed = colorClass.includes('red');
      
      let baseColor = 'rgba(16, 185, 129, '; // DEFAULT Emerald
      if (isBlue) baseColor = 'rgba(59, 130, 246, ';
      if (isRed) baseColor = 'rgba(239, 68, 68, ';

      for (let i = 0; i < wavesNum; i++) {
        ctx.beginPath();
        
        // Vary wave characteristics per layer
        const waveOffset = i * (Math.PI / 2.5);
        const currentAmplitude = amplitude * (1 - i * 0.25);
        const currentFreq = frequency * (1 + i * 0.15);
        
        ctx.moveTo(0, height / 2);

        for (let x = 0; x < width; x++) {
          const y = (height / 2) + Math.sin(x * currentFreq + phase + waveOffset) * currentAmplitude;
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = `${baseColor}${0.7 - i * 0.2})`;
        ctx.lineWidth = 2.5 - i * 0.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      ctx.restore();
      
      phase += speed;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isTalking, colorClass, waveCount]);

  return (
    <div className="relative w-full h-32 flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full opacity-90" />
      {isTalking && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-24 h-24 rounded-full border-4 border-dashed border-emerald-500/20 animate-spin" style={{ animationDuration: '10s' }} />
          <div className="absolute w-20 h-20 rounded-full border-2 border-emerald-400/30 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
      )}
    </div>
  );
};
