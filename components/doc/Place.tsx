import { COMMERCIAL, PROJECT, UNIT_TYPES } from "@/lib/project";
import { TOWERS, FLOOR_H, PILOTI_H } from "@/components/scene/towers";
import { m } from "@/lib/format";
import { SectionHead } from "./Heads";

/* ───────── 02 입지환경 ───────── */

const INFRA: { cat: string; name: string; rel: string; note: string }[] = [
  { cat: "공원", name: "청라호수공원", rel: "사업지 남측 접면", note: "단지 남향 전열이 호수 조망" },
  { cat: "철도", name: "공항철도 청라국제도시역", rel: "청라국제도시 남측", note: "서울역 · 인천국제공항 직결 노선" },
  { cat: "철도", name: "서울 지하철 7호선 청라 연장", rel: "청라국제도시 관통", note: "건설 중 · 개통 시기는 공고 시점에 재확인" },
  { cat: "도로", name: "인천국제공항고속도로 청라IC", rel: "청라국제도시 북서측", note: "공항 · 서울 방면 광역 접근" },
  { cat: "도로", name: "청라–영종 해상교량(제3연륙교)", rel: "청라국제도시 서측", note: "영종도 연결 · 통행 조건은 재확인" },
  { cat: "상업", name: "커낼웨이 수변 상업가로", rel: "호수공원과 연결된 수로", note: "근린상업 · 보행 축" },
  { cat: "수변", name: "경인아라뱃길", rel: "청라국제도시 북측", note: "서해와 한강을 잇는 운하 · 수변 산책로" },
];

export function Location() {
  return (
    <section id="location" className="doc-sec" data-shot="5">
      <SectionHead
        no="02"
        group="사업안내"
        title="입지환경"
        lede="호수공원 북측 첫 열. 공항철도와 공항고속도로로 서울·공항 양방향 접근이 가능한 청라국제도시 생활권입니다."
      />
      <div className="loc">
        <figure className="loc-map" aria-label="입지 개념도">
          <svg viewBox="0 0 640 420" role="img">
            <title>청라 레이크 포레 입지 개념도</title>
            <rect width="640" height="420" fill="#eef0ea" />
            {/* 서해 */}
            <path d="M0 0 H92 C70 90 104 170 78 250 C60 320 96 380 84 420 H0 Z" fill="#c9d6dd" />
            <text x="22" y="210" className="m-sea">서해</text>
            {/* 영종 연결 교량 */}
            <line x1="40" y1="300" x2="150" y2="300" className="m-bridge" />
            {/* 경인아라뱃길 */}
            <path d="M84 30 C240 34 420 22 640 26" className="m-canal" />
            <text x="470" y="18" className="m-lbl m-small">경인아라뱃길</text>
            {/* 공항고속도로 */}
            <path d="M40 92 C200 96 300 70 640 64" className="m-hwy" />
            <circle cx="208" cy="92" r="7" className="m-ic" />
            <text x="220" y="84" className="m-lbl">청라IC</text>
            {/* 공항철도 */}
            <path d="M40 368 C220 360 380 372 640 352" className="m-rail" />
            <circle cx="372" cy="368" r="8" className="m-stn" />
            <text x="386" y="396" className="m-lbl">청라국제도시역</text>
            {/* 호수공원 · 커낼웨이 */}
            <ellipse cx="330" cy="254" rx="150" ry="52" fill="#cfdccb" />
            <ellipse cx="330" cy="254" rx="118" ry="34" fill="#a9c2cf" />
            <path d="M448 246 C500 236 560 210 640 196" className="m-canal" />
            <text x="330" y="260" textAnchor="middle" className="m-lbl m-on-water">청라호수공원</text>
            <text x="560" y="194" className="m-lbl m-small">커낼웨이</text>
            {/* 사업지 */}
            <rect x="268" y="150" width="124" height="52" className="m-site" />
            <text x="330" y="182" textAnchor="middle" className="m-site-lbl">사업지</text>
          </svg>
          <figcaption>개념도 — 축척과 위치는 실제와 다릅니다. 실제 배치·거리는 인허가 도서로 확인합니다.</figcaption>
        </figure>

        <table className="tbl loc-tbl">
          <thead>
            <tr>
              <th>구분</th>
              <th>시설</th>
              <th>사업지와의 관계</th>
            </tr>
          </thead>
          <tbody>
            {INFRA.map((r) => (
              <tr key={r.name}>
                <td className="loc-cat">{r.cat}</td>
                <td>
                  <b>{r.name}</b>
                  <span className="sub">{r.note}</span>
                </td>
                <td>{r.rel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        행정구역 — {PROJECT.locationNote}. 실거래·청약 자료는 개편 전 기간을 옛 시군구코드(28260)로 함께 조회합니다.
      </p>
    </section>
  );
}

/* ───────── 03 단지안내 ───────── */

const PLAN_W = 640;
const PLAN_H = 360;
// 대지 플레이트 236 × 128 m → 도면 좌표
const sx = (x: number) => PLAN_W / 2 + x * 2.3;
const sz = (z: number) => 168 + z * 2.3;

export function SitePlan() {
  const total = UNIT_TYPES.reduce((s, t) => s + t.units, 0);
  const maxH = Math.max(...TOWERS.map((t) => PILOTI_H + t.floors * FLOOR_H));
  return (
    <section id="siteplan" className="doc-sec" data-shot="5">
      <SectionHead
        no="03"
        group="사업안내"
        title="단지안내"
        lede={`${PROJECT.scale} · ${PROJECT.households}세대. 호수 쪽 전열을 낮추고 후열을 29층까지 올려 전 동의 남측 조망을 확보한 매스 스터디입니다.`}
      />

      <div className="plan">
        <figure className="plan-fig">
          <svg viewBox={`0 0 ${PLAN_W} ${PLAN_H}`} role="img" aria-label="동 배치 매스 스터디">
            <title>동 배치 매스 스터디</title>
            <rect width={PLAN_W} height={PLAN_H} fill="#f2efe8" />
            <rect x={sx(-118)} y={sz(-62)} width={236 * 2.3} height={128 * 2.3} className="p-site" />
            <rect x={PLAN_W / 2 - 75 * 2.3} y={sz(-9)} width={150 * 2.3} height={26 * 2.3} className="p-lawn" />
            <rect x="0" y={PLAN_H - 18} width={PLAN_W} height="18" className="p-lake" />
            <text x={PLAN_W / 2} y={PLAN_H - 5} textAnchor="middle" className="p-lake-lbl">청라호수공원 (남측)</text>
            {TOWERS.map((t, i) => (
              <g key={i} transform={`translate(${sx(t.x)} ${sz(t.z)}) rotate(${(-t.rot * 180) / Math.PI})`}>
                <rect x={(-t.w * 2.3) / 2} y={(-t.d * 2.3) / 2} width={t.w * 2.3} height={t.d * 2.3} className="p-tower" />
                <text y="-2" textAnchor="middle" className="p-dong">{101 + i}동</text>
                <text y="14" textAnchor="middle" className="p-fl">{t.floors}층</text>
              </g>
            ))}
            <g className="p-north" transform={`translate(${PLAN_W - 34} 34)`}>
              <circle r="16" />
              <path d="M0 -11 L5 6 L0 2 L-5 6 Z" />
              <text y="-20" textAnchor="middle">북</text>
            </g>
          </svg>
          <figcaption>연면적·층수에 맞춘 매스 스터디이며 실제 배치도가 아닙니다. 동 번호는 설명용입니다.</figcaption>
        </figure>

        <div className="plan-side">
          <h3 className="h3">동별 층수</h3>
          <div className="bars">
            {TOWERS.map((t, i) => (
              <div key={i} className="bar-row">
                <span className="bar-k">{101 + i}동</span>
                <span className="bar-track">
                  <i style={{ width: `${((PILOTI_H + t.floors * FLOOR_H) / maxH) * 100}%` }} />
                </span>
                <span className="bar-v">{t.floors}층</span>
              </div>
            ))}
          </div>

          <h3 className="h3">타입 구성</h3>
          <div className="bars">
            {UNIT_TYPES.map((t) => (
              <div key={t.type} className="bar-row">
                <span className="bar-k">{t.type}</span>
                <span className="bar-track gold">
                  <i style={{ width: `${(t.units / total) * 100}%` }} />
                </span>
                <span className="bar-v">
                  {t.units}세대 <small>{((t.units / total) * 100).toFixed(1)}%</small>
                </span>
              </div>
            ))}
          </div>
          <p className="note">
            전 타입 전용 85㎡ 이하. 근린생활시설 {COMMERCIAL.units}호 · 공급 {m(COMMERCIAL.supplyPy, 1)}평 별도.
          </p>
        </div>
      </div>
    </section>
  );
}
