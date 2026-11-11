import markup from './game/markup.html?raw';

export default function App() {
  // This is the trusted, bundled game markup. All game state stays in the
  // existing simulation; React mounts its screen once without extra rerenders.
  return <div id="touchline-game" dangerouslySetInnerHTML={{ __html: markup }} />;
}
