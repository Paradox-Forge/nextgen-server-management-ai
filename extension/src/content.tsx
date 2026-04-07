
import { createRoot } from 'react-dom/client';
import { Widget } from './Widget';
import './index.css';

// Create a container div for our React app
const NEXTGEN_ID = 'nextgen-guild-ai-root';

function init() {
  if (document.getElementById(NEXTGEN_ID)) return;

  const rootEl = document.createElement('div');
  rootEl.id = NEXTGEN_ID;
  document.body.appendChild(rootEl);

  // We could use attachShadow here to prevent Discord styles from bleeding in,
  // but Tailwind is easiest injected normally with high specificity or prefixed.
  // For MVP, we directly mount it. It has high z-index and fixed positioning.

  const root = createRoot(rootEl);
  root.render(<Widget />);
  console.log('[NextGen Guild Management] AI Widget injected.');
}

// Since Discord is a SPA, we might need to observe the DOM or just run once
setTimeout(init, 1000); // Give Discord time to load initially
