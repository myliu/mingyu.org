export enum StatusId {
  NotVisited = 0,
  Lived = 1,
  Planned = 2,
  Wishlist = 3,
  Visited = 4,
}

export const STATUS_LABELS: Record<number, string> = {
  [StatusId.NotVisited]: "Not visited",
  [StatusId.Lived]: "Lived in",
  [StatusId.Planned]: "Planned to go",
  [StatusId.Wishlist]: "Wish to visit",
  [StatusId.Visited]: "Visited",
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
