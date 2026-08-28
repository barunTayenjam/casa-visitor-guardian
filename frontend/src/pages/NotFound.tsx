import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
        </div>
        <h1 className="text-4xl font-bold mb-2 text-white">404</h1>
        <p className="text-sm text-muted-foreground mb-6">Route not found in system</p>
        <Link
          to="/app"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white/[0.06] border border-white/[0.10] text-sm text-muted-foreground hover:bg-white/[0.10] hover:text-white transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
