import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  createQuestion,
  isChoiceType,
  slugify,
  validateQuestions,
  withType,
} from "../lib/survey";
import { friendlyError } from "../lib/errors";
import {
  QUESTION_TYPE_LABEL,
  type Question,
  type QuestionType,
  type Survey,
} from "../lib/types";
import { Button, Spinner, useToast } from "../components/ui";
import { QuestionPreview } from "../components/QuestionPreview";

const TYPES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[];

export function SurveyEditorPage({ mode }: { mode: "new" | "edit" }) {
  const { id } = useParams();
  const { profile, isAdmin, canPublish, canWriteSurveys } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [slugLocked, setSlugLocked] = useState(false);
  const [status, setStatus] = useState<Survey["status"]>("draft");
  const [questions, setQuestions] = useState<Question[]>([createQuestion()]);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    void supabase
      .from("surveys")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setError("Không tìm thấy khảo sát.");
          setLoading(false);
          return;
        }
        const s = data as unknown as Survey;
        setTitle(s.title);
        setDescription(s.description ?? "");
        setSlug(s.public_slug);
        setSlugLocked(s.status !== "draft");
        setStatus(s.status);
        setQuestions(Array.isArray(s.questions) && s.questions.length ? (s.questions as Question[]) : [createQuestion()]);
        setLoading(false);
      });
  }, [mode, id]);

  function updateQuestion(qid: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  }

  function move(qid: string, dir: -1 | 1) {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.id === qid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function persist(nextStatus: Survey["status"]) {
    setError(null);
    if (!canWriteSurveys) {
      setError("Bạn không có quyền chỉnh sửa khảo sát.");
      return;
    }
    if (nextStatus !== "draft" && !canPublish) {
      setError("Bạn không có quyền xuất bản hoặc đóng khảo sát.");
      return;
    }
    if (!title.trim()) {
      setError("Vui lòng nhập tên khảo sát.");
      return;
    }
    const qErr = validateQuestions(questions);
    if (nextStatus === "published" && qErr) {
      setError(qErr);
      return;
    }
    if (qErr && nextStatus !== "draft") {
      setError(qErr);
      return;
    }
    const publicSlug = slug.trim() || slugify(title);
    setSaving(true);
    const payload = {
      tenant_id: null,
      title: title.trim(),
      description: description.trim() || null,
      public_slug: publicSlug,
      questions,
      status: nextStatus,
      published_at: nextStatus === "published" ? new Date().toISOString() : nextStatus === "draft" ? null : undefined,
      created_by: profile?.id ?? null,
    };
    if (mode === "new") {
      const { data, error: err } = await supabase.from("surveys").insert(payload).select("id").single();
      setSaving(false);
      if (err) {
        setError(friendlyError(err, "Không lưu được khảo sát."));
        return;
      }
      toast.show(nextStatus === "published" ? "Đã xuất bản khảo sát." : "Đã lưu bản nháp.");
      navigate(`/surveys/${data.id}`);
      return;
    }
    const updatePayload = { ...payload };
    if (mode === "edit") delete (updatePayload as { created_by?: string }).created_by;
    const { error: err } = await supabase.from("surveys").update(updatePayload).eq("id", id);
    setSaving(false);
    if (err) {
      setError(friendlyError(err, "Không lưu được khảo sát."));
      return;
    }
    setStatus(nextStatus);
    setSlug(publicSlug);
    if (nextStatus !== "draft") setSlugLocked(true);
    toast.show(nextStatus === "published" ? "Đã xuất bản khảo sát." : nextStatus === "closed" ? "Đã đóng khảo sát." : "Đã lưu bản nháp.");
  }

  if (!canWriteSurveys) return <div className="error">Bạn không có quyền tạo hoặc sửa khảo sát.</div>;
  if (loading) return <Spinner />;

  return (
    <form
      className="stack"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void persist("draft");
      }}
    >
      {error ? <div className="error">{error}</div> : null}
      <div className="card card-pad form-grid">
        <label className="field">
          Tên khảo sát
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          Mô tả
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="field">
          Đường dẫn công khai
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Tự tạo khi xuất bản"
            disabled={slugLocked && !isAdmin}
          />
          <span className="hint">
            Người trả lời mở /s/{slug || "..."} — giữ nguyên sau khi xuất bản trừ khi đổi có chủ đích.
          </span>
        </label>
      </div>

      <div className="row-actions">
        <Button type="button" variant={tab === "edit" ? "primary" : "ghost"} onClick={() => setTab("edit")}>
          Soạn thảo
        </Button>
        <Button type="button" variant={tab === "preview" ? "primary" : "ghost"} onClick={() => setTab("preview")}>
          Xem trước
        </Button>
      </div>

      {tab === "preview" ? (
        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>{title || "Chưa đặt tên"}</h3>
          <p className="muted">{description}</p>
          <QuestionPreview questions={questions} />
        </div>
      ) : (
        <div className="builder">
          <div>
            {questions.map((q, index) => (
              <div className="q-item" key={q.id}>
                <div className="q-head">
                  <strong>Câu {index + 1}</strong>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(q.id, -1)}>
                      Lên
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(q.id, 1)}>
                      Xuống
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setQuestions((qs) => [...qs, { ...q, id: crypto.randomUUID() }])}
                    >
                      Sao chép
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
                <div className="form-grid two">
                  <label className="field">
                    Loại
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(q.id, withType(q, e.target.value as QuestionType))}
                    >
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {QUESTION_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Bắt buộc
                    <select
                      value={q.required ? "1" : "0"}
                      onChange={(e) => updateQuestion(q.id, { required: e.target.value === "1" })}
                    >
                      <option value="1">Bắt buộc</option>
                      <option value="0">Tùy chọn</option>
                    </select>
                  </label>
                </div>
                <label className="field" style={{ marginTop: 10 }}>
                  Nội dung câu hỏi
                  <input value={q.label} onChange={(e) => updateQuestion(q.id, { label: e.target.value })} />
                </label>
                {isChoiceType(q.type) ? (
                  <div style={{ marginTop: 10 }} className="stack">
                    {(q.options ?? []).map((opt, oi) => (
                      <div key={oi} className="row-actions">
                        <input
                          value={opt}
                          onChange={(e) => {
                            const options = [...(q.options ?? [])];
                            options[oi] = e.target.value;
                            updateQuestion(q.id, { options });
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            updateQuestion(q.id, { options: (q.options ?? []).filter((_, i) => i !== oi) })
                          }
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      className="btn-sm"
                      onClick={() => updateQuestion(q.id, { options: [...(q.options ?? []), `Lựa chọn ${(q.options?.length ?? 0) + 1}`] })}
                    >
                      Thêm lựa chọn
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            <Button type="button" variant="ghost" onClick={() => setQuestions((qs) => [...qs, createQuestion()])}>
              Thêm câu hỏi
            </Button>
          </div>
          <aside className="card card-pad stack">
            <div>
              <strong>Trạng thái:</strong> {status}
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu nháp"}
            </Button>
            {canPublish ? (
              <Button type="button" variant="accent" disabled={saving} onClick={() => void persist("published")}>
                Xuất bản
              </Button>
            ) : (
              <p className="hint">Nhân viên có thể soạn nháp. Quản lý sẽ xuất bản.</p>
            )}
            {canPublish && status === "published" ? (
              <Button type="button" variant="ghost" disabled={saving} onClick={() => void persist("closed")}>
                Đóng khảo sát
              </Button>
            ) : null}
          </aside>
        </div>
      )}
      {toast.node}
    </form>
  );
}
