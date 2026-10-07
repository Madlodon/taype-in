"use client";

import { useEffect, useState } from "react";
import { Arena, type TrackCar } from "@/components/arena";

// Aperçu de l'accueil : une course simulée dans un vrai stade du jeu, rejouée en boucle.
const LAP_MS = 12000;
const PAUSE_MS = 2000;
const RACERS = [
  { id: "you", name: "You", body: "octane", ball: "none", speed: .88, you: true },
  { id: "nova", name: "Nova", body: "fennec", ball: "gold", speed: 1, you: false },
  { id: "blitz", name: "Blitz", body: "dominus", ball: "glacier", speed: .76, you: false },
  { id: "echo", name: "Echo", body: "merc", ball: "emerald", speed: .64, you: false },
] as const;

export function battleCars(elapsed: number, youName: string): TrackCar[] {
  const lap = elapsed % (LAP_MS + PAUSE_MS);
  return RACERS.map((racer, lane) => ({
    lane,
    id: racer.id,
    name: racer.you ? youName : racer.name,
    progress: Math.min(1, lap / LAP_MS * racer.speed),
    you: racer.you,
    body: racer.body,
    ball: racer.ball,
  }));
}

export function HeroBattle({ youName }: { youName: string }) {
  // Instantané au milieu de la course : c'est aussi ce que voit un utilisateur qui réduit les animations.
  const [elapsed, setElapsed] = useState(LAP_MS * .55);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now() - LAP_MS * .55;
    let frame = requestAnimationFrame(function tick(now) {
      setElapsed(now - start);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return <Arena className="hero-battle" stadium="diorama" carScale={1.4} cars={battleCars(elapsed, youName)} />;
}
