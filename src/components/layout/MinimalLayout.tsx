import { Outlet } from 'react-router-dom';

export const MinimalLayout = () => {
  return (
    <div className="h-screen flex flex-col">
      <header className="p-4 bg-blue-100 border-b">
        <h1 className="text-xl font-bold">Casa Security - Minimal Version</h1>
      </header>
      
      <main className="flex-1 overflow-auto bg-white">
        <div className="p-4">
          <div className="bg-yellow-100 p-4 rounded mb-4">
            <h2>Debug: Layout is working</h2>
            <p>If you see this, the MinimalLayout is rendering correctly.</p>
          </div>
          <Outlet />
        </div>
      </main>
      
      <nav className="p-4 bg-gray-100 border-t">
        <div className="flex gap-4 justify-center">
          <a href="/" className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium">Home</a>
          <a href="/events" className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium">Events</a>
          <a href="/settings" className="px-6 py-3 bg-purple-500 text-white rounded-lg font-medium">Settings</a>
        </div>
      </nav>
    </div>
  );
};