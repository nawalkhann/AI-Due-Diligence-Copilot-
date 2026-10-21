export type Role = "owner" | "admin" | "analyst" | "viewer";

export type DocStatus = "uploaded" | "queued" | "processing" | "ready" | "failed";

export const DOC_TYPES = {
  annual_report: "Annual report (10-K, 20-F)",
  quarterly_report: "Quarterly report (10-Q)",
  filing_other: "Other filing (8-K, S-1, proxy)",
  financial_statement: "Financial statements / model",
  investor_presentation: "Investor presentation",
  market_report: "Market or industry report",
  other: "Other",
} as const;

export type DocType = keyof typeof DOC_TYPES;

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  ticker: string | null;
}

export interface DocumentRow {
  id: string;
  title: string;
  doc_type: DocType;
  file_name: string;
  size_bytes: number;
  status: DocStatus;
  error: string | null;
  page_count: number | null;
  chunk_count: number | null;
  warnings: string[];
  period_end: string | null;
  created_at: string;
  companies: { name: string } | null;
}

export const ACCEPTED_FILES = {
  "application/pdf": [".pdf"],
  "text/html": [".htm", ".html"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
} as const;

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
