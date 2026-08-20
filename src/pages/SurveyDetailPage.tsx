import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDateTime } from "../lib/survey";
import { SURVEY_STATUS_LABEL, type Survey } from "../lib/types";
import { Button, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { QuestionPreview } from "../components/QuestionPreview";

export function SurveyDetailPage() {
  const { id } = useParams();
  const { canWriteSurveys, canPublish } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [missing, setMissing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    void supabase
      .from("surveys")
      .select("*, profiles:created_by(id, full_name, email)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
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
      <div className="card card-pad">
        <h3 style={{ marginTop: 0 }}>Xem trước câu hỏi</h3>
        <QuestionPreview questions={survey.questions ?? []} />
      </div>
      <Link to="/surveys">← Danh sách khảo sát</Link>
    </div>
  );
}
