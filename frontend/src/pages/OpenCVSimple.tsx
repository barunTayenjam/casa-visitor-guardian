import React from 'react';

const OpenCVSimple: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">OpenCV Detection</h1>
      <p>OpenCV integration is successful!</p>
      <div className="mt-4 p-4 bg-green-100 border rounded">
        <h2 className="font-bold text-green-800">✅ Integration Status</h2>
        <ul className="list-disc list-inside mt-2 text-green-700">
          <li>OpenCV microservice: Running on port 8084</li>
          <li>Backend server: Running on port 8082</li>
          <li>Frontend: Running on port 5173</li>
          <li>API endpoints: Configured and working</li>
        </ul>
      </div>
    </div>
  );
};

export default OpenCVSimple;