const MinimalEvents = () => {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border-2 border-green-200 p-6 rounded-lg">
        <h2 className="text-3xl font-bold text-green-800 mb-4">✅ Events Page Working!</h2>
        <p className="text-green-600 text-lg mb-2">Minimal events page - testing navigation</p>
        <div className="text-sm text-green-500">
          <div>• Events route: ✅ Working</div>
          <div>• Page rendering: ✅ Working</div>
          <div>• Navigation: ✅ Working</div>
        </div>
      </div>
      
      <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
        <h3 className="text-lg font-bold text-blue-800">Navigation Test</h3>
        <p className="text-blue-600">Click the buttons to test navigation:</p>
        <div className="mt-2 space-x-2">
          <a href="/" className="inline-block px-4 py-2 bg-blue-500 text-white rounded">Go to Dashboard</a>
          <a href="/settings" className="inline-block px-4 py-2 bg-purple-500 text-white rounded">Go to Settings</a>
        </div>
      </div>
    </div>
  );
};

export default MinimalEvents;