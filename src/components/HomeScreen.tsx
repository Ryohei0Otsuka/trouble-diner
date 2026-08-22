import type { Area, Scenario } from "../types";

interface Props {
  areas: Area[];
  scenarios: Scenario[];
  onSelectArea: (area: Area) => void;
}

const hotspotPosition: Record<string, { left: string; top: string }> = {
  floor: { left: "28%", top: "68%" },
  kitchen: { left: "52%", top: "26%" },
  register: { left: "69%", top: "61%" },
  stock: { left: "74%", top: "25%" },
  delivery: { left: "88%", top: "31%" },
  facility: { left: "88%", top: "74%" },
  staff: { left: "27%", top: "22%" },
  other: { left: "51%", top: "81%" },
};

export function HomeScreen({ areas, scenarios, onSelectArea }: Props) {
  return (
    <section className="home-screen screen-wrap">
      <div className="hero-copy">
        <div><p className="pixel-kicker">SELECT AREA</p><h1>お店のどこで<br />トラブル発生？</h1><p>エリアをタップして、対応フローを開始しよう。</p></div>
        <img className="hero-mascot" src="./assets/crew-mascot.png" alt="クリップボードを持つクルー" />
      </div>

      <div className="restaurant-map" aria-label="ドット絵の店内マップ">
        <img src="./assets/restaurant-map.png" alt="ホール、厨房、レジなどがある架空の飲食店" />
        <div className="map-shade" />
        {areas.map((area) => (
          <button
            key={area.id}
            className={`map-hotspot ${area.slug}`}
            style={{ ...hotspotPosition[area.slug], "--area-color": area.color } as React.CSSProperties}
            onClick={() => onSelectArea(area)}
          >
            <span>{area.icon}</span><b>{area.name}</b><small>{scenarios.filter((item) => item.areaId === area.id).length}</small>
          </button>
        ))}
      </div>

      <div className="area-list-heading"><span>AREA LIST</span><strong>一覧から選ぶ</strong></div>
      <div className="area-grid">
        {areas.map((area) => (
          <button key={area.id} className="area-card" style={{ "--area-color": area.color } as React.CSSProperties} onClick={() => onSelectArea(area)}>
            <span className="area-icon">{area.icon}</span>
            <span className="area-copy"><small>{area.shortName}</small><strong>{area.name}</strong><em>{area.description}</em></span>
            <span className="quest-count">{scenarios.filter((item) => item.areaId === area.id).length}<small>FLOW</small></span>
          </button>
        ))}
      </div>

      <div className="poc-notice"><span>!</span><p><strong>FICTIONAL PoC</strong> 本作は架空の飲食店を題材にした模擬練習です。実在企業・実業務・実データとは関係ありません。</p></div>
    </section>
  );
}
