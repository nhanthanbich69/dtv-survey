import { useLocation, useParams } from "react-router-dom";
import { AppShell as Shell, RequireAuth } from "./layout";

const TITLES: Record<string, string> = {
  "/dashboard": "Tổng quan",
  "/surveys": "Khảo sát",
  "/customers": "Khách hàng",
  "/surveys/new": "Tạo khảo sát",
  "/users": "Người dùng",
  "/tenants": "Khách hàng",
  "/account": "Tài khoản",
};

export function ProtectedLayout() {
  const location = useLocation();
  const params = useParams();
  let title = TITLES[location.pathname] ?? "DTV Survey";
  if (location.pathname.endsWith("/edit")) title = "Chỉnh sửa khảo sát";
  else if (location.pathname.endsWith("/results")) title = "Kết quả khảo sát";
  else if (params.id && location.pathname.startsWith("/surveys/")) title = "Chi tiết khảo sát";
  return (
    <RequireAuth>
      <Shell title={title} />
    </RequireAuth>
  );
}
