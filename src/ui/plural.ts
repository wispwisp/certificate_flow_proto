/** Russian plural: forms are for 1, 2-4 and 5+ (e.g. строка, строки, строк). */
export function plural(n: number, forms: [string, string, string]): string {
  const last = n % 10
  const lastTwo = n % 100
  const form = lastTwo >= 11 && lastTwo <= 14 ? forms[2] : last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2]
  return `${n} ${form}`
}
