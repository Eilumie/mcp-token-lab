export const formatNumber = (value) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 3 });

export const formatToken = (value) =>
  value === null ? "—" : `${formatNumber(value / 1000)}K`;

export const formatPercent = (value) =>
  value === null ? "—" : `${(value * 100).toFixed(2)}%`;

export function formatMoney(value, currency) {
  const symbol = currency === "CNY" ? "¥" : "$";
  const amount =
    value !== 0 && Math.abs(value) < 1e-8
      ? value.toExponential(3)
      : value.toFixed(8);
  return `${symbol}${amount}`;
}

export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvCell(value) {
  const safeValue = String(value ?? "")
    .replace(/^[=+@-]/, "'$&")
    .replaceAll('"', '""');
  return `"${safeValue}"`;
}
