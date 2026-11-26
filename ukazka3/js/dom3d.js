/* 3D prehliadka domu typu B – Pod Lipami (ukážka) */
import * as THREE from './three.module.min.js';
import { OrbitControls } from './OrbitControls.js';
import { RoomEnvironment } from './RoomEnvironment.js';

const H = 2.5;                    // výška stien
const HW = 16.6, HD = 9.2;        // rozmer domu (m)

/* miestnosti: názov, x, y, šírka, hĺbka, podlaha, foto, popis, pin */
const IZBY = [
  ['Obývačka s kuchyňou',0,0,8,5.8,'dub','obyvacka','Kuchyňa s ostrovčekom, jedálenský stôl pri posuvnej stene a obývacia časť. Z obývačky vyjdete priamo na krytú terasu.',1],
  ['Spálňa',8,0,4.2,4,'dub','spalna','Manželská spálňa s veľkým oknom do záhrady a vstavanou skriňou.',1],
  ['Izba do záhrady',12.2,0,4.4,4,'dub',null,'Najväčšia izba s oknami na dve strany, do záhrady aj na bok domu.',1],
  ['Chodba',8,4,8.6,1.4,'dub',null,'Chodba spája obývačku so spálňou, izbami a kúpeľňou.',0],
  ['Technická miestnosť',0,5.8,3,3.4,'dlazba',null,'Tepelné čerpadlo, práčka a sušička. Dvere vedú priamo do garáže.',0],
  ['Zádverie',3,5.8,3,3.4,'dlazba',null,'Vstup z ulice s lavicou a skrinkou na topánky. Odtiaľ je to pár krokov do obývačky.',1],
  ['Šatník',6,5.8,2,3.4,'dub',null,'Šatník s policami hneď pri vstupe.',0],
  ['Kúpeľňa',8,5.4,2.8,3.8,'dlazba','kupelna','Kúpeľňa s vaňou a umývadlom. Hneď vedľa je samostatný sprchový kút a WC.',1],
  ['WC',10.8,5.4,1.4,1.8,'dlazba',null,'Samostatné WC s umývadielkom.',0],
  ['Sprchový kút',10.8,7.2,1.4,2,'dlazba','kupelna','Sprchový kút bez vaničky so sklenenou stenou.',0],
  ['Detská izba',12.2,5.4,2.2,3.8,'dub',null,'Izba do ulice s miestom na posteľ a písací stôl.',1],
  ['Pracovňa',14.4,5.4,2.2,3.8,'dub',null,'Izba s oknom na bok domu, vhodná ako pracovňa alebo izba pre hostí.',1],
];
const EXTRA = [
  ['Garáž',-4.2,2.8,4.2,6.2,'betón',null,'Garáž pre jedno auto. Dvere vedú do technickej miestnosti, takže nákup prenesiete suchou nohou.',1, 22],
  ['Krytá terasa',0,-3,9,2.6,'terasa',null,'Krytá terasa s výstupom z obývačky. Za ňou je záhrada s lipou.',1, 30],
];

/* otvory: smer (h = vodorovná stena na y, v = zvislá na x), poloha, od, do, typ, parapet, horná hrana */
const OTVORY = [
  ['h',0,0.6,7.4,'sklo'], ['h',0,9.2,11.2,'okno',0.5,2.2], ['h',0,13.4,15.4,'okno',0.9,2.2],
  ['h',9.2,1.0,2.0,'okno',1.5,2.2], ['h',9.2,4.0,5.0,'vchod'], ['h',9.2,8.8,9.8,'okno',1.5,2.2],
  ['h',9.2,12.8,13.8,'okno',0.9,2.2], ['h',9.2,15.0,16.0,'okno',0.9,2.2],
  ['v',16.6,1.2,2.8,'okno',0.9,2.2], ['v',16.6,6.6,8.0,'okno',0.9,2.2], ['v',0,0.8,2.2,'okno',1.0,2.2],
  ['h',5.8,4.0,5.0,'dvere'], ['v',3,7.0,7.8,'dvere'], ['v',6,7.0,7.8,'dvere'], ['v',8,4.3,5.2,'dvere'],
  ['h',4,9.0,9.8,'dvere'], ['h',4,13.5,14.3,'dvere'], ['h',5.4,9.2,10.0,'dvere'], ['h',5.4,11.1,11.9,'dvere'],
  ['v',10.8,7.6,8.4,'dvere'], ['h',5.4,12.9,13.7,'dvere'], ['h',5.4,15.1,15.9,'dvere'], ['v',0,7.0,7.8,'dvere'],
];

