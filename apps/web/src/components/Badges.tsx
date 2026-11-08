import type { ApproachKind, Difficulty } from "@dsa-atlas/shared";
import { APPROACH_LABELS } from "@dsa-atlas/shared";

export const DifficultyBadge = ({ d }: { d: Difficulty }) => <span className={`badge diff-${d.toLowerCase()}`}>{d}</span>;

export const KindBadge = ({ kind }: { kind: ApproachKind }) => <span className={`badge kind-${kind}`}>{APPROACH_LABELS[kind]}</span>;

export const BigO = ({ value }: { value: string }) => <code className="bigo">{value || "O(?)"}</code>;
