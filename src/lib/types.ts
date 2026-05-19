export interface Item {
  id: string;
  created_at: string;
  type: "youtube" | "blog" | "article" | "image" | "linkedin" | "instagram";
  url: string;
  title: string;
  summary: string;
  tags: string;
  folder: string;
  is_read: boolean;
  read_at: string;
  is_archived: boolean;
  ideas: string;
  action: string;
  source: string;
  thread: string;
  images: string;
  value_rating: number;
  rowIndex: number;
}
