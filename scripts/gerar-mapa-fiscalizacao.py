"""
Gera o mapa do piloto de fiscalização cidadã (frontend/src/lib/mapa-centro-sao-luis.json).

- Contorno da costa: ilha Upaon-Açu (Ilha de São Luís) no OpenStreetMap, via
  Nominatim, recortado na região do Centro, MENOS as áreas de água do OSM
  (Overpass: Rio Anil, Rio Bacanga, Lagoa da Jansen etc.). Sem subtrair os
  rios, o polígono da ilha mostra o Centro como terra contínua.
  Dados © colaboradores do OpenStreetMap, licença ODbL — o crédito aparece na tela.
- Posição de cada obra: endereço citado no próprio contrato, geocodificado no
  OpenStreetMap em 27/10/2026. Quando o contrato não traz endereço que o OSM
  encontre, usa o bairro e marca "aproximado".

Coordenadas saem em metros, relativas a um ponto de origem no Centro
(x = leste, y = norte), prontas para o Three.js.

Uso: python3 scripts/gerar-mapa-fiscalizacao.py
"""

import json
import math
import time
from pathlib import Path

import httpx
from shapely.geometry import LineString, box, shape
from shapely.ops import polygonize, unary_union

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "frontend" / "src" / "lib" / "mapa-centro-sao-luis.json"
UA = {"User-Agent": "PortalTransparenciaCultural/1.0 (contato@10dobroprod.com.br)"}

# Origem do sistema local: Praça João Lisboa.
ORIGEM_LAT, ORIGEM_LON = -2.5291, -44.3032
# Recorte: ~5 km em torno do Centro.
BBOX = (-44.335, -2.555, -44.270, -2.500)  # lon_min, lat_min, lon_max, lat_max

# id do contrato no PNCP -> (lat, lon, local exibido, aproximado?)
OBRAS = {
    "06307102000130-2-000679/2026": (-2.5344761, -44.3011069, "Mercado Central — Praia Grande", False),
    "06307102000130-2-000900/2026": (-2.5308355, -44.2992419, "Antigo Orfanato Santa Luzia — Centro", True),
    "06307102000130-2-000811/2026": (-2.5287209, -44.3037842, "Rua de Nazaré, 135 — Centro", False),
    "06307102000130-2-000236/2025": (-2.5308835, -44.3057027, "Logradouros do Centro Histórico — Praia Grande", True),
    "06307102000130-2-001202/2026": (-2.5290836, -44.3032416, "Fachadas azulejadas — Praça João Lisboa e entorno", False),
    "06307102000130-2-000010/2025": (-2.5405771, -44.2982846, "Av. dos Gaviões, 173 — Madre Deus", True),
    "06307102000130-2-000794/2026": (-2.5284840, -44.3045450, "Escadarias da Praça Benedito Leite", False),
    "06307102000130-2-000094/2024": (-2.5291304, -44.3034540, "Igreja do Rosário dos Pretos — Rua do Egito", False),
}


def para_metros(lat: float, lon: float) -> tuple[float, float]:
    x = (lon - ORIGEM_LON) * 111_320 * math.cos(math.radians(ORIGEM_LAT))
    y = (lat - ORIGEM_LAT) * 110_574
    return round(x, 1), round(y, 1)


def aguas_osm():
    """Polígonos de água (natural=water) no recorte, montados a partir das vias."""
    lon0, lat0, lon1, lat1 = BBOX
    q = (f'[out:json][timeout:90];(way["natural"="water"]({lat0},{lon0},{lat1},{lon1});'
         f'relation["natural"="water"]({lat0},{lon0},{lat1},{lon1}););out geom;')
    elementos = None
    # O Overpass público costuma responder "ocupado" — tenta de novo e em espelho.
    for tentativa in range(6):
        url = ["https://overpass-api.de/api/interpreter",
               "https://maps.mail.ru/osm/tools/overpass/api/interpreter"][tentativa % 2]
        try:
            r = httpx.post(url, data={"data": q}, headers=UA, timeout=180)
            if r.status_code == 200 and r.text.lstrip().startswith("{"):
                elementos = r.json()["elements"]
                break
        except httpx.HTTPError:
            pass
        time.sleep(10 * (tentativa + 1))
    if elementos is None:
        raise SystemExit("Overpass indisponível — tente de novo mais tarde.")
    linhas = []
    for el in elementos:
        if el["type"] == "way" and el.get("geometry"):
            linhas.append(LineString([(g["lon"], g["lat"]) for g in el["geometry"]]))
        for m in el.get("members", []):
            if m.get("role") == "outer" and m.get("geometry"):
                linhas.append(LineString([(g["lon"], g["lat"]) for g in m["geometry"]]))
    return unary_union(list(polygonize(unary_union(linhas))))


def main() -> None:
    r = httpx.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": "Upaon-Açu", "format": "json", "limit": 1,
                "polygon_geojson": 1, "polygon_threshold": 0.0001},
        headers=UA, timeout=120,
    )
    ilha = shape(r.json()[0]["geojson"]).intersection(box(*BBOX))
    ilha = ilha.difference(aguas_osm()).simplify(0.00005)
    poligonos = [ilha] if ilha.geom_type == "Polygon" else list(ilha.geoms)

    terra = []
    for p in poligonos:
        if p.area < 1e-6:
            continue
        externo = [para_metros(lat, lon) for lon, lat in p.exterior.coords]
        furos = [[para_metros(lat, lon) for lon, lat in f.coords] for f in p.interiors]
        terra.append({"externo": externo, "furos": furos})

    obras = {
        cid: {"x": para_metros(lat, lon)[0], "y": para_metros(lat, lon)[1],
              "local": local, "aproximado": aprox, "lat": lat, "lon": lon}
        for cid, (lat, lon, local, aprox) in OBRAS.items()
    }

    SAIDA.write_text(json.dumps({
        "fonte": "© colaboradores do OpenStreetMap (ODbL)",
        "origem": {"lat": ORIGEM_LAT, "lon": ORIGEM_LON, "nome": "Praça João Lisboa"},
        "terra": terra,
        "obras": obras,
    }, ensure_ascii=False), encoding="utf-8")
    pontos = sum(len(t["externo"]) for t in terra)
    print(f"{SAIDA.relative_to(RAIZ)}: {len(terra)} polígono(s), {pontos} pontos, {len(obras)} obras")


if __name__ == "__main__":
    main()
