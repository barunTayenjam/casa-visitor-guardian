const MinimalDashboard = () => {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-lg">
        <h2 className="text-3xl font-bold text-blue-800 mb-4">✅ Dashboard Working!</h2>
        <p className="text-blue-600 text-lg mb-2">Minimal dashboard - no contexts, no hooks issues</p>
        <div className="text-sm text-blue-500">
          <div>• React rendering: ✅ Working</div>
          <div>• Router outlet: ✅ Working</div>
          <div>• Component display: ✅ Working</div>
        </div>
      </div>
      
      <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
        <h3 className="text-lg font-bold text-green-800">Navigation Test</h3>
        <p className="text-green-600">Click the buttons below to test navigation:</p>
        <div className="mt-2 space-x-2">
          <a href="/events" className="inline-block px-4 py-2 bg-green-500 text-white rounded">Go to Events</a>
          <a href="/settings" className="inline-block px-4 py-2 bg-purple-500 text-white rounded">Go to Settings</a>
        </div>
      </div>
    </div>
  );
};

export default MinimalDashboard;