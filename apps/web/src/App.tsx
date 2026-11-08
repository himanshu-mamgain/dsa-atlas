import { BookOpen, Home as HomeIcon, Settings as SettingsIcon } from "lucide-react";
import { navigate, useRoute, type Route } from "./router";
import { Home } from "./pages/Home";
import { ProblemList } from "./pages/ProblemList";
import { ProblemPage } from "./pages/ProblemPage";
import { Settings } from "./pages/Settings";
import { Link } from "./components/Link";

const NAV: { route: Route; label: string; icon: typeof HomeIcon }[] = [
  { route: { name: "home" }, label: "Today", icon: HomeIcon },
  { route: { name: "problems" }, label: "Problems", icon: BookOpen },
  { route: { name: "settings" }, label: "Settings", icon: SettingsIcon },
];

export function App() {
  const route = useRoute();
  return (
    <div className="shell">
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>DSA Atlas</span>
        </a>
        <nav className="nav">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <Link key={label} to={r} className={`nav-item ${route.name === r.name ? "active" : ""}`}>
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </header>
      <main className="main">
        {route.name === "home" && <Home />}
        {route.name === "problems" && <ProblemList />}
        {route.name === "settings" && <Settings />}
        {route.name === "problem" && <ProblemPage key={route.id} id={route.id} />}
      </main>
    </div>
  );
}

