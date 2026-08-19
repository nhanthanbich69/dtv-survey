export function friendlyError(error: unknown, fallback = "Đã xảy ra lỗi. Vui lòng thử lại.") {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: string }).message);
    const map: Record<string, string> = {
      "Invalid login credentials": "Email hoặc mật khẩu không đúng.",
      "Email not confirmed": "Email chưa được xác nhận. Vui lòng liên hệ quản trị viên.",
      "User already registered": "Email này đã được sử dụng.",
      "invalid claim": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      JWT: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    };
    for (const [key, vi] of Object.entries(map)) {
      if (message.includes(key)) return vi;
    }
    if (/permission|rls|row-level|not authorized|42501/i.test(message)) {
      return "Bạn không có quyền thực hiện thao tác này.";
    }
    if (/network|fetch|Failed to fetch/i.test(message)) {
      return "Không kết nối được máy chủ. Kiểm tra mạng và thử lại.";
    }
    if (message && !/postgres|sql|stack|supabase|pgrst/i.test(message) && message.length < 180) {
      return message;
    }
  }
  return fallback;
}

export function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadCsv(filename: string, rows: string[][]) {
  const bom = "\uFEFF";
  const content = bom + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
