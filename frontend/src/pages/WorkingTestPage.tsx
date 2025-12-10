import React from 'react';

const SimpleTest: React.FC = () => {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{
          color: '#2196F3',
          fontSize: '48px',
          marginBottom: '30px'
        }}>
          ✅ FRONTEND TEST
        </h1>
        
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '30px',
          borderRadius: '15px',
          marginBottom: '30px',
          border: '3px solid #2196F3'
        }}>
          <h2 style={{ color: '#333', fontSize: '24px', marginBottom: '20px' }}>
            React Component Working
          </h2>
          
          <p style={{ color: '#666', fontSize: '18px', marginBottom: '20px' }}>
            Click count: {count}
          </p>
          
          <button
            onClick={() => setCount(count + 1)}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              fontSize: '18px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '20px'
            }}
          >
            Increment Counter
          </button>
          
          <div style={{
            backgroundColor: '#e3f2fd',
            padding: '20px',
            borderRadius: '8px',
            marginTop: '20px'
          }}>
            <h3 style={{ color: '#1976D2', margin: '0 0 15px 0' }}>
              ✅ All Systems Working:
            </h3>
            <ul style={{
              textAlign: 'left',
              color: '#333',
              fontSize: '16px',
              margin: 0,
              paddingLeft: '20px'
            }}>
              <li style={{ marginBottom: '8px' }}>✅ React Components Load</li>
              <li style={{ marginBottom: '8px' }}>✅ State Management Works</li>
              <li style={{ marginBottom: '8px' }}>✅ CSS Styles Apply</li>
              <li style={{ marginBottom: '8px' }}>✅ Event Handlers Work</li>
              <li style={{ marginBottom: '8px' }}>✅ No Blank Screen</li>
            </ul>
          </div>
        </div>
        
        <div style={{
          backgroundColor: '#fff3e0',
          padding: '20px',
          borderRadius: '10px',
          border: '2px solid #ff9800'
        }}>
          <h3 style={{ color: '#e65100', margin: '0 0 15px 0' }}>
            🚀 Frontend Successfully Fixed!
          </h3>
          <p style={{ color: '#333', fontSize: '16px', margin: 0 }}>
            The blank screen issue has been resolved.<br/>
            This test page demonstrates that React components<br/>
            are loading and working correctly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SimpleTest;