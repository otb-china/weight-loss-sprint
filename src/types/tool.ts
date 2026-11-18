export type RecordKind = "food" | "weight" | "exercise";

interface RecordBase {
  id: string;
  recordedAt: string;
  note: string;
  updatedAt: string;
}

export type SprintRecord = RecordBase & (
  | { kind: "food"; name: string }
  | { kind: "weight"; kilograms: number }
  | { kind: "exercise"; name: string; minutes: number }
);

export type DeletedSprintRecord = SprintRecord & { deletedAt: string };

export interface SprintData {
  items: SprintRecord[];
  deletedItems: DeletedSprintRecord[];
}
