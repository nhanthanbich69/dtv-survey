export type Role = "admin" | "manager" | "staff" | "viewer";
export type UserStatus = "active" | "inactive";
export type TenantStatus = "active" | "inactive";
export type SurveyStatus = "draft" | "published" | "closed";

export type QuestionType =
  | "short_text"
  | "long_text"
  | "number"
  | "rating"
  | "single_choice"
  | "multiple_choice"
  | "yes_no"
  | "date";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options?: string[];
}

export type AnswerValue = string | number | boolean | string[] | null;

export interface Tenant {
  id: string;
  name: string;
  code: string;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  tenant_id: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  tenants?: Pick<Tenant, "id" | "name" | "code" | "status"> | null;
}

export interface Survey {
  id: string;
  tenant_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  status: SurveyStatus;
  public_slug: string;
  questions: Question[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  tenants?: Pick<Tenant, "id" | "name" | "code"> | null;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
  response_count?: number;
}

export interface ResponseRow {
  id: string;
  survey_id: string;
  tenant_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  respondent_phone: string | null;
  answers: Record<string, AnswerValue>;
  submitted_at: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  source_response_id: string | null;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  staff: "Nhân viên",
  viewer: "Người xem",
};

export const SURVEY_STATUS_LABEL: Record<SurveyStatus, string> = {
  draft: "Nháp",
  published: "Đã xuất bản",
  closed: "Đã đóng",
};

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  short_text: "Văn bản ngắn",
  long_text: "Văn bản dài",
  number: "Số",
  rating: "Đánh giá 1–5",
  single_choice: "Một lựa chọn",
  multiple_choice: "Nhiều lựa chọn",
  yes_no: "Có / Không",
  date: "Ngày",
};
