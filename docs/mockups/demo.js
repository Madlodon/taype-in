// Démo commune aux maquettes : on tape le texte pour de vrai, trois bots avancent seuls.
// Mode bloquant : une faute reste affichée sur la lettre courante jusqu'à la bonne touche.
// Chaque maquette dessine la piste elle-même dans onProgress(players).
// onRankChange(better) sert à l'indicateur de dépassement (CRS-3).
// onType(correct) est appelé à chaque touche ; oneLine peut être une fonction pour changer de mise en page.
// startDemo renvoie paint() pour redessiner le texte après un changement de mise en page.

const TEXT =
  "Le ballon file vers le but adverse. Chaque mot tapé sans faute donne un coup de boost à ta voiture. " +
  "Garde les yeux sur le texte et laisse tes doigts faire le travail : la victoire se joue à la dernière seconde.";

// Script classique chargé par les pages HTML : startDemo est global.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function startDemo({ textEl, oneLine, onProgress, onRankChange = () => {}, onType = () => {} }) {
  const players = [
    { name: "Toi", you: true, progress: 0 },
    { name: "Maya", speed: 0.0021, progress: 0 },
    { name: "Léo", speed: 0.0017, progress: 0 },
    { name: "Zoé", speed: 0.0013, progress: 0 },
  ];
  let index = 0;
  let wrong = false;
  let rank = 1;

  function update() {
    onProgress(players);
    const newRank = 1 + players.filter((p) => !p.you && p.progress > players[0].progress).length;
    if (newRank !== rank) onRankChange(newRank < rank);
    rank = newRank;
  }

  const track = document.createElement("span");
  track.className = "demo-text";
  const letters = [...TEXT].map((char) => {
    const span = document.createElement("span");
    span.textContent = char;
    track.append(span);
    return span;
  });
  textEl.append(track);

  function paint() {
    letters.forEach((span, i) => {
      span.className = i < index ? "done" : i === index ? (wrong ? "current wrong" : "current") : "";
    });
    if (typeof oneLine === "function" ? oneLine() : oneLine) {
      // Garde la lettre courante au tiers de la ligne : le texte défile vers la gauche.
      const current = letters[Math.min(index, letters.length - 1)];
      const shift = Math.max(0, current.offsetLeft - textEl.clientWidth / 3);
      track.style.transform = `translateX(${-shift}px)`;
    } else {
      track.style.transform = "";
    }
    players[0].progress = index / letters.length;
    update();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || index >= letters.length) return;
    event.preventDefault();
    wrong = event.key !== TEXT[index];
    if (!wrong) index += 1;
    onType(!wrong);
    paint();
  });

  setInterval(() => {
    for (const bot of players.slice(1)) {
      bot.progress = Math.min(1, bot.progress + bot.speed * (0.6 + Math.random() * 0.8));
    }
    update();
  }, 100);

  paint();
  return paint;
}
