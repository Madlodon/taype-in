import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Arena, type TrackCar } from "../../components/arena";
import { SpriteStyle } from "./arena-preview-car";

const PROMPT = "Le ballon file vers le but adverse. Chaque mot tapé sans faute donne un coup de boost à ta voiture.";
const PLAYERS: TrackCar[] = [
  { id: "preview", name: "Toi", progress: 0, you: true },
  { id: "maya", name: "Maya", progress: 0, you: false },
  { id: "leo", name: "Léo", progress: 0, you: false },
  { id: "zoe", name: "Zoé", progress: 0, you: false },
];

function Preview() {
  const [sprites, setSprites] = useState(true);
  const [typed, setTyped] = useState("");
  const [boosts, setBoosts] = useState<Record<string, number>>({});
  const [shots, setShots] = useState<Record<string, { sequence: number; scored: boolean; receivedAt: number }>>({});
  const [round, setRound] = useState(0);
  let correct = 0;
  while (correct < typed.length && typed[correct] === PROMPT[correct]) correct++;
  const progress = correct / PROMPT.length;
  const cars = PLAYERS.map(car => car.you ? { ...car, progress } : car);
  function shoot(scored: boolean) {
    setShots(previous => ({ ...previous, preview: {
      sequence: (previous.preview?.sequence ?? 0) + 1, scored, receivedAt: performance.now(),
    } }));
  }
  function restart() {
    setTyped(""); setBoosts({}); setShots({}); setRound(value => value + 1);
  }
  return <main>
    <header><div><p className="eyebrow">APERÇU VISUEL · #36</p><h1>La même arène. Deux styles de voitures.</h1></div></header>
    <div className="toolbar">
      <div role="group" aria-label="Style des voitures" className="toggle">
        <button aria-pressed={!sprites} onClick={() => setSprites(false)}>Actuelles</button>
        <button aria-pressed={sprites} onClick={() => setSprites(true)}>Blender</button>
      </div>
      <p>Conduite, contacts et tirs de l’arène actuelle. Le choix reste ouvert.</p>
    </div>
    <SpriteStyle.Provider value={sprites}>
      <Arena key={round} stadium="diorama" cars={cars} boosts={boosts} shots={shots} />
    </SpriteStyle.Provider>
    <div className="toolbar actions">
      <button onClick={() => setBoosts({ preview: performance.now() })}>Boost</button>
      <button onClick={() => shoot(true)}>Tirer au but</button>
      <button onClick={() => shoot(false)}>Tir manqué</button>
      <button onClick={restart}>Recommencer</button>
      <span role="status">{progress === 1 ? "Terminé · tir final !" : `${Math.round(progress * 100)} %`}</span>
    </div>
    <section className="typing">
      <p className="prompt" aria-label={PROMPT}>{[...PROMPT].map((char, i) => <span key={i} className={i < typed.length ? (char === typed[i] ? "correct" : "wrong") : i === typed.length ? "cursor" : ""}>{char}</span>)}</p>
      <label htmlFor="typing">Tape le texte pour accélérer ; termine-le pour déclencher le tir final.</label>
      <textarea id="typing" value={typed} maxLength={PROMPT.length} readOnly={progress === 1} spellCheck={false}
        onChange={event => {
          const value = event.target.value;
          if (value.length > typed.length && PROMPT.startsWith(value)) setBoosts({ preview: performance.now() });
          setTyped(value);
        }} />
    </section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Preview />);
