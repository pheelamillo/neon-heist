import Image from "next/image";

export function CinematicScene({ priority = false }: { priority?: boolean }) {
  return <div className="cinematic-scene"><Image src="/art/neon-operative-hero.webp" alt="A hooded hacker overlooks New Eden, a rain-soaked city lit by teal and amber neon" fill sizes="(max-width: 850px) 100vw, 750px" preload={priority}/><div className="scene-overlay"/><div className="scene-caption"><span className="status-dot"/><span>OPERATIVE / NEW EDEN</span><span>OFF THE GRID</span></div></div>;
}
