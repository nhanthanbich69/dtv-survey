import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDateTime } from "../lib/survey";
import { SURVEY_STATUS_LABEL, type Customer, type Survey, type SurveyAssignment } from "../lib/types";
import { Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";

export function CustomerDetailPage() {
  const { id } = useParams();
  const { profile, isAdmin } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [assignments, setAssignments] = useState<SurveyAssignment[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const customerQuery = supabase.from("customers").select("*").eq("id", id);
      if (!isAdmin && profile?.tenant_id) customerQuery.eq("tenant_id", profile.tenant_id);
      const { data } = await customerQuery.maybeSingle();
      if (!data) { setMissing(true); return; }
      setCustomer(data as unknown as Customer);
      const { data: surveyRows } = await supabase.from("surveys").select("*").eq("customer_id", id).order("updated_at", { ascending: false });
      const nextSurveys = (surveyRows ?? []) as unknown as Survey[];
      setSurveys(nextSurveys);
      if (nextSurveys.length) {
        const [{ data: assignmentRows }, { data: responseRows }] = await Promise.all([
          supabase.from("survey_assignments").select("*, profiles:assignee_id(id, full_name, email)").in("survey_id", nextSurveys.map((survey) => survey.id)),
          supabase.from("responses").select("survey_id").in("survey_id", nextSurveys.map((survey) => survey.id)),
        ]);
        setAssignments((assignmentRows ?? []) as unknown as SurveyAssignment[]);
        const counts: Record<string, number> = {};
        for (const response of responseRows ?? []) counts[response.survey_id] = (counts[response.survey_id] ?? 0) + 1;
        setResponseCounts(counts);
      }
    })();
  }, [id, isAdmin, profile?.tenant_id]);

  if (missing) return <div className="error">Không tìm thấy khách hàng hoặc bạn không có quyền xem.</div>;
  if (!customer) return <Spinner />;
  return <div className="stack">
    <div className="page-head"><div><h3 style={{ margin: 0 }}>{customer.full_name || "Khách hàng"}</h3><p>{customer.code || "Chưa có mã"} · {customer.status === "active" ? "Hoạt động" : "Ngưng"}</p></div><Link className="btn btn-ghost" to="/customers">Danh sách khách hàng</Link></div>
    <div className="card card-pad form-grid two"><div><strong>Thông tin liên hệ</strong><p className="muted">{customer.contact_person || "—"}<br />{customer.phone || "—"}<br />{customer.email || "—"}</p></div><div><strong>Ghi chú</strong><p className="muted">{customer.notes || "Không có ghi chú."}</p></div></div>
    <div className="card"><div className="card-pad" style={{ borderBottom: "1px solid var(--line)" }}><strong>Lịch sử khảo sát</strong></div>{!surveys.length ? <div className="empty">Chưa có khảo sát cho khách hàng này.</div> : <div className="table-wrap"><table className="data"><thead><tr><th>Khảo sát</th><th>Phụ trách</th><th>Trạng thái</th><th>Phản hồi</th><th>Cập nhật</th><th></th></tr></thead><tbody>{surveys.map((survey) => { const assignment = assignments.find((item) => item.survey_id === survey.id); return <tr key={survey.id}><td>{survey.title}</td><td>{assignment?.profiles?.full_name || "Chưa phân công"}<div className="hint">{assignment?.status || "—"}</div></td><td><span className={`badge ${survey.status}`}>{SURVEY_STATUS_LABEL[survey.status]}</span></td><td>{responseCounts[survey.id] ?? 0}</td><td>{formatDateTime(survey.updated_at)}</td><td><Link className="btn btn-ghost btn-sm" to={`/surveys/${survey.id}`}>Mở khảo sát</Link></td></tr>; })}</tbody></table></div>}</div>
  </div>;
}
