/**
 * Official USD→BOB exchange rate from the Banco Central de Bolivia, via the
 * independent apibcb.cucu.bo proxy. Called client-side (the endpoint sets
 * `Access-Control-Allow-Origin: *`).
 */

const OFICIAL_URL = "https://apibcb.cucu.bo/api/v1/tc/oficial";

export interface OfficialRate {
  /** Official "compra" (buy) rate used to convert USD plans to bolivianos. */
  rate: number;
  /** Date the rate is in force (yyyy-mm-dd), when reported. */
  fecha: string;
}

export async function getOfficialRate(): Promise<OfficialRate> {
  const res = await fetch(OFICIAL_URL, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Tipo de cambio oficial: HTTP ${res.status}`);
  const json = await res.json();
  const tc = json?.tc_oficial ?? {};
  const rate = Number(tc.venta ?? tc.base ?? tc.valor);
  if (!rate || Number.isNaN(rate)) throw new Error("Tipo de cambio oficial: respuesta inválida");
  return { rate, fecha: String(tc.fecha ?? "") };
}