const u = v => Math.round(v * 5);   // mriežka 20 cm

function texDrevo(farba, svetla, sirka){
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = farba; g.fillRect(0,0,512,512);
  const pocet = Math.round(512 / sirka);
  for (let i = 0; i < pocet; i++){
    for (let j = 0; j < 3; j++){
      const y0 = i * sirka, x0 = ((i * 211 + j * 170) % 512);
      g.fillStyle = `rgba(${svetla},${(((i*7+j*13)%10)/10*0.14).toFixed(3)})`;
      g.fillRect(x0, y0, 512, sirka); g.fillRect(x0 - 512, y0, 512, sirka);
      g.fillStyle = 'rgba(60,40,20,.18)'; g.fillRect(x0, y0, 2, sirka);
    }
    g.fillStyle = 'rgba(60,40,20,.22)'; g.fillRect(0, i * sirka, 512, 1.5);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function texDlazba(farba, mriezka){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = farba; g.fillRect(0,0,256,256);
  g.strokeStyle = mriezka; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 128){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,256); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(256,i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function spusti(opt){
  const { canvas, piny, panel, nacitanie, ovladanie } = opt;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false }); }
  catch (e) { opt.chyba && opt.chyba(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  scena.background = new THREE.Color('#EEF0EA');
  scena.fog = new THREE.Fog('#EEF0EA', 40, 75);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scena.environmentIntensity = 0.55;

  const kamera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const STRED = new THREE.Vector3(6.2, 0, 3.6);
  const POHLAD = { cely: new THREE.Vector3(13, 20, 21), zhora: new THREE.Vector3(0.01, 30, 2.5) };
  kamera.position.copy(STRED).add(POHLAD.cely);
  const ovl = new OrbitControls(kamera, canvas);
  ovl.target.copy(STRED); ovl.enableDamping = true; ovl.dampingFactor = 0.08;
  ovl.minDistance = 5; ovl.maxDistance = 48; ovl.maxPolarAngle = 1.32; ovl.screenSpacePanning = false;
  ovl.update();

  /* svetlá */
  scena.add(new THREE.HemisphereLight('#FFFFFF', '#B8C2A8', 0.75));
  const slnko = new THREE.DirectionalLight('#FFF4E2', 2.3);
  slnko.position.set(-10, 22, 14); slnko.target.position.copy(STRED); scena.add(slnko.target);
  slnko.castShadow = true; slnko.shadow.mapSize.set(2048, 2048);
  Object.assign(slnko.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 60 });
  slnko.shadow.bias = -0.0004; slnko.shadow.normalBias = 0.02; slnko.shadow.radius = 4;
  scena.add(slnko);

  /* materiály */
  const M = (farba, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: farba, roughness: 0.85 }, o));
  const mat = {
    stena: M('#F7F6F2', { roughness: 0.95 }), rez: M('#6A7063', { roughness: 1 }),
    smrek: M('#A27248', { roughness: 0.8 }), sklo: new THREE.MeshPhysicalMaterial({ color: '#D6E7EC', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false }),
    ram: M('#3B3F38', { roughness: 0.6 }), dub: M('#C8A47A', { roughness: 0.7 }), dubTm: M('#9D7650', { roughness: 0.7 }),
    biela: M('#FAFAF7', { roughness: 0.5 }), salvia: M('#8EA38A', { roughness: 0.6 }), kremen: M('#F1EFEA', { roughness: 0.25 }),
    lan: M('#D9D3C7', { roughness: 1 }), lanTm: M('#BFB6A6', { roughness: 1 }), koberec: M('#E7E0D3', { roughness: 1 }),
    perina: M('#F3F0EA', { roughness: 1 }), plech: M('#454E56', { roughness: 0.35, metalness: 0.6 }), guma: M('#222', { roughness: 0.9 }),
    tmSklo: M('#273038', { roughness: 0.1, metalness: 0.3 }), keramika: M('#FFFFFF', { roughness: 0.2 }),
    list: M('#6E8F5A', { roughness: 0.9 }), kmen: M('#7A6250'), kvetinac: M('#C7BBA8'),
    travnik: M('#AEBF92', { roughness: 1 }), chodnik: M('#D3CEC4', { roughness: 0.95 }), doska: M('#D9D5CC', { roughness: 1 }),
    vonkajsi: M('#3E4339', { roughness: 0.7 }),
  };
  const tDub = texDrevo('#BE9466', '255,236,205', 26), tTer = texDrevo('#9C7653', '255,230,200', 22);
  const tDlazba = texDlazba('#DAD6CD', 'rgba(120,112,100,.35)'), tBeton = texDlazba('#C9C6BF', 'rgba(110,105,98,.18)');
  const podlahy = { dub: [tDub, 1.6], dlazba: [tDlazba, 1.2], 'betón': [tBeton, 2.4], terasa: [tTer, 1.4] };

  const dom = new THREE.Group(); scena.add(dom);
  const tien = m => { m.castShadow = true; m.receiveShadow = true; return m; };
  function box(x1, z1, x2, z2, y, h, m, kam = dom){
    const g = new THREE.BoxGeometry(Math.abs(x2 - x1), h, Math.abs(z2 - z1));
    const o = tien(new THREE.Mesh(g, m)); o.position.set((x1 + x2) / 2, y + h / 2, (z1 + z2) / 2); kam.add(o); return o;
  }
  function valec(x, z, r, y, h, m, seg = 20){
    const o = tien(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m)); o.position.set(x, y + h / 2, z); dom.add(o); return o;
  }

  /* okolie */
  const zem = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat.travnik);
  zem.rotation.x = -Math.PI / 2; zem.position.set(STRED.x, -0.06, STRED.z); zem.receiveShadow = true; scena.add(zem);
  box(-0.15, -0.15, HW + 0.15, HD + 0.15, -0.3, 0.3, mat.doska);
  box(-4.35, 2.65, 0, 9.15, -0.3, 0.3, mat.doska);
  box(-4.2, 9.15, 0, 13.5, -0.06, 0.05, mat.chodnik);            // príjazd
  for (let z = 9.6; z < 13.4; z += 0.75) box(4.0, z, 5.0, z + 0.55, -0.06, 0.05, mat.chodnik);
  box(-6, 13.5, 22, 15.5, -0.06, 0.04, mat.chodnik);              // chodník pri ulici

  /* podlahy */
  const podlahyM = [];
  const vsetky = IZBY.map((r, i) => ({ r, i, plocha: r[3] * r[4] })).concat(EXTRA.map((r, j) => ({ r, i: IZBY.length + j, plocha: r[9] })));
  vsetky.forEach(({ r, i }) => {
    const [, x, y, w, d, typ] = r, [tex, kr] = podlahy[typ];
    const g = new THREE.PlaneGeometry(w, d), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / kr, uv.getY(k) * d / kr);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: typ === 'dlazba' ? 0.35 : 0.75, emissive: '#3E6B3A', emissiveIntensity: 0 });
    const o = new THREE.Mesh(g, m); o.rotation.x = -Math.PI / 2;
    o.position.set(x + w / 2, typ === 'terasa' ? 0.05 : 0.005, y + d / 2); o.receiveShadow = true;
    o.userData.izba = i; dom.add(o); podlahyM.push(o);
    if (typ === 'terasa') box(x, y, x + w, y + d, -0.06, 0.1, mat.dubTm);
  });

  /* steny z obrysov miestností */
  const steny = new THREE.Group(); dom.add(steny);
  const hran = new Map();               // kľúč: smer|linka|jednotka
  const pridaj = (s, l, a, b) => { for (let k = u(a); k < u(b); k++) hran.set(`${s}|${u(l)}|${k}`, 'plna'); };
  IZBY.forEach(([, x, y, w, d]) => { pridaj('h', y, x, x + w); pridaj('h', y + d, x, x + w); pridaj('v', x, y, y + d); pridaj('v', x + w, y, y + d); });
  const info = new Map();
  OTVORY.forEach(([s, l, a, b, typ, par, hor]) => { for (let k = u(a); k < u(b); k++){ const key = `${s}|${u(l)}|${k}`; if (hran.has(key)){ hran.set(key, typ); info.set(key, [par, hor]); } } });
  const capy = [mat.stena, mat.stena, mat.rez, mat.stena, mat.stena, mat.stena];
  function kus(s, l, a, b, y, h, m, t){
    if (h <= 0.001) return;
    const g = s === 'h' ? new THREE.BoxGeometry(b - a, h, t) : new THREE.BoxGeometry(t, h, b - a);
    const o = new THREE.Mesh(g, m === mat.stena ? capy : m);
    if (m !== mat.sklo) { o.castShadow = true; o.receiveShadow = true; }
    const c = (a + b) / 2; o.position.set(s === 'h' ? c : l, y + h / 2, s === 'h' ? l : c); steny.add(o);
  }
  const zoskup = {};
  for (const [key, typ] of hran){ const [s, l, k] = key.split('|'); (zoskup[s + '|' + l] ||= []).push([+k, typ, info.get(key)]); }
  for (const sk in zoskup){
    const [s, lu] = sk.split('|'), l = lu / 5, ext = s === 'h' ? (l === 0 || l === HD) : (l === 0 || l === HW), t = ext ? 0.3 : 0.12;
    const jed = zoskup[sk].sort((p, q) => p[0] - q[0]);
    let i = 0;
    while (i < jed.length){
      let j = i; while (j + 1 < jed.length && jed[j + 1][0] === jed[j][0] + 1 && jed[j + 1][1] === jed[i][1]) j++;
      let a = jed[i][0] / 5, b = (jed[j][0] + 1) / 5;
      const typ = jed[i][1], prvy = i === 0 || jed[i - 1][0] !== jed[i][0] - 1, posl = j === jed.length - 1 || jed[j + 1][0] !== jed[j][0] + 1;
      if (s === 'h' && typ === 'plna'){ if (prvy) a -= 0.15; if (posl) b += 0.15; }
      if (typ === 'plna') kus(s, l, a, b, 0, H, mat.stena, t);
      else if (typ === 'dvere' || typ === 'vchod'){ kus(s, l, a, b, 2.1, H - 2.1, mat.stena, t); }
      else if (typ === 'okno'){
        const [par, hor] = jed[i][2]; kus(s, l, a, b, 0, par, mat.stena, t); kus(s, l, a, b, hor, H - hor, mat.stena, t);
        kus(s, l, a, b, par, hor - par, mat.sklo, 0.03); kus(s, l, a, b, par - 0.04, 0.04, mat.ram, t + 0.02); kus(s, l, a, b, hor, 0.04, mat.ram, t + 0.02);
      } else if (typ === 'sklo'){
        kus(s, l, a, b, 2.35, H - 2.35, mat.stena, t); kus(s, l, a, b, 0, 2.35, mat.sklo, 0.03); kus(s, l, a, b, 2.31, 0.05, mat.ram, t);
        for (let x = a; x <= b + 0.001; x += (b - a) / 4) box(x - 0.03, l - 0.05, x + 0.03, l + 0.05, 0, 2.35, mat.ram, steny);
      }
      i = j + 1;
    }
  }
  /* garáž so smrekovcovým obkladom */
  box(-4.35, 2.65, -0.15, 2.95, 0, H, mat.smrek, steny);
  box(-4.35, 2.95, -4.05, 9.15, 0, H, mat.smrek, steny);
  box(-4.35, 8.85, -3.9, 9.15, 0, H, mat.smrek, steny); box(-0.45, 8.85, -0.15, 9.15, 0, H, mat.smrek, steny);
  box(-3.9, 8.85, -0.45, 9.15, 2.2, H - 2.2, mat.smrek, steny);
  box(-3.9, 8.95, -0.45, 9.05, 0, 0.06, mat.ram, steny);
  steny.children.forEach(o => { if (o.material === mat.smrek) o.material = [mat.smrek, mat.smrek, mat.rez, mat.smrek, mat.smrek, mat.smrek]; });

  /* nábytok – obývačka s kuchyňou */
  box(0.15, 2.4, 0.78, 5.0, 0, 0.88, mat.salvia); box(0.15, 2.38, 0.8, 5.02, 0.88, 0.04, mat.kremen);
  box(0.15, 5.0, 0.78, 5.65, 0, 2.2, mat.salvia);
  box(1.9, 2.8, 2.8, 4.8, 0, 0.88, mat.salvia); box(1.85, 2.75, 2.95, 4.85, 0.88, 0.04, mat.kremen);
  [3.2, 3.8, 4.4].forEach(z => { valec(3.2, z, 0.19, 0.62, 0.06, mat.dub); valec(3.2, z, 0.03, 0, 0.62, mat.ram, 8); });
  box(3.6, 0.9, 4.6, 2.6, 0.71, 0.05, mat.dub); box(3.65, 0.95, 4.55, 2.55, 0, 0.71, mat.dubTm).scale.set(0.12, 1, 0.12);
  [[3.35, 1.25], [3.35, 2.25], [4.85, 1.25], [4.85, 2.25]].forEach(([x, z]) => { box(x - 0.22, z - 0.22, x + 0.22, z + 0.22, 0.42, 0.06, mat.lan); box(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0, 0.42, mat.ram).scale.set(0.15, 1, 0.15); });
  box(4.9, 2.6, 7.5, 5.5, 0.005, 0.012, mat.koberec);
  box(5.2, 4.45, 7.25, 5.4, 0, 0.42, mat.lan); box(5.2, 5.1, 7.25, 5.4, 0.42, 0.42, mat.lanTm);
  box(6.4, 3.0, 7.25, 4.45, 0, 0.42, mat.lan); box(6.95, 3.0, 7.25, 4.45, 0.42, 0.42, mat.lanTm);
  box(5.4, 3.3, 6.15, 3.95, 0.36, 0.05, mat.dub); valec(5.78, 3.62, 0.05, 0, 0.36, mat.ram, 10);
  valec(0.6, 0.6, 0.22, 0, 0.42, mat.kvetinac); const k1 = valec(0.6, 0.6, 0.38, 0.42, 0.8, mat.list, 12); k1.geometry = new THREE.SphereGeometry(0.42, 16, 12); k1.position.y = 0.95;
  box(0.9, 5.3, 4.0, 5.65, 0, 0.5, mat.biela);                    // sideboard

  /* spálňa */
  box(10.0, 1.1, 12.0, 2.9, 0, 0.45, mat.biela); box(10.05, 1.12, 11.95, 2.88, 0.45, 0.14, mat.perina);
  box(10.1, 1.25, 10.55, 1.9, 0.59, 0.1, mat.koberec); box(10.1, 2.1, 10.55, 2.75, 0.59, 0.1, mat.koberec);
  box(11.98, 1.0, 12.08, 3.0, 0, 1.05, mat.lanTm);
  box(11.55, 0.55, 12.05, 1.0, 0, 0.5, mat.dub); box(11.55, 3.0, 12.05, 3.45, 0, 0.5, mat.dub);
  box(8.12, 0.3, 8.75, 2.9, 0, 2.2, mat.biela);
  box(9.3, 1.0, 10.0, 3.1, 0.005, 0.012, mat.koberec);
  /* izby */
  box(14.45, 0.2, 16.45, 1.15, 0, 0.42, mat.biela); box(14.5, 0.22, 16.4, 1.13, 0.42, 0.12, mat.perina);
  box(12.35, 0.15, 13.75, 0.75, 0.72, 0.04, mat.dub); box(12.4, 0.2, 13.7, 0.7, 0, 0.72, mat.ram).scale.set(0.05, 1, 1);
  box(12.9, 0.85, 13.3, 1.25, 0.44, 0.05, mat.salvia);
  box(16.0, 2.95, 16.45, 3.85, 0, 1.6, mat.biela);
  box(12.35, 7.0, 13.25, 9.05, 0, 0.42, mat.biela); box(12.4, 7.05, 13.2, 9.0, 0.42, 0.12, mat.perina);
  box(13.75, 5.9, 14.3, 7.1, 0.72, 0.04, mat.dub);
  box(15.55, 7.0, 16.45, 9.05, 0, 0.42, mat.biela); box(15.6, 7.05, 16.4, 9.0, 0.42, 0.12, mat.perina);
  box(14.55, 7.6, 15.1, 8.9, 0.72, 0.04, mat.dub);
  /* chodba, zádverie, šatník, technická */
  box(10.2, 4.4, 15.4, 5.0, 0.005, 0.012, mat.koberec);
  box(3.12, 7.95, 3.55, 9.0, 0, 0.45, mat.dub); box(5.45, 6.0, 5.88, 6.9, 0, 1.0, mat.biela);
  box(7.4, 6.0, 7.88, 9.0, 0, 2.2, mat.biela); box(6.12, 8.6, 7.4, 9.05, 0, 2.2, mat.biela);
  box(0.15, 6.0, 0.8, 6.7, 0, 1.9, mat.biela); box(1.0, 8.45, 1.62, 9.05, 0, 0.85, mat.biela); box(1.7, 8.45, 2.32, 9.05, 0, 0.85, mat.biela);
  valec(1.31, 8.43, 0.2, 0.42, 0.02, mat.tmSklo).rotation.x = Math.PI / 2;
  /* kúpeľňa, WC, sprcha */
  box(8.15, 8.3, 9.9, 9.05, 0, 0.56, mat.keramika);
  box(10.2, 6.0, 10.7, 7.6, 0, 0.82, mat.dub); box(10.18, 5.98, 10.72, 7.62, 0.82, 0.04, mat.keramika);
  valec(11.5, 6.85, 0.19, 0, 0.42, mat.keramika); box(11.3, 6.98, 11.7, 7.12, 0, 0.8, mat.keramika);
  box(10.95, 7.35, 12.1, 9.08, 0.005, 0.03, mat.kremen); box(11.3, 7.98, 12.1, 8.02, 0, 2.0, mat.sklo, steny);
  valec(11.6, 8.9, 0.012, 0, 2.05, mat.ram, 6);
  /* garáž */
  box(-3.2, 3.7, -1.3, 8.1, 0.22, 0.62, mat.plech); box(-3.05, 4.9, -1.45, 7.1, 0.84, 0.48, mat.tmSklo);
  [[-3.22, 4.5], [-1.28, 4.5], [-3.22, 7.3], [-1.28, 7.3]].forEach(([x, z]) => { const w = valec(x, z, 0.33, 0, 0.24, mat.guma); w.rotation.z = Math.PI / 2; w.position.y = 0.33; });
  box(-0.75, 3.2, -0.25, 5.6, 0, 1.8, mat.dub);
  /* terasa a záhrada */
  box(1.2, -2.3, 2.6, -1.3, 0.79, 0.04, mat.vonkajsi); valec(1.9, -1.8, 0.05, 0.05, 0.74, mat.vonkajsi, 8);
  [[1.0, -1.8], [2.8, -1.8], [1.9, -2.6], [1.9, -1.0]].forEach(([x, z]) => box(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0.05, 0.45, mat.vonkajsi));
  box(5.3, -2.75, 7.6, -1.95, 0.05, 0.38, mat.lan); box(5.3, -2.75, 7.6, -2.5, 0.43, 0.4, mat.lanTm);
  [0.08, 8.92].forEach(x => box(x - 0.06, -2.95, x + 0.06, -2.83, 0.05, H, mat.vonkajsi));
  function strom(x, z, s){ valec(x, z, 0.12 * s, 0, 2.2 * s, mat.kmen, 10); const k = new THREE.Mesh(new THREE.SphereGeometry(1.3 * s, 20, 16), mat.list); k.position.set(x, 2.9 * s, z); k.scale.y = 1.15; tien(k); dom.add(k); }
  strom(13.2, -2.6, 1.1); strom(2.2, 12.6, 0.9); strom(9.5, 12.6, 0.9); strom(17.8, 12.6, 0.9);
  for (let x = -5.5; x < 21.5; x += 0.9) box(x, -4.6, x + 0.8, -4.2, 0, 1.2, mat.list);   // živý plot

  /* piny */
  const PINY = [];
  vsetky.forEach(({ r, i, plocha }) => {
    if (!r[8]) return;
    const [nazov, x, y, w, d, , foto] = r;
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'pin3' + (foto ? ' sfoto' : '');
    el.setAttribute('aria-label', `${nazov}, ${plocha.toFixed(1).replace('.', ',')} m²${foto ? ', s fotkou' : ''}`);
    el.innerHTML = (foto ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>' : '<i aria-hidden="true"></i>') + `<span>${nazov.replace(' s kuchyňou', '')}</span>`;
    el.addEventListener('click', ev => { ev.stopPropagation(); vyber(i); });
    piny.appendChild(el);
    PINY.push({ el, i, p: new THREE.Vector3(x + w / 2, 1.0, y + d / 2) });
  });

  /* panel */
  const zoznam = panel.querySelector('[data-zoznam]'), detail = panel.querySelector('[data-detail]');
  zoznam.querySelector('ul').innerHTML = vsetky.map(({ r, i, plocha }) => `<li><button type="button" data-i="${i}"><span>${r[0]}${r[6] && r[0] !== 'Sprchový kút' ? ' <em>fotka</em>' : ''}</span><b>${plocha.toFixed(1).replace('.', ',')} m²</b></button></li>`).join('');
  zoznam.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => vyber(+b.dataset.i)));
  detail.querySelector('[data-spat]').addEventListener('click', () => vyber(-1));

  let aktivna = -1;
  const zmen = { od: null, do: null, t0: 0, dlzka: 900 };
  const redukcia = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function let_(cielT, cielP){
    zmen.od = [ovl.target.clone(), kamera.position.clone()]; zmen.do = [cielT, cielP]; zmen.t0 = performance.now();
    if (redukcia) zmen.t0 -= zmen.dlzka; kresli();
  }
  function vyber(i){
    aktivna = i;
    podlahyM.forEach(o => { o.material.emissiveIntensity = o.userData.izba === i ? 0.22 : 0; });
    PINY.forEach(p => p.el.classList.toggle('akt', p.i === i));
    if (i < 0){
      zoznam.hidden = false; detail.hidden = true;
      let_(STRED.clone(), STRED.clone().add(POHLAD.cely)); ovladanie.pohlad('cely'); return;
    }
    const { r, plocha } = vsetky[i], [nazov, x, y, w, d, , foto, popis] = r;
    detail.querySelector('h3').textContent = nazov;
    detail.querySelector('[data-plocha]').textContent = plocha.toFixed(1).replace('.', ',') + ' m²';
    detail.querySelector('p').textContent = popis;
    const f = detail.querySelector('figure');
    if (foto){
      f.hidden = false;
      f.querySelector('source').srcset = `img/${foto}.webp`; const im = f.querySelector('img'); im.src = `img/${foto}.jpg`;
      im.alt = `Vizualizácia: ${nazov.toLowerCase()}`; f.querySelector('figcaption').textContent = 'Vizualizácia interiéru';
    } else f.hidden = true;
    zoznam.hidden = true; detail.hidden = false;
    const c = new THREE.Vector3(x + w / 2, 0, y + d / 2), vel = Math.max(w, d, 3);
    const smer = kamera.position.clone().sub(ovl.target).setY(0).normalize();
    if (smer.lengthSq() < 0.01) smer.set(0.5, 0, 0.8).normalize();
    let_(c, c.clone().add(smer.multiplyScalar(vel * 1.5 + 3)).setY(vel * 1.7 + 5));
    ovladanie.pohlad(null);
    if (opt.vybrane) opt.vybrane(nazov);
  }

  /* klik na podlahu */
  const ray = new THREE.Raycaster(), mys = new THREE.Vector2();
  let dole = null, hover = -1;
  function trafa(ev){
    const b = canvas.getBoundingClientRect();
    mys.set(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(mys, kamera);
    const h = ray.intersectObjects(podlahyM, false)[0];
    return h ? h.object.userData.izba : -1;
  }
  canvas.addEventListener('pointerdown', ev => { dole = [ev.clientX, ev.clientY]; });
  canvas.addEventListener('pointerup', ev => {
    if (!dole) return; const dx = ev.clientX - dole[0], dy = ev.clientY - dole[1]; dole = null;
    if (dx * dx + dy * dy > 36) return;
    const i = trafa(ev); if (i >= 0) vyber(i);
  });
  canvas.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    const i = trafa(ev); if (i === hover) return; hover = i;
    canvas.style.cursor = i >= 0 ? 'pointer' : 'grab';
    podlahyM.forEach(o => { const id = o.userData.izba; o.material.emissiveIntensity = id === aktivna ? 0.22 : id === hover ? 0.1 : 0; });
    kresli();
  });

  /* ovládanie zvonka */
  const api = {
    pohlad(v){ vyber(-1); if (v === 'zhora'){ let_(STRED.clone(), STRED.clone().add(POHLAD.zhora)); } ovladanie.pohlad(v); },
    steny(nizke){ steny.scale.y = nizke ? 0.36 : 1; kresli(); },
    vyber,
  };

  /* veľkosť a kreslenie */
  const v3 = new THREE.Vector3();
  function velkost(){
    const b = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(b.width, b.height, false); kamera.aspect = b.width / b.height;
    kamera.fov = b.width < 640 ? 44 : 34; kamera.updateProjectionMatrix(); kresli();
  }
  let caka = false;
  function kresli(){ if (!caka){ caka = true; requestAnimationFrame(snimok); } }
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function snimok(){
    caka = false;
    let dalej = false;
    if (zmen.od){
      const t = Math.min(1, (performance.now() - zmen.t0) / zmen.dlzka), e = ease(t);
      ovl.target.lerpVectors(zmen.od[0], zmen.do[0], e); kamera.position.lerpVectors(zmen.od[1], zmen.do[1], e);
      if (t >= 1) zmen.od = null; else dalej = true;
    }
    if (ovl.update()) dalej = true;
    renderer.render(scena, kamera);
    const b = canvas.getBoundingClientRect();
    PINY.forEach(p => {
      v3.copy(p.p).project(kamera);
      const vid = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
      p.el.style.visibility = vid ? '' : 'hidden';
      p.el.style.transform = `translate(${((v3.x + 1) / 2 * b.width).toFixed(1)}px,${((1 - v3.y) / 2 * b.height).toFixed(1)}px) translate(-50%,-50%)`;
    });
    if (dalej) kresli();
  }
  ovl.addEventListener('change', kresli);
  ovl.addEventListener('start', () => { zmen.od = null; canvas.style.cursor = 'grabbing'; });
  ovl.addEventListener('end', () => { canvas.style.cursor = 'grab'; });
  new ResizeObserver(velkost).observe(canvas.parentElement);
  velkost();
  nacitanie.hidden = true;
  return api;
}
