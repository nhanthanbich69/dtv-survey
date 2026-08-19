import type { Question, QuestionType } from "./types";

const CHOICE_TYPES: QuestionType[] = ["single_choice", "multiple_choice"];

export function createQuestion(type: QuestionType = "short_text"): Question {
  return {
    id: crypto.randomUUID(),
    type,
    label: "",
    required: true,
    options: CHOICE_TYPES.includes(type) ? ["Lựa chọn 1", "Lựa chọn 2"] : undefined,
  };
}

export function withType(question: Question, type: QuestionType): Question {
  const next: Question = { ...question, type };
  if (CHOICE_TYPES.includes(type)) {
    next.options =
      question.options && question.options.length >= 2
        ? question.options
        : ["Lựa chọn 1", "Lựa chọn 2"];
  } else {
    delete next.options;
  }
  return next;
}

export function slugify(input: string) {
  const map: Record<string, string> = {
    à: "a",
    á: "a",
    ả: "a",
    ã: "a",
    ạ: "a",
    ă: "a",
    ằ: "a",
    ắ: "a",
    ẳ: "a",
    ẵ: "a",
    ặ: "a",
    â: "a",
    ầ: "a",
    ấ: "a",
    ẩ: "a",
    ẫ: "a",
    ậ: "a",
    đ: "d",
    è: "e",
    é: "e",
    ẻ: "e",
    ẽ: "e",
    ẹ: "e",
    ê: "e",
    ề: "e",
    ế: "e",
    ể: "e",
    ễ: "e",
    ệ: "e",
    ì: "i",
    í: "i",
    ỉ: "i",
    ĩ: "i",
    ị: "i",
    ò: "o",
    ó: "o",
    ỏ: "o",
    õ: "o",
    ọ: "o",
    ô: "o",
    ồ: "o",
    ố: "o",
    ổ: "o",
    ỗ: "o",
    ộ: "o",
    ơ: "o",
    ờ: "o",
    ớ: "o",
    ở: "o",
    ỡ: "o",
    ợ: "o",
    ù: "u",
    ú: "u",
    ủ: "u",
    ũ: "u",
    ụ: "u",
    ư: "u",
    ừ: "u",
    ứ: "u",
    ử: "u",
    ữ: "u",
    ự: "u",
    ỳ: "y",
    ý: "y",
    ỷ: "y",
    ỹ: "y",
    ỵ: "y",
  };
  const normalized = input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug || "khao-sat"}-${suffix}`;
}

export function validateQuestions(questions: Question[]): string | null {
  if (questions.length === 0) return "Cần ít nhất một câu hỏi.";
  const ids = new Set<string>();
  for (const [i, q] of questions.entries()) {
    if (!q.id) return `Câu hỏi ${i + 1} thiếu mã.`;
    if (ids.has(q.id)) return "Mã câu hỏi bị trùng. Vui lòng tải lại trang.";
    ids.add(q.id);
    if (!q.label.trim()) return `Câu hỏi ${i + 1} chưa có nội dung.`;
    if (CHOICE_TYPES.includes(q.type)) {
      const options = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) {
        return `Câu hỏi ${i + 1} cần ít nhất 2 lựa chọn.`;
      }
    }
  }
  return null;
}

export function isChoiceType(type: QuestionType) {
  return CHOICE_TYPES.includes(type);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
}
