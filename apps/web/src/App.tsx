import { BookOpen, Brain, Home as HomeIcon, ListChecks, NotebookPen, Settings as SettingsIcon, Target } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { isDue } from "@dsa-atlas/review";
import { navigate, section, useRoute, type Route } from "./router";
import { db } from "./db/db";
import { Home } from "./pages/Home";
import { ProblemList } from "./pages/ProblemList";
import { ProblemEditor } from "./pages/ProblemEditor";
import { ProblemView } from "./pages/ProblemView";
import { Revise } from "./pages/Revise";
import { Settings } from "./pages/Settings";
import { Checklist } from "./pages/Checklist";
import { GoalPage, Goals } from "./pages/Goals";
import { NotesPage, NoteView } from "./notes/NotesUI";
import { Link } from "./components/Link";
import { QuickSearch } from "./components/QuickSearch";
import { AppSwitcher } from "./components/AppSwitcher";

type NavItem = { route: Route; label: string; icon: typeof HomeIcon; mobile: boolean };

const NAV: NavItem[] = [
  { route: { name: "home" }, label: "Today", icon: HomeIcon, mobile: true },
  { route: { name: "revise" }, label: "Revise", icon: Brain, mobile: true },
  { route: { name: "checklist" }, label: "Checklist", icon: ListChecks, mobile: true },
  { route: { name: "goals" }, label: "Goals", icon: Target, mobile: true },
  { route: { name: "problems" }, label: "Problems", icon: BookOpen, mobile: true },
  { route: { name: "notes" }, label: "Notion notes", icon: NotebookPen, mobile: false },
  { route: { name: "settings" }, label: "Settings", icon: SettingsIcon, mobile: false },
];

/**
 * Web-first shell: a fixed sidebar on desktop (search, sections, your apps) and
 * a wide content area. On phones the sidebar becomes a top bar plus a bottom tab bar.
 */
export function App() {
  const route = useRoute();
  const active = section(route);
  const due = useLiveQuery(async () => (await db.problems.toArray()).filter((p) => isDue(p.review)).length, [], 0);

  const item = (n: NavItem, cls: string) => {
    const Icon = n.icon;
    return (
      <Link key={n.label} to={n.route} className={`${cls}${active === n.route.name ? " active" : ""}`} aria-current={active === n.route.name ? "page" : undefined}>
        <Icon size={20} aria-hidden />
        <span>{n.label}</span>
        {n.route.name === "revise" && due > 0 && <span className="nav-badge">{due}</span>}
      </Link>
    );
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <img src="/favicon.svg" alt="" width={30} height={30} />
          <span>DSA Atlas</span>
        </a>
        <QuickSearch />
        <nav className="side-nav" aria-label="Sections">
          {NAV.map((n) => item(n, "side-item"))}
        </nav>
        <div className="side-foot">
          <AppSwitcher />
        </div>
      </aside>

      <header className="mobile-bar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <img src="/favicon.svg" alt="" width={28} height={28} />
        </a>
        <QuickSearch />
        <Link to={{ name: "settings" }} className="btn icon ghost" aria-label="Settings">
          <SettingsIcon size={20} />
        </Link>
        <AppSwitcher />
      </header>

      <main className="content">
        {route.name === "home" && <Home />}
        {route.name === "revise" && <Revise />}
        {route.name === "checklist" && <Checklist />}
        {route.name === "goals" && <Goals />}
        {route.name === "goal" && <GoalPage key={route.id} id={route.id} />}
        {route.name === "problems" && <ProblemList key={route.structura ?? ""} structura={route.structura} />}
        {route.name === "notes" && <NotesPage />}
        {route.name === "note" && <NoteView key={route.id} id={route.id} />}
        {route.name === "settings" && <Settings />}
        {route.name === "problem" && (route.edit ? <ProblemEditor key={route.id} id={route.id} /> : <ProblemView key={route.id} id={route.id} />)}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {NAV.filter((n) => n.mobile).map((n) => item(n, "tab-item"))}
      </nav>
    </div>
  );
}
