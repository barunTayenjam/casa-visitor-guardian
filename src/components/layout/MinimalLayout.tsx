import { Outlet } from 'react-router-dom';

export const MinimalLayout = () => {
  return (
    <div className="h-screen flex flex-col">
      <header className="p-4 bg-blue-100">
        <h1>Casa Security - Minimal Version</h1>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <nav className="p-4 bg-gray-100">
        <div className="flex gap-4">
          <a href="/" className="px-4 py-2 bg-blue-500 text-white rounded">Home</a>
          <a href="/events" className="px-4 py-2 bg-green-500 text-white rounded">Events</a>
          <a href="/settings" className="px-4 py-2 bg-purple-500 text-white rounded">Settings</a>
        </div>
      </nav>
    </div>
  );
};