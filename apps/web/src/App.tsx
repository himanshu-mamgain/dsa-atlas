import { BookOpen, Brain, House, ListChecks, NotebookPen, Settings as SettingsIcon, Target, Waypoints, type LucideIcon } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { isDue } from "@dsa-atlas/review";
import { hrefFor, navigate, section, useRoute, type Route, type Section } from "./router";
import { db } from "./db/db";
import { Home } from "./pages/Home";
import { ProblemList } from "./pages/ProblemList";
import { ProblemEditor } from "./pages/ProblemEditor";
import { ProblemView } from "./pages/ProblemView";
import { Revise } from "./pages/Revise";
import { Settings } from "./pages/Settings";
import { Checklist } from "./pages/Checklist";
import { GoalPage, Goals } from "./pages/Goals";
import { SolvePage } from "./solve/SolvePage";
import { NotesPage, NoteView } from "./notes/NotesUI";
import { Link } from "./components/Link";
import { QuickSearch } from "./components/QuickSearch";
import { AppSwitcher } from "./components/AppSwitcher";

// The five tabs, like Structura's (and Instagram's): along the bottom on phones,
// in the top bar on desktop.
const TABS: [Section, Route, string, LucideIcon][] = [
  ["home", { name: "home" }, "Today", House],
  ["checklist", { name: "checklist" }, "Checklist", ListChecks],
  ["revise", { name: "revise" }, "Revise", Brain],
  ["goals", { name: "goals" }, "Goals", Target],
  ["library", { name: "problems" }, "Library", BookOpen],
];

function Tabs({ current, due, className }: { current: Section; due: number; className: string }) {
  return (
    <nav className={className} aria-label="Sections">
      {TABS.map(([id, route, label, Icon]) => {
        const on = current === id;
        return (
          <a
            key={id}
            href={hrefFor(route)}
            className={`tab${on ? " is-active" : ""}`}
            aria-current={on ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              // Tapping the tab you're on goes back to its top.
              if (on && location.search === new URL(hrefFor(route), location.origin).search) window.scrollTo({ top: 0, behavior: "smooth" });
              else navigate(hrefFor(route));
            }}
          >
            <span className="tab-icon">
              <Icon size={24} strokeWidth={on ? 2.5 : 1.8} aria-hidden />
              {id === "revise" && due > 0 && <span className="nav-badge">{due}</span>}
            </span>
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}

/** Problems and Notion notes share the Library tab. */
function LibrarySwitch({ current }: { current: "problems" | "notes" }) {
  return (
    <div className="seg library-switch" role="group" aria-label="Library">
      <Link to={{ name: "problems" }} aria-pressed={current === "problems"}>
        <BookOpen size={16} aria-hidden /> Problems
      </Link>
      <Link to={{ name: "notes" }} aria-pressed={current === "notes"}>
        <NotebookPen size={16} aria-hidden /> Notion notes
      </Link>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const active = section(route);
  const due = useLiveQuery(async () => (await db.problems.toArray()).filter((p) => isDue(p.review)).length, [], 0);

  return (
    <div className="shell">
      <header className="appbar">
        <a
          className="brand"
          href="/"
          aria-label="DSA Atlas, home"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <span className="brand-mark" aria-hidden>
            <Waypoints size={20} />
          </span>
          <span className="brand-name">DSA Atlas</span>
        </a>
        <Tabs current={active} due={due} className="appbar-tabs" />
        <QuickSearch />
        <Link to={{ name: "settings" }} className={`btn icon ghost${active === "settings" ? " is-on" : ""}`} aria-label="Settings">
          <SettingsIcon size={20} />
        </Link>
        <AppSwitcher />
      </header>

      <main className={`content${route.name === "solve" ? " is-full" : ""}`}>
        {(route.name === "problems" || route.name === "notes") && <LibrarySwitch current={route.name} />}
        {route.name === "home" && <Home />}
        {route.name === "revise" && <Revise />}
        {route.name === "checklist" && <Checklist key={route.pattern ?? ""} pattern={route.pattern} />}
        {route.name === "solve" && <SolvePage key={route.id} id={route.id} />}
        {route.name === "goals" && <Goals />}
        {route.name === "goal" && <GoalPage key={route.id} id={route.id} />}
        {route.name === "problems" && <ProblemList key={route.structura ?? ""} structura={route.structura} />}
        {route.name === "notes" && <NotesPage />}
        {route.name === "note" && <NoteView key={route.id} id={route.id} />}
        {route.name === "settings" && <Settings />}
        {route.name === "problem" && (route.edit ? <ProblemEditor key={route.id} id={route.id} /> : <ProblemView key={route.id} id={route.id} />)}
      </main>

      <Tabs current={active} due={due} className="tabbar" />
    </div>
  );
}
