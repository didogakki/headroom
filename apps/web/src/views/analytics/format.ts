/**
 * Whole hours: "13小时" under a day, "1天18小时" and "2天" from 24 h on.
 */
export function hoursText(hours: number): string {
  const whole = Math.round(hours);
  if (whole < 24) return `${whole}小时`;
  const days = Math.floor(whole / 24);
  const rest = whole - days * 24;
  return rest === 0 ? `${days}天` : `${days}天${rest}小时`;
}

/** A calendar day as "10月24日", in local time. */
export function shortDate(at: number): string {
  const date = new Date(at);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** Dollars for a price: whole when it is whole, else cents. */
export function dollars(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}
