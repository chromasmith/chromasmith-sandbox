import React from 'react';

export const Card = ({ title, description }) => {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '400px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: '24px' }}>{title}</h2>
      <p style={{ color: '#666', lineHeight: '1.5' }}>{description}</p>
    </div>
  );
};