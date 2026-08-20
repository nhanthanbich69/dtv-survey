import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SurveysPage } from "./pages/SurveysPage";
import { SurveyDetailPage } from "./pages/SurveyDetailPage";
import { SurveyEditorPage } from "./pages/SurveyEditorPage";
import { ResultsPage } from "./pages/ResultsPage";
import { UsersPage } from "./pages/UsersPage";
import { CustomersPage } from "./pages/CustomersPage";

import { AccountPage } from "./pages/AccountPage";
import { NotFoundPage, PublicSurveyPage } from "./pages/PublicSurveyPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/s/:public_slug" element={<PublicSurveyPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/surveys" element={<SurveysPage />} />
        <Route path="/surveys/new" element={<SurveyEditorPage mode="new" />} />
        <Route path="/surveys/:id" element={<SurveyDetailPage />} />
        <Route path="/surveys/:id/edit" element={<SurveyEditorPage mode="edit" />} />
        <Route path="/surveys/:id/results" element={<ResultsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
