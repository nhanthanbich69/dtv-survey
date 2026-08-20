import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { formatDateTime, slugify } from "../lib/survey";
import { friendlyError } from "../lib/errors";
import { SURVEY_STATUS_LABEL, type Survey, type SurveyAssignment } from "../lib/types";
import { Button, Modal, Spinner, useToast } from "../components/ui";
import { asOne } from "../lib/cast";

export function SurveysPage() {
  const { profile, isAdmin, role, canWriteSurveys, canPublish, canDeleteSurveys } = useAuth();
  const [rows, setRows] = useState<Survey[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [assignments, setAssignments] = useState<Record<string, SurveyAssignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Survey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    const q = supabase
      .from("surveys")
      .select("*, profiles:created_by(id, full_name, email), customers:customer_id(id, full_name, code)")
      .order("created_at", { ascending: false });
    if (!isAdmin && profile?.tenant_id) q.eq("tenant_id", profile.tenant_id);
    const { data, error: err } = await q;
    if (err) {
      setError("Không tải được danh sách khảo sát.");
      setLoading(false);
      return;
    }
    const surveys = (data ?? []).map((row) => {
      const s = row as unknown as Survey;
      return {
        ...s,
        profiles: asOne<NonNullable<Survey["profiles"]>>(s.profiles),
      };
    });
    let visibleSurveys = surveys;
    if (role === "staff" && profile?.id) {
      const { data: assignedRows } = await supabase.from("survey_assignments").select("*, profiles:assignee_id(id, full_name, email)").eq("assignee_id", profile.id);
      const assigned = (assignedRows ?? []) as unknown as SurveyAssignment[];
      const allowed = new Set(assigned.map((assignment) => assignment.survey_id));
      visibleSurveys = surveys.filter((survey) => allowed.has(survey.id));
      const grouped: Record<string, SurveyAssignment[]> = {};
      for (const assignment of assigned) grouped[assignment.survey_id] = [...(grouped[assignment.survey_id] ?? []), assignment];
      setAssignments(grouped);
    } else {
      const { data: assignmentRows } = await supabase.from("survey_assignments").select("*, profiles:assignee_id(id, full_name, email)").in("survey_id", surveys.map((survey) => survey.id));
      const grouped: Record<string, SurveyAssignment[]> = {};
      for (const assignment of (assignmentRows ?? []) as unknown as SurveyAssignment[]) grouped[assignment.survey_id] = [...(grouped[assignment.survey_id] ?? []), assignment];
      setAssignments(grouped);
    }
    setRows(visibleSurveys);
    if (visibleSurveys.length) {
      const { data: resp } = await supabase.from("responses").select("survey_id").in(
        "survey_id",
        visibleSurveys.map((s) => s.id),
      );
      const map: Record<string, number> = {};
      for (const r of resp ?? []) {
        const id = (r as { survey_id: string }).survey_id;
        map[id] = (map[id] ?? 0) + 1;
      }
      setCounts(map);
    } else setCounts({});
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, profile?.id, profile?.tenant_id, role]);

  async function publish(s: Survey) {
    setBusyId(s.id);
    const { error: err } = await supabase
      .from("surveys")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", s.id);
    setBusyId(null);
    if (err) toast.show(friendlyError(err, "Không xuất bản được khảo sát."));
    else {
      toast.show("Đã xuất bản khảo sát.");
      void load();
    }
  }

  async function closeSurvey(s: Survey) {
    setBusyId(s.id);
    const { error: err } = await supabase.from("surveys").update({ status: "closed" }).eq("id", s.id);
    setBusyId(null);
    if (err) toast.show(friendlyError(err, "Không đóng được khảo sát."));
    else {
      toast.show("Đã đóng khảo sát.");
      void load();
    }
  }

  async function duplicate(s: Survey) {
    setBusyId(s.id);
    const { error: err } = await supabase.from("surveys").insert({
      tenant_id: profile?.tenant_id,
      created_by: profile?.id,
      title: `${s.title} (bản sao)`,
      description: s.description,
      status: "draft",
      public_slug: slugify(s.title),
      questions: s.questions,
      published_at: null,
    });
    setBusyId(null);
    if (err) toast.show(friendlyError(err, "Không sao chép được khảo sát."));
    else {
      toast.show("Đã tạo bản sao.");
      void load();
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    const { error: err } = await supabase.from("surveys").delete().eq("id", pendingDelete.id);
    setBusyId(null);
    setPendingDelete(null);
    if (err) toast.show(friendlyError(err, "Không xóa được khảo sát."));
    else {
      toast.show("Đã xóa khảo sát.");
      void load();
    }
  }

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows.length]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h3 style={{ margin: 0 }}>Danh sách khảo sát</h3>
          <p>Quản lý, xuất bản và theo dõi lượt trả lời.</p>
        </div>
        {canWriteSurveys ? (
          <Button onClick={() => navigate("/surveys/new")}>Tạo khảo sát</Button>
        ) : null}
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="card">
        {loading ? <Spinner /> : null}
        {empty ? <div className="empty">Chưa có khảo sát nào.</div> : null}
        {!loading && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Tên khảo sát</th>
                  <th>Khách hàng</th>
                  <th>Trạng thái</th>
                  <th>Phụ trách</th>
                  <th>Số lượt trả lời</th>
                  <th>Người tạo</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td>{(s as Survey & { customers?: { full_name: string | null; code: string | null } | null }).customers?.full_name || "Khảo sát chung"}</td>
                    <td>
                      <span className={`badge ${s.status}`}>{SURVEY_STATUS_LABEL[s.status]}</span>
                    </td>
                    <td>{(assignments[s.id] ?? []).map((assignment) => assignment.profiles?.full_name || assignment.profiles?.email).filter(Boolean).join(", ") || "Chưa phân công"}</td>
                    <td>{counts[s.id] ?? 0}</td>
                    <td>{s.profiles?.full_name || s.profiles?.email || "—"}</td>
                    <td>{formatDateTime(s.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="btn btn-ghost btn-sm" to={`/surveys/${s.id}`}>
                          Xem
                        </Link>
                        {canWriteSurveys && (s.status === "draft" || canPublish) ? (
                          <Link className="btn btn-ghost btn-sm" to={`/surveys/${s.id}/edit`}>
                            Sửa
                          </Link>
                        ) : null}
                        {canWriteSurveys ? (
                          <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => void duplicate(s)}>
                            Sao chép
                          </button>
                        ) : null}
                        {canPublish && s.status === "draft" ? (
                          <button className="btn btn-accent btn-sm" disabled={busyId === s.id} onClick={() => void publish(s)}>
                            Xuất bản
                          </button>
                        ) : null}
                        {canPublish && s.status === "published" ? (
                          <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => void closeSurvey(s)}>
                            Đóng
                          </button>
                        ) : null}
                        <Link className="btn btn-ghost btn-sm" to={`/surveys/${s.id}/results`}>
                          Kết quả
                        </Link>
                        {canDeleteSurveys ? (
                          <button className="btn btn-danger btn-sm" onClick={() => setPendingDelete(s)}>
                            Xóa
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {pendingDelete ? (
        <Modal title="Xóa khảo sát" onClose={() => setPendingDelete(null)}>
          <p>Xóa “{pendingDelete.title}”? Thao tác không thể hoàn tác.</p>
          <div className="row-actions">
            <Button variant="danger" onClick={() => void remove()} disabled={busyId === pendingDelete.id}>
              Xóa
            </Button>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Hủy
            </Button>
          </div>
        </Modal>
      ) : null}
      {toast.node}
    </div>
  );
}
