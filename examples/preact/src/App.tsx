import { useState } from 'preact/hooks';
import { Window, WindowLayer } from '@pierre/winkit';

/**
 * Three windows over a clickable backdrop. The layer is empty everywhere except
 * its windows, so clicks on the backdrop prove pointer events pass through.
 */
export function App() {
  const [populationOpen, setPopulationOpen] = useState(true);
  const [backgroundClicks, setBackgroundClicks] = useState(0);

  return (
    <>
      <div class="backdrop" onClick={() => setBackgroundClicks(count => count + 1)}>
        <p>The layer is click-through wherever it is empty. Clicking here proves it.</p>
        <p class="backdrop-count">Background clicks: {backgroundClicks}</p>
      </div>

      <WindowLayer class="demo-layer">
        <Window
          title="Population"
          open={populationOpen}
          defaultPosition={{ x: 32, y: 32 }}
          defaultSize={{ w: 340, h: 240 }}
          minSize={{ w: 220, h: 150 }}
          persistKey="demo.population"
          snap
          onClose={() => setPopulationOpen(false)}
        >
          <p>Drag me by the title bar; resize me from any edge or corner.</p>
          <p>Snapping is on, so my edges pull to the layer and to my siblings.</p>
          <p>My position survives a reload.</p>
        </Window>

        <Window
          title="Resources"
          open
          defaultPosition={{ x: 400, y: 96 }}
          defaultSize={{ w: 300, h: 200 }}
          persistKey="demo.resources"
          snap
        >
          <Counter />
        </Window>

        <Window
          title="No persistence"
          open
          defaultPosition={{ x: 264, y: 330 }}
          defaultSize={{ w: 320, h: 180 }}
        >
          <p>No <code>persistKey</code>, so this one forgets its position on reload.</p>
        </Window>
      </WindowLayer>

      {!populationOpen && (
        <button class="reopen" type="button" onClick={() => setPopulationOpen(true)}>
          Reopen “Population”
        </button>
      )}
    </>
  );
}

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <p>
      <button type="button" onClick={() => setCount(value => value + 1)}>
        Count: {count}
      </button>
      {' '}
      — state living inside a window body.
    </p>
  );
}
