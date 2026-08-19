import type { Question } from "../lib/types";
import { QUESTION_TYPE_LABEL } from "../lib/types";

export function QuestionPreview({ questions }: { questions: Question[] }) {
  if (!questions.length) return <p className="muted">Chưa có câu hỏi.</p>;
  return (
    <div className="stack">
      {questions.map((q, i) => (
        <div key={q.id} className="q-item">
          <strong>
            {i + 1}. {q.label || "Chưa có nội dung"}
          </strong>
          <div className="hint">
            {QUESTION_TYPE_LABEL[q.type]} {q.required ? "· Bắt buộc" : "· Tùy chọn"}
          </div>
          {q.options?.length ? (
            <ul>
              {q.options.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
