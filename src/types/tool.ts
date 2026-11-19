export type RecordKind = "food" | "weight" | "exercise";

export const mealLabels = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" } as const;
export type Meal = keyof typeof mealLabels;

interface RecordBase {
  id: string;
  recordedAt: string;
  note: string;
  updatedAt: string;
  photo?: string;
}

export type SprintRecord = RecordBase & (
  | { kind: "food"; name: string; meal?: Meal }
  | { kind: "weight"; kilograms: number }
  | { kind: "exercise"; name: string; minutes?: number; distanceKm?: number; calories?: number }
);

export type DeletedSprintRecord = SprintRecord & { deletedAt: string };

export interface SprintData {
  items: SprintRecord[];
  deletedItems: DeletedSprintRecord[];
}
