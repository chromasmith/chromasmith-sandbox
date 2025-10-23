import React from 'react';

// Test webhook iteration - 2025-10-23T19:45:00Z

export const Button = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
      }}
    >
      {label}
    </button>
  );
};