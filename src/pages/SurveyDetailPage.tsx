import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDateTime } from "../lib/survey";
import { SURVEY_STATUS_LABEL, type Profile, type Survey, type SurveyAssignment } from "../lib/types";
import { Button, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { QuestionPreview } from "../components/QuestionPreview";

export function SurveyDetailPage() {
  const { id } = useParams();
  const { profile, isAdmin, role, canWriteSurveys, canPublish, canManageAssignments } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [missing, setMissing] = useState(false);
  const [assignments, setAssignments] = useState<SurveyAssignment[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    const query = supabase
      .from("surveys")
      .select("*, profiles:created_by(id, full_name, email)")
      .eq("id", id);
    if (!isAdmin && profile?.tenant_id) query.eq("tenant_id", profile.tenant_id);
    void query.maybeSingle().then(({ data }) => {
        if (!data) setMissing(true);
        else {
          const s = data as unknown as Survey;
          setSurvey({
            ...s,
            profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
          });
        }
      });
  }, [id]);

  async function loadAssignments() {
    if (!id) return;
    const [{ data: assignmentRows }, { data: staffRows }] = await Promise.all([
      supabase.from("survey_assignments").select("*, profiles:assignee_id(id, full_name, email)").eq("survey_id", id).order("created_at"),
      supabase.from("profiles").select("id, full_name, email, role, status, tenant_id").eq("role", "staff").eq("status", "active").order("full_name"),
    ]);
    setAssignments((assignmentRows ?? []) as unknown as SurveyAssignment[]);
    setStaff((staffRows ?? []) as unknown as Profile[]);
  }

  useEffect(() => { void loadAssignments(); }, [id]);

  async function assignSurvey() {
    if (!id || !profile?.tenant_id || !assigneeId) return;
    setAssignmentError(null);
    const { error } = await supabase.from("survey_assignments").insert({
      tenant_id: profile.tenant_id,
      survey_id: id,
      assignee_id: assigneeId,
      assigned_by: profile.id,
      status: "assigned",
    });
    if (error) setAssignmentError("Không thể phân công. Nhân viên có thể đã được phân công khảo sát này.");
    else { setAssigneeId(""); void loadAssignments(); }
  }

  async function updateAssignment(assignment: SurveyAssignment, status: SurveyAssignment["status"]) {
    const { error } = await supabase.from("survey_assignments").update({ status }).eq("id", assignment.id);
    if (error) setAssignmentError("Không cập nhật được trạng thái phân công.");
    else void loadAssignments();
  }

  if (missing) return <div className="error">Không tìm thấy khảo sát hoặc bạn không có quyền xem.</div>;
  if (!survey) return <Spinner />;

  const publicUrl = `${window.location.origin}/s/${survey.public_slug}`;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h3 style={{ margin: 0 }}>{survey.title}</h3>
          <p>
            {SURVEY_STATUS_LABEL[survey.status]} · Tạo {formatDateTime(survey.created_at)}
          </p>
        </div>
        <div className="row-actions">
          {canWriteSurveys && (survey.status === "draft" || canPublish) ? (
            <Button variant="ghost" onClick={() => navigate(`/surveys/${survey.id}/edit`)}>
              Sửa
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => navigate(`/surveys/${survey.id}/results`)}>
            Kết quả
          </Button>
        </div>
      </div>
      <div className="card card-pad stack">
        <div>
          <strong>Mô tả</strong>
          <p className="muted">{survey.description || "Không có mô tả."}</p>
        </div>
        {survey.status === "published" ? (
          <div>
            <strong>Liên kết công khai</strong>
            <p>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                {publicUrl}
              </a>
            </p>
          </div>
        ) : null}
        <div>
          <strong>Người tạo</strong>
          <p className="muted">{survey.profiles?.full_name || survey.profiles?.email || "—"}</p>
        </div>
      </div>
      <div className="card card-pad stack">
        <div><strong>Phân công</strong><p className="muted">Theo dõi người phụ trách khảo sát này.</p></div>
        {assignmentError ? <div className="error">{assignmentError}</div> : null}
        {canManageAssignments ? <div className="row-actions"><select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Chọn nhân viên</option>{staff.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}</select><Button variant="accent" onClick={() => void assignSurvey()} disabled={!assigneeId}>Phân công</Button></div> : null}
        {!assignments.length ? <p className="muted">Chưa có phân công.</p> : <div className="table-wrap"><table className="data"><thead><tr><th>Nhân viên</th><th>Trạng thái</th><th>Ngày giao</th><th></th></tr></thead><tbody>{assignments.map((assignment) => <tr key={assignment.id}><td>{assignment.profiles?.full_name || assignment.profiles?.email || "—"}</td><td>{assignment.status}</td><td>{formatDateTime(assignment.assigned_at)}</td><td>{(canManageAssignments || (role === "staff" && assignment.assignee_id === profile?.id)) ? <select value={assignment.status} onChange={(e) => void updateAssignment(assignment, e.target.value as SurveyAssignment["status"])}><option value="assigned">Đã giao</option><option value="in_progress">Đang xử lý</option><option value="completed">Hoàn tất</option><option value="cancelled">Đã hủy</option></select> : null}</td></tr>)}</tbody></table></div>}
      </div>
      <div className="card card-pad">
        <h3 style={{ marginTop: 0 }}>Xem trước câu hỏi</h3>
        <QuestionPreview questions={survey.questions ?? []} />
      </div>
      <Link to="/surveys">← Danh sách khảo sát</Link>
    </div>
  );
}
