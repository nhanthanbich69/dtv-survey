import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { AnswerValue, Question, Survey } from "../lib/types";
import { Button } from "../components/ui";

type PublicSurvey = Pick<Survey, "id" | "title" | "description" | "questions" | "status" | "public_slug">;

function submittedKey(slug: string) {
  return `dtv-survey-submitted:${slug}`;
}

export function PublicSurveyPage() {
  const { public_slug } = useParams();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "unavailable" | "form" | "done">("loading");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [meta, setMeta] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!public_slug) return;
    if (localStorage.getItem(submittedKey(public_slug))) {
      setState("done");
      return;
    }
    void supabase
      .from("surveys")
      .select("id, title, description, questions, status, public_slug")
      .eq("public_slug", public_slug)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setState("missing");
          return;
        }
        const raw = data as PublicSurvey;
        const s: PublicSurvey = {
          ...raw,
          questions: Array.isArray(raw.questions) ? raw.questions : [],
        };
        if (s.status !== "published") {
          setState("unavailable");
          return;
        }
        setSurvey(s);
        setState("form");
      });
  }, [public_slug]);

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function validate(): string | null {
    if (!survey) return "Khảo sát không khả dụng.";
    for (const q of Array.isArray(survey.questions) ? survey.questions : []) {
      const v = answers[q.id];
      if (!q.required) continue;
      if (q.type === "multiple_choice") {
        if (!Array.isArray(v) || v.length === 0) return `Vui lòng trả lời: ${q.label}`;
      } else if (v === undefined || v === null || v === "") {
        return `Vui lòng trả lời: ${q.label}`;
      }
    }
    const email = meta.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email không hợp lệ.";
    for (const q of Array.isArray(survey.questions) ? survey.questions : []) {
      const v = answers[q.id];
      if (q.type === "number" && v !== undefined && v !== "" && Number.isNaN(Number(v))) {
        return `Giá trị số không hợp lệ: ${q.label}`;
      }
    }
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    if (!survey || !public_slug) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("responses").insert({
      survey_id: survey.id,
      respondent_name: meta.name.trim() || null,
      respondent_email: meta.email.trim() || null,
      respondent_phone: meta.phone.trim() || null,
      answers,
    });
    setBusy(false);
    if (err) {
      setError("Không gửi được câu trả lời. Vui lòng thử lại.");
      return;
    }
    localStorage.setItem(submittedKey(public_slug), "1");
    setState("done");
  }

  if (state === "loading") {
    return (
      <div className="public-page">
        <div className="public-card">Đang tải khảo sát...</div>
      </div>
    );
  }
  if (state === "missing") {
    return (
      <div className="public-page">
        <div className="public-card">
          <h1>Không tìm thấy khảo sát</h1>
          <p>Liên kết không tồn tại hoặc đã bị gỡ.</p>
        </div>
      </div>
    );
  }
  if (state === "unavailable") {
    return (
      <div className="public-page">
        <div className="public-card">
          <h1>Khảo sát chưa mở</h1>
          <p>Khảo sát này chưa được xuất bản hoặc đã đóng.</p>
        </div>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="public-page">
        <div className="public-card stack">
          <h1>Đã gửi thành công</h1>
          <p>Cảm ơn bạn đã dành thời gian hoàn thành khảo sát.</p>
        </div>
      </div>
    );
  }
  if (!survey) return null;

  return (
    <div className="public-page">
      <form className="public-card stack" onSubmit={onSubmit}>
        <div>
          <div className="hint">DTV Survey</div>
          <h1>{survey.title}</h1>
          {survey.description ? <p className="muted">{survey.description}</p> : null}
        </div>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          Họ tên
          <input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </label>
        <label className="field">
          Email
          <input type="email" value={meta.email} onChange={(e) => setMeta({ ...meta, email: e.target.value })} />
        </label>
        <label className="field">
          Số điện thoại
          <input value={meta.phone} onChange={(e) => setMeta({ ...meta, phone: e.target.value })} />
        </label>
        {(Array.isArray(survey.questions) ? survey.questions : []).map((q, i) => (
          <Field key={q.id} index={i} question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
        ))}
        <Button type="submit" disabled={busy}>
          {busy ? "Đang gửi..." : "Gửi câu trả lời"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  question,
  value,
  onChange,
  index,
}: {
  question: Question;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  index: number;
}) {
  return (
    <div>
      <label className="field">
        {index + 1}. {question.label} {question.required ? "*" : ""}
        {question.type === "short_text" ? (
          <input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        ) : null}
        {question.type === "long_text" ? (
          <textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        ) : null}
        {question.type === "number" ? (
          <input type="number" value={value === undefined || value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
        ) : null}
        {question.type === "date" ? (
          <input type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        ) : null}
      </label>
      {question.type === "rating" ? (
        <div className="rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={value === n ? "on" : ""} onClick={() => onChange(n)}>
              {n}
            </button>
          ))}
        </div>
      ) : null}
      {question.type === "yes_no" ? (
        <div>
          <label className="choice">
            <input type="radio" checked={value === true} onChange={() => onChange(true)} /> Có
          </label>
          <label className="choice">
            <input type="radio" checked={value === false} onChange={() => onChange(false)} /> Không
          </label>
        </div>
      ) : null}
      {question.type === "single_choice"
        ? (question.options ?? []).map((opt) => (
            <label className="choice" key={opt}>
              <input type="radio" checked={value === opt} onChange={() => onChange(opt)} /> {opt}
            </label>
          ))
        : null}
      {question.type === "multiple_choice"
        ? (question.options ?? []).map((opt) => {
            const arr = Array.isArray(value) ? value : [];
            const checked = arr.includes(opt);
            return (
              <label className="choice" key={opt}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(checked ? arr.filter((x) => x !== opt) : [...arr, opt])}
                />{" "}
                {opt}
              </label>
            );
          })
        : null}
    </div>
  );
}

export function HomePage() {
  return (
    <div className="auth-page">
      <div className="card auth-card card-pad stack">
        <h1>DTV Survey</h1>
        <p className="lead">Hệ thống quản lý khảo sát khách hàng.</p>
        <Link className="btn btn-primary" to="/login">
          Đăng nhập quản trị
        </Link>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="auth-page">
      <div className="card auth-card card-pad stack">
        <h1>Không tìm thấy trang</h1>
        <p className="lead">Đường dẫn không tồn tại.</p>
        <Link className="btn btn-primary" to="/">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
