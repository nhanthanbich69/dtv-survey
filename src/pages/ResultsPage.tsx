import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { downloadCsv } from "../lib/errors";
import { formatDateTime } from "../lib/survey";
import { QUESTION_TYPE_LABEL, type AnswerValue, type Question, type ResponseRow, type Survey } from "../lib/types";
import { Button, Modal, Spinner, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";

function answerText(q: Question, value: AnswerValue) {
  if (value == null || value === "") return "";
  if (q.type === "yes_no") return value === true || value === "true" || value === "yes" ? "Có" : "Không";
  if (Array.isArray(value)) return value.join("; ");
  return String(value);
}

function surveyQuestions(survey: Survey | null): Question[] {
  return survey && Array.isArray(survey.questions) ? survey.questions : [];
}

export function ResultsPage() {
  const { id } = useParams();
  const { profile, isAdmin, canExport } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [detail, setDetail] = useState<ResponseRow | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const surveyQuery = supabase.from("surveys").select("*").eq("id", id);
      if (!isAdmin && profile?.tenant_id) surveyQuery.eq("tenant_id", profile.tenant_id);
      const { data: s } = await surveyQuery.maybeSingle();
      if (!s) {
        setError("Không tìm thấy khảo sát hoặc bạn không có quyền xem kết quả.");
        return;
      }
      setSurvey(s as unknown as Survey);
      const { data: resp, error: rErr } = await supabase
        .from("responses")
        .select("*")
        .eq("survey_id", id)
        .order("submitted_at", { ascending: false });
      if (rErr) setError("Không tải được dữ liệu trả lời.");
      else setRows((resp ?? []) as unknown as ResponseRow[]);
    })();
  }, [id]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.respondent_name, r.respondent_email, r.respondent_phone].some((v) => (v ?? "").toLowerCase().includes(t)),
    );
  }, [rows, q]);

  const summary = useMemo(() => {
    if (!survey) return [];
    return surveyQuestions(survey).map((question) => {
      const values = rows.map((r) => r.answers?.[question.id]).filter((v) => v !== undefined && v !== null && v !== "");
      if (["single_choice", "multiple_choice", "yes_no"].includes(question.type)) {
        const counts = new Map<string, number>();
        const options =
          question.type === "yes_no" ? ["Có", "Không"] : (question.options ?? []).filter((o) => o.trim());
        for (const opt of options) counts.set(opt, 0);
        for (const v of values) {
          const keys = question.type === "yes_no"
            ? [v === true || v === "true" || v === "yes" || v === "Có" ? "Có" : "Không"]
            : Array.isArray(v)
              ? v.map(String)
              : [String(v)];
          for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        return { question, kind: "choice" as const, counts, total: rows.length };
      }
      if (question.type === "rating" || question.type === "number") {
        const nums = values.map((v) => Number(v)).filter((n) => Number.isFinite(n));
        const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
        return { question, kind: "number" as const, avg, n: nums.length };
      }
      return { question, kind: "text" as const, texts: values.map((v) => String(v)) };
    });
  }, [survey, rows]);

  function exportCsv() {
    if (!survey || !canExport) {
      toast.show("Bạn không có quyền xuất dữ liệu.");
      return;
    }
    try {
      const questions = surveyQuestions(survey);
      const header = ["Thời gian", "Họ tên", "Email", "Điện thoại", ...questions.map((qq) => qq.label)];
      const body = rows.map((r) => [
        r.submitted_at,
        r.respondent_name ?? "",
        r.respondent_email ?? "",
        r.respondent_phone ?? "",
        ...questions.map((qq) => answerText(qq, r.answers?.[qq.id] ?? null)),
      ]);
      const safe = survey.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40);
      downloadCsv(`dtv-survey-${safe || "export"}.csv`, [header, ...body]);
      toast.show("Đã tải tệp CSV.");
    } catch {
      toast.show("Không xuất được tệp CSV. Vui lòng thử lại.");
    }
  }

  if (error) return <div className="error">{error}</div>;
  if (!survey) return <Spinner />;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h3 style={{ margin: 0 }}>{survey.title}</h3>
          <p>
            Tổng số lượt trả lời: <strong>{rows.length}</strong>
          </p>
        </div>
        {canExport ? (
          <Button variant="ghost" onClick={exportCsv}>
            Xuất CSV
          </Button>
        ) : null}
      </div>

      <div className="card card-pad stack">
        <strong>Tóm tắt</strong>
        {rows.length === 0 ? <p className="muted">Chưa có dữ liệu để tổng hợp.</p> : null}
        {rows.length > 0
          ? summary.map((item) => (
              <div key={item.question.id}>
                <div>
                  <strong>{item.question.label}</strong>
                  <span className="hint"> · {QUESTION_TYPE_LABEL[item.question.type]}</span>
                </div>
                {item.kind === "choice"
                  ? [...item.counts.entries()].map(([k, n]) => (
                      <div key={k} className="muted">
                        {k}: {n} ({item.total ? Math.round((n / item.total) * 100) : 0}%)
                      </div>
                    ))
                  : null}
                {item.kind === "number" ? (
                  <div className="muted">
                    Trung bình: {item.avg == null ? "—" : item.avg.toFixed(2)} ({item.n} giá trị)
                  </div>
                ) : null}
                {item.kind === "text" ? (
                  <ul>
                    {item.texts.length ? item.texts.map((t, i) => <li key={i}>{t}</li>) : <li className="muted">Không có câu trả lời văn bản.</li>}
                  </ul>
                ) : null}
              </div>
            ))
          : null}
      </div>

      <div className="card">
        <div className="card-pad">
          <label className="field">
            Lọc theo tên / email / điện thoại
            <input value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">Không có lượt trả lời.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Điện thoại</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.submitted_at)}</td>
                    <td>{r.respondent_name || "—"}</td>
                    <td>{r.respondent_email || "—"}</td>
                    <td>{r.respondent_phone || "—"}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDetail(r)}>
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {detail ? (
        <Modal title="Chi tiết câu trả lời" onClose={() => setDetail(null)}>
          <p className="muted">{formatDateTime(detail.submitted_at)}</p>
          {surveyQuestions(survey).map((qq) => (
            <p key={qq.id}>
              <strong>{qq.label}</strong>
              <br />
              {answerText(qq, detail.answers?.[qq.id] ?? null) || "—"}
            </p>
          ))}
        </Modal>
      ) : null}
      <Link to={`/surveys/${survey.id}`}>← Chi tiết khảo sát</Link>
      {toast.node}
    </div>
  );
}
