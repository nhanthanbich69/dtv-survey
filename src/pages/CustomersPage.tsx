import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatDateTime } from "../lib/survey";
import type { Customer } from "../lib/types";
import { Spinner } from "../components/ui";

export function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (queryError) setError("Không tải được danh sách khách hàng.");
      else {
        const customers = Array.isArray(data) ? data : [];
        setRows(customers as Customer[]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h3 style={{ margin: 0 }}>Khách hàng</h3>
          <p>Khách hàng được thêm tự động sau khi hoàn thành khảo sát.</p>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="card">
        {loading ? <Spinner /> : null}
        {!loading && !error && rows.length === 0 ? <div className="empty">Chưa có khách hàng nào.</div> : null}
        {!loading && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Số điện thoại</th>
                  <th>Ngày thêm</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.full_name || "—"}</td>
                    <td>{customer.email || "—"}</td>
                    <td>{customer.phone || "—"}</td>
                    <td>{formatDateTime(customer.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}