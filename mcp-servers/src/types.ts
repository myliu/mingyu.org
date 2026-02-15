export enum StatusId {
  NotVisited = 0,
  Lived = 1,
  Visited = 4,
  Transited = 5,
}

export const STATUS_LABELS: Record<number, string> = {
  [StatusId.NotVisited]: "Not visited",
  [StatusId.Lived]: "Lived in",
  [StatusId.Visited]: "Visited",
  [StatusId.Transited]: "Transited",
};

export interface Place {
  name: string;
  description: string;
  code?: string;
  statusId: number;
  color?: string;
}

export interface WorldHeritageSite {
  id: string;
  name: string;
  visited: boolean;
}
