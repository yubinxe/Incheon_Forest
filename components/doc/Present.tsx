import { CONTRACT, CONTRACTOR_FIN, PROJECT } from "@/lib/project";
import { m, pct } from "@/lib/format";

/* ───────── 발표 레이어 (비파괴 추가) — 08 상단 유동성 카드 · 08 하단 PM 결정 요약 ───────── */

/** 시공사 현금성자산 대비 후순위 유보금 — 잠긴 비율을 한 막대로 */
export function ContractorLiquidity() {
  const cash = CONTRACTOR_FIN.cash[CONTRACTOR_FIN.cash.length - 1]; // 2025년 말 48,000
  const locked = CONTRACT.retention; // 42,000
  const free = cash - locked;
  const ratio = locked / cash;
  return (
    <aside id="risk-contractor" className="liq" aria-label="시공사 유동성 압박">
      <div className="liq-head">
        <p className="liq-k">핵심 리스크 · 시공사 유동성</p>
        <p className="liq-big">
          <b>{pct(ratio)}</b>
          <span>
            {PROJECT.contractor} 현금성자산 {m(cash / 100)}억원 중 <em>{m(locked / 100)}억원</em>이 후순위 유보금으로 묶입니다
          </span>
        </p>
      </div>
      <div className="liq-bar" role="img" aria-label={`현금성자산 ${m(cash / 100)}억원 중 유보금 ${m(locked / 100)}억원(${pct(ratio)}) 잠김, 가용 ${m(free / 100)}억원`}>
        <div className="liq-locked" style={{ width: `${ratio * 100}%` }}>
          <span>유보금 {m(locked / 100)}억원 · {pct(ratio)}</span>
        </div>
        <div className="liq-free">
          <span>가용 {m(free / 100)}억원</span>
        </div>
      </div>
      <div className="liq-scale">
        <span>0</span>
        <span>현금성자산 {m(cash / 100)}억원 (2025년 말)</span>
      </div>
      <p className="liq-path">
        <b>리스크 전이 경로:</b> 분양률 79.9% 하회 → 유보금 {m(locked / 100)}억원 회수 지연 → 대주단 손실보다 시공사 유동성 경색 및 공정 리스크 선행
      </p>
      <p className="note">
        유보금은 도급계약서 제9조에 따라 본PF 원리금 전액 상환 후 지급됩니다. 시공사 재무는 교육용 합성 자료입니다.
      </p>
    </aside>
  );
}

/** PM 최종 의사결정 요약 — 발표자가 그대로 읽는 3줄 */
export function PmDecision() {
  return (
    <aside className="pmd" aria-label="PM 최종 의사결정 요약">
      <p className="pmd-k">PM 최종 의사결정 요약</p>
      <ol>
        <li><b>분양가 인상보다 초기 계약률 80% 선제 방어</b> — 상환 한계선 79.9% 위를 분양 초기에 확보하는 것이 이익 극대화보다 우선입니다.</li>
        <li><b>시공사 유동성 · 책임준공 이행 보완</b> — 유보금 420억원이 현금성자산의 87.5%이므로 신탁사 책임준공 또는 연대보증을 조건으로 붙입니다.</li>
        <li><b>미분양담보대출 9% 트리거 사전 관리</b> — 실행 조건과 할인 하한을 대주단과 미리 합의해 상환 부족 구간 진입 시 비용을 통제합니다.</li>
      </ol>
    </aside>
  );
}
