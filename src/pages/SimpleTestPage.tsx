import React from 'react';

const SimpleTest: React.FC = () => {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        padding: '40px',
        textAlign: 'center',
        border: '2px solid #000',
        borderRadius: '10px',
        backgroundColor: '#f0f0f0'
      }}>
        <h1 style={{
          color: '#000000',
          fontSize: '36px',
          marginBottom: '20px'
        }}>
          🎉 VISITOR ANALYTICS TEST PAGE
        </h1>
        
        <p style={{
          color: '#333333',
          fontSize: '18px',
          marginBottom: '30px'
        }}>
          This is a simple test page to verify React is working
        </p>
        
        <div style={{
          padding: '20px',
          backgroundColor: '#e0e0e0',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#000' }}>✅ If you can see this:</h3>
          <ul style={{ textAlign: 'left', color: '#333', margin: 0, paddingLeft: '20px' }}>
            <li>React is working</li>
            <li>Component is loading</li>
            <li>Styles are applied</li>
            <li>No blank screen issue</li>
          </ul>
        </div>
        
        <button
          onClick={() => {
            alert('Button clicked! React working perfectly!');
          }}
          style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '15px 30px',
            fontSize: '16px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
          Test Button Click
        </button>
        
        <div style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#ffe4b5',
          borderRadius: '5px'
        }}>
          <p style={{ margin: 0, color: '#333', fontSize: '14px' }}>
            <strong>Browser Check:</strong> 
            {navigator.userAgent.includes('Chrome') ? ' Chrome' : 
             navigator.userAgent.includes('Firefox') ? ' Firefox' : 
             navigator.userAgent.includes('Safari') ? ' Safari' : ' Other'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SimpleTest;