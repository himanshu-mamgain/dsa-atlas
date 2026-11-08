import { useState } from "react";
import { slugify } from "@dsa-atlas/shared";
import { blankProblem, db, uid } from "../db/db";
import { navigate, hrefFor } from "../router";

export function NewProblem() {
  const [title, setTitle] = useState("");
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        let id = slugify(t) || uid();
        if (await db.problems.get(id)) id = `${id}-${uid().slice(0, 4)}`;
        await db.problems.add(blankProblem(t, id));
        setTitle("");
        navigate(hrefFor({ name: "problem", id, edit: true }));
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Problem title, e.g. Longest Substring Without Repeating Characters"
        aria-label="Problem title"
      />
      <button className="btn primary" type="submit" disabled={!title.trim()}>
        Add
      </button>
    </form>
  );
}
