import { Card } from '../components/Card.jsx';

export const Default = () => (
  <Card
    title="Card Title"
    description="This is a sample card description that shows how the component works."
  />
);

export const LongContent = () => (
  <Card
    title="Longer Title With More Text"
    description="This is a much longer description to test how the card handles more content. It should wrap nicely within the card boundaries."
  />
);