"use client";

// Cena 3D do piloto sobre o mapa real do Centro de São Luís: contorno da costa
// e dos rios Anil e Bacanga do OpenStreetMap (scripts/gerar-mapa-fiscalizacao.py)
// e um farol por obra no endereço do contrato. Altura do farol pelo valor;
// carmim = sem relato aprovado, dourado = já explorada pela comunidade.
// Endereço aproximado (só o bairro) ganha um círculo translúcido de incerteza.
// A lista de missões abaixo da cena é a alternativa acessível.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Missao } from "@/lib/fiscalizacao";
import mapa from "@/lib/mapa-centro-sao-luis.json";

const CARMIM = 0xc8102e;
const DOURADO = 0xe2b100;
const COBALTO = 0x1b3a8b;
const PAPEL = 0xf7f3ec;
const M = 100; // metros por unidade da cena

type Ponto = [number, number];
type Terra = { externo: Ponto[]; furos: Ponto[][] };
type ObraGeo = { x: number; y: number; local: string; aproximado: boolean };
const TERRA = (mapa as unknown as { terra: Terra[] }).terra;
export const OBRAS_GEO = (mapa as unknown as { obras: Record<string, ObraGeo> }).obras;

// metros (x leste, y norte) -> cena (x, z) com norte para o fundo
const cx = (x: number) => x / M;
const cz = (y: number) => -y / M;

