import React from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from './components/Button.jsx';
import { Card } from './components/Card.jsx';
import { Hero } from './components/Hero.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ padding: '40px' }}>
      <Hero title="Chromasmith Sandbox" subtitle="Testing ForgeView Live Reload" />
      <div style={{ marginTop: '40px' }}>
        <Card
          title="Welcome"
          description="This is a minimal React + Ladle sandbox. Run 'npm run ladle' to start the component browser."
        />
      </div>
      <div style={{ marginTop: '20px' }}>
        <Button label="Click Me" onClick={() => alert('Button works!')} />
      </div>
    </div>
  </React.StrictMode>
);