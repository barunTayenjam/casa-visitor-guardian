const SimpleSettings = () => {
  return (
    <div className="h-full p-6">
      <div className="bg-purple-50 text-purple-800 p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">✅ Settings Page Working!</h2>
        <p className="mb-4">If you can see this page, navigation is working correctly.</p>
        <div className="space-y-2 text-sm">
          <div>• Settings button navigation: ✅ Working</div>
          <div>• Direct URL access: ✅ Working</div>
          <div>• React routing: ✅ Working</div>
        </div>
      </div>
    </div>
  );
};

export default SimpleSettings;