/**
 * Tag display helper — backend slug'ı kullanıcı-yüzlü title-case metne çevirir.
 *
 * Backend DB'de tag slug formatı (server/_core/prompts.ts#normalizeTag):
 * - Türkçe küçük harf (tr-TR locale)
 * - Compound'lar için tire ile ayrılmış: "yapay-zeka", "kara-mizah"
 * - Legacy (dash öncesi): tek token olarak yazılmış: "yapayzeka"
 *
 * UI'da kullanıcıya gösterilen form:
 * - "yapay-zeka" → "Yapay Zeka"
 * - "yapayzeka"  → "Yapayzeka" (legacy — bölünemiyor, ilk harf büyüt)
 * - "ölüm"       → "Ölüm"
 * - "varoluşçuluk" → "Varoluşçuluk"
 *
 * Router path'inde slug'ı OLDUĞU GIBI kullan — bu helper sadece render için.
 */
export function tagDisplay(slug: string): string {
  if (!slug) return "";
  return slug
    .split("-")
    .map((word) => {
      if (!word) return word;
      // Türkçe locale: "i" → "İ" (dotted), default "i" → "I" (dotless) yapardı.
      // Reading audience primary Türk → tr-TR doğru davranış.
      const first = word.charAt(0).toLocaleUpperCase("tr-TR");
      return first + word.slice(1);
    })
    .join(" ");
}