function dentro(x: number, y: number, anel: Ponto[]): boolean {
  let d = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i], [xj, yj] = anel[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
function emTerra(x: number, y: number): boolean {
  return TERRA.some((t) => dentro(x, y, t.externo) && !t.furos.some((f) => dentro(x, y, f)));
}

function rotulo(texto: string, cor = "#9fb4e0", tamanho = 44): THREE.Sprite {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = `600 ${tamanho}px Georgia, serif`;
  c.width = Math.ceil(ctx.measureText(texto).width) + 20;
  c.height = tamanho + 20;
  ctx.font = `600 ${tamanho}px Georgia, serif`;
  ctx.fillStyle = cor;
  ctx.textBaseline = "middle";
  ctx.fillText(texto, 10, c.height / 2);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  s.scale.set(c.width / 70, c.height / 70, 1);
  return s;
}

export default function CenaMissoes({
  missoes,
  exploradas,
  selecionada,
  onSelecionar,
}: {
  missoes: Missao[];
  exploradas: Set<string>;
  selecionada: string | null;
  onSelecionar: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selRef = useRef<string | null>(selecionada);
  const cbRef = useRef(onSelecionar);
  selRef.current = selecionada;
  cbRef.current = onSelecionar;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const noMapa = missoes.filter((m) => OBRAS_GEO[m.id]);

    const cena = new THREE.Scene();
    cena.background = new THREE.Color(0x0b0b0c);
    cena.fog = new THREE.Fog(0x0b0b0c, 30, 70);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "Mapa 3D do Centro de São Luís, entre os rios Anil e Bacanga, com um farol em cada obra de patrimônio a fiscalizar",
    );

    cena.add(new THREE.HemisphereLight(0xfff4e0, 0x0b1430, 0.95));
    const sol = new THREE.DirectionalLight(0xffe2b0, 1.3);
    sol.position.set(10, 20, 8);
    cena.add(sol);

    // Água (baía e rios) e terra extrudada a partir do contorno real
    const agua = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x0c1a33, roughness: 0.6, metalness: 0.1 }),
    );
    agua.rotation.x = -Math.PI / 2;
    agua.position.y = -0.05;
    cena.add(agua);
    const matTerra = new THREE.MeshStandardMaterial({ color: 0x2f5d3a, flatShading: true, roughness: 1 });
    for (const t of TERRA) {
      const forma = new THREE.Shape(t.externo.map(([x, y]) => new THREE.Vector2(cx(x), -cz(y))));
      forma.holes = t.furos.map((f) => new THREE.Path(f.map(([x, y]) => new THREE.Vector2(cx(x), -cz(y)))));
      const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.35, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      cena.add(new THREE.Mesh(geo, matTerra));
    }

    // Casarões de azulejo, só onde há terra, em torno do Centro Histórico
    const corpo = new THREE.BoxGeometry(0.42, 0.38, 0.42);
    const telhado = new THREE.ConeGeometry(0.36, 0.22, 4);
    const matTelha = new THREE.MeshStandardMaterial({ color: 0xb4532a, flatShading: true });
    const matAzul = new THREE.MeshStandardMaterial({ color: COBALTO, flatShading: true });
    const matCal = new THREE.MeshStandardMaterial({ color: PAPEL, flatShading: true });
    let semente = 7;
    const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (let n = 0, tent = 0; n < 70 && tent < 600; tent++) {
      const x = -500 + rnd() * 1300, y = -1300 + rnd() * 1800;
      if (!emTerra(x, y)) continue;
      n++;
      const casa = new THREE.Mesh(corpo, rnd() < 0.35 ? matAzul : matCal);
      casa.position.set(cx(x), 0.35 + 0.19, cz(y));
      const t = new THREE.Mesh(telhado, matTelha);
      t.position.set(cx(x), 0.35 + 0.49, cz(y));
      t.rotation.y = Math.PI / 4;
      cena.add(casa, t);
    }

    // Nomes de referência
    const nomes: [string, number, number, string?][] = [
      ["Rio Anil", 1700, 1150],
      ["Rio Bacanga", -700, -1900],
      ["Baía de São Marcos", -2300, 1400],
      ["Centro Histórico", -150, 260, "#F7F3EC"],
    ];
    for (const [txt, x, y, cor] of nomes) {
      const s = rotulo(txt, cor);
      s.position.set(cx(x), 1.6, cz(y));
      cena.add(s);
    }

    // Faróis das missões
    const clicaveis: THREE.Object3D[] = [];
    const farois: { id: string; grupo: THREE.Group; topo: THREE.Mesh; anel: THREE.Mesh }[] = [];
    let soma = new THREE.Vector3();
    for (const m of noMapa) {
      const g = OBRAS_GEO[m.id];
      const cor = exploradas.has(m.id) ? DOURADO : CARMIM;
      const altura = 1 + Math.max(0, Math.log10(Math.max(m.contrato.valor, 1)) - 4) * 0.9;
      const grupo = new THREE.Group();
      grupo.position.set(cx(g.x), 0.36, cz(g.y));
      soma = soma.add(grupo.position);
      const coluna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, altura, 12),
        new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.8 }),
      );
      coluna.position.y = altura / 2;
      const topo = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28),
        new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 1.2, flatShading: true }),
      );
      topo.position.y = altura + 0.35;
      const anel = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.38, 32),
        new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
      );
      anel.rotation.x = -Math.PI / 2;
      anel.position.y = 0.03;
      grupo.add(coluna, topo, anel);
      if (g.aproximado) {
        const zona = new THREE.Mesh(
          new THREE.CircleGeometry(2.5, 40),
          new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.12, depthWrite: false }),
        );
        zona.rotation.x = -Math.PI / 2;
        zona.position.y = 0.02;
        grupo.add(zona);
      }
      [coluna, topo].forEach((o) => {
        o.userData.missao = m.id;
        clicaveis.push(o);
      });
      cena.add(grupo);
      farois.push({ id: m.id, grupo, topo, anel });
    }
    const centro = noMapa.length ? soma.divideScalar(noMapa.length) : new THREE.Vector3();

    // Interação: arrastar gira a câmera; toque/clique curto seleciona farol
    const ray = new THREE.Raycaster();
    const ponteiro = new THREE.Vector2();
    let hover: string | null = null;
    let angulo = 0.9;
    let arrasto: { x: number; ang: number; moveu: boolean } | null = null;
    const alvo = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ponteiro, camera);
      return (ray.intersectObjects(clicaveis, false)[0]?.object.userData.missao as string | undefined) ?? null;
    };
    const baixo = (ev: PointerEvent) => {
      arrasto = { x: ev.clientX, ang: angulo, moveu: false };
      renderer.domElement.setPointerCapture(ev.pointerId);
    };
    const mover = (ev: PointerEvent) => {
      if (arrasto) {
        const dx = ev.clientX - arrasto.x;
        if (Math.abs(dx) > 4) arrasto.moveu = true;
        angulo = arrasto.ang - dx * 0.008;
      }
      hover = alvo(ev);
      renderer.domElement.style.cursor = hover ? "pointer" : arrasto ? "grabbing" : "grab";
    };
    const cima = (ev: PointerEvent) => {
      const foiClique = arrasto && !arrasto.moveu;
      arrasto = null;
      if (foiClique) {
        const id = alvo(ev);
        if (id) cbRef.current(id);
      }
    };
    const el = renderer.domElement;
    el.addEventListener("pointerdown", baixo);
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", cima);

    const ajustar = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(ajustar);
    ro.observe(host);
    ajustar();

    let quadro = 0;
    const relogio = new THREE.Clock();
    const escalaAlvo = new THREE.Vector3();
    const animar = () => {
      const dt = relogio.getDelta();
      const t = relogio.elapsedTime;
      if (!reduzir && !arrasto) angulo += dt * 0.05;
      camera.position.set(centro.x + Math.cos(angulo) * 20, 13, centro.z + Math.sin(angulo) * 20);
      camera.lookAt(centro.x, 0.5, centro.z);
      for (const f of farois) {
        const ativo = f.id === selRef.current || f.id === hover;
        const e = ativo ? 1.5 : 1;
        f.grupo.scale.lerp(escalaAlvo.set(e, e, e), 0.15);
        if (!reduzir) {
          f.topo.rotation.y = t * 1.5;
          const p = 1 + ((t * 0.8 + f.grupo.position.x) % 1) * 1.8;
          f.anel.scale.set(p, p, p);
          (f.anel.material as THREE.MeshBasicMaterial).opacity = 0.9 - (p - 1) / 2;
        }
      }
      renderer.render(cena, camera);
      quadro = requestAnimationFrame(animar);
    };
    animar();

    return () => {
      cancelAnimationFrame(quadro);
      ro.disconnect();
      el.removeEventListener("pointerdown", baixo);
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", cima);
      cena.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          (x as THREE.SpriteMaterial).map?.dispose();
          x.dispose();
        });
      });
      renderer.dispose();
      host.removeChild(el);
    };
  }, [missoes, exploradas]);

  return (
    <div className="relative">
      <div ref={ref} className="h-[380px] w-full overflow-hidden rounded-2xl sm:h-[480px]" />
      <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-white/45">
        Mapa: © colaboradores do OpenStreetMap
      </p>
    </div>
  );
}
