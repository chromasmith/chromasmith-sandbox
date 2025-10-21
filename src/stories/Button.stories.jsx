import { Button } from '../components/Button.jsx';

export const Default = () => (
  <Button label="Click Me" onClick={() => alert('Button clicked!')} />
);

export const CustomLabel = () => (
  <Button label="Custom Button" onClick={() => console.log('Custom button clicked')} />
);