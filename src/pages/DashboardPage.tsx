import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { formatDateTime } from "../lib/survey";
import { SURVEY_STATUS_LABEL, type Survey, type SurveyStatus } from "../lib/types";
import { Spinner } from "../components/ui";
type Stats = {
  total: number;
  draft: number;
  published: number;
  closed: number;
  responses: number;
  recent: Survey[];
};

export function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const surveyQuery = supabase.from("surveys").select("id, title, status, created_at, published_at");
      const { data: surveys, error: sErr } = await surveyQuery.order("created_at", { ascending: false });
      if (sErr) {
        setError("Không tải được dữ liệu tổng quan.");
        return;
      }
      const list = (surveys ?? []) as unknown as Survey[];
      const ids = list.map((s) => s.id);
      let responseCount = 0;
      if (ids.length) {
        const { count } = await supabase
          .from("responses")
          .select("id", { count: "exact", head: true })
          .in("survey_id", ids);
        responseCount = count ?? 0;
      }
      const by = (st: SurveyStatus) => list.filter((s) => s.status === st).length;
      setStats({
        total: list.length,
        draft: by("draft"),
        published: by("published"),
        closed: by("closed"),
        responses: responseCount,
        recent: list.slice(0, 8),
      });
    })();
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!stats) return <Spinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h3 style={{ margin: 0 }}>Xin chào{profile?.full_name ? `, ${profile.full_name}` : ""}</h3>
          <p>Số liệu thực tế từ hệ thống. Không có dữ liệu ảo.</p>
        </div>
      </div>
      <div className="stats">
        <div className="card stat">
          <div className="label">Tổng khảo sát</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="card stat">
          <div className="label">Đã xuất bản</div>
          <div className="value">{stats.published}</div>
        </div>
        <div className="card stat">
          <div className="label">Nháp / Đã đóng</div>
          <div className="value">
            {stats.draft} / {stats.closed}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Lượt trả lời</div>
          <div className="value">{stats.responses}</div>
        </div>
      </div>
      <div className="card">
        <div className="card-pad" style={{ borderBottom: "1px solid var(--line)" }}>
          <strong>Hoạt động gần đây</strong>
        </div>
        {stats.recent.length === 0 ? (
          <div className="empty">Chưa có khảo sát. Hãy tạo khảo sát đầu tiên.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Tên khảo sát</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/surveys/${s.id}`}>{s.title || "Chưa đặt tên"}</Link>
                    </td>
                    <td>
                      <span className={`badge ${s.status}`}>{SURVEY_STATUS_LABEL[s.status]}</span>
                    </td>
                    <td>{formatDateTime(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
