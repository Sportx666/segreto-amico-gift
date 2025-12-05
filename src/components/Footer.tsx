import { Link, useLocation } from "react-router-dom";

export const Footer = () => {
  const location = useLocation();
  // Hide on auth page and add bottom padding for mobile nav
  if (location.pathname === "/auth") return null;

  return (
    <footer className="border-t mt-10 mb-16 md:mb-0">
      <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <p className="order-2 md:order-1 font-medium">
          © {new Date().getFullYear()} Amico Segreto
          <span className="ml-2 text-xs opacity-50" title="Build version">
            v{import.meta.env.VITE_BUILD_TIME || 'dev'}
          </span>
        </p>
        <nav className="order-1 md:order-2 flex items-center gap-4" role="navigation" aria-label="Link legali">
          <Link 
            to="/privacy" 
            className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-1"
          >
            Privacy
          </Link>
          <span className="opacity-40" aria-hidden="true">•</span>
          <Link 
            to="/cookies" 
            className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-1"
          >
            Cookie
          </Link>
          <span className="opacity-40" aria-hidden="true">•</span>
          <Link 
            to="/terms" 
            className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-1"
          >
            Termini
          </Link>
        </nav>
      </div>
    </footer>
  );
};

