import { BookOpen, Brain, Home as HomeIcon, Settings as SettingsIcon } from "lucide-react";
import { navigate, useRoute, type Route } from "./router";
import { Home } from "./pages/Home";
import { ProblemList } from "./pages/ProblemList";
import { ProblemEditor } from "./pages/ProblemEditor";
import { ProblemView } from "./pages/ProblemView";
import { Revise } from "./pages/Revise";
import { Settings } from "./pages/Settings";
import { Link } from "./components/Link";
import { QuickSearch } from "./components/QuickSearch";
import { AppSwitcher } from "./components/AppSwitcher";

const NAV: { route: Route; label: string; icon: typeof HomeIcon }[] = [
  { route: { name: "home" }, label: "Today", icon: HomeIcon },
  { route: { name: "revise" }, label: "Revise", icon: Brain },
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
        <QuickSearch />
        <nav className="nav">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <Link key={label} to={r} className={`nav-item ${route.name === r.name ? "active" : ""}`}>
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <AppSwitcher />
      </header>
      <main className="main">
        {route.name === "home" && <Home />}
        {route.name === "revise" && <Revise />}
        {route.name === "problems" && <ProblemList key={route.structura ?? ""} structura={route.structura} />}
        {route.name === "settings" && <Settings />}
        {route.name === "problem" && (route.edit ? <ProblemEditor key={route.id} id={route.id} /> : <ProblemView key={route.id} id={route.id} />)}
      </main>
    </div>
  );
}
