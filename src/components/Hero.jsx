import React from 'react';

export const Hero = ({ title, subtitle }) => {
  return (
    <div
      style={{
        backgroundColor: '#f4f4f4',
        padding: '60px 20px',
        textAlign: 'center',
        borderRadius: '8px',
      }}
    >
      <h1 style={{ fontSize: '48px', margin: 0 }}>{title}</h1>
      <p style={{ fontSize: '20px', color: '#666', marginTop: '16px' }}>{subtitle}</p>
    </div>
  );
};