import { Link, useLocation } from "react-router-dom";

export const Footer = () => {
  const location = useLocation();
  // Optionally hide on auth page to keep it clean
  if (location.pathname === "/auth") return null;

  return (
    <footer className="border-t mt-10">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <p className="order-2 md:order-1">© {new Date().getFullYear()} Amico Segreto</p>
        <nav className="order-1 md:order-2 flex items-center gap-4">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <span className="opacity-40">•</span>
          <Link to="/cookies" className="hover:text-foreground">Cookie</Link>
          <span className="opacity-40">•</span>
          <Link to="/terms" className="hover:text-foreground">Termini</Link>
        </nav>
      </div>
    </footer>
  );
};

