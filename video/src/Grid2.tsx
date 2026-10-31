import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, DISPLAY, UI } from './theme';

// Grille Instagram, 2e rangée (sous « H · O · P! ») : 3 publications 1080 × 1350 qui expliquent HOP!
// Tout reste dans le recadrage 3:4 du profil (≈ 1012 px de large au centre).
const NAVY_BG = `radial-gradient(ellipse 80% 70% at 50% 40%, ${C.navy2} 0%, ${C.navy} 75%)`;
const he = { direction: 'rtl' as const, fontFamily: `Rubik, sans-serif` };
const Hop: React.FC<{ size: number }> = ({ size }) => (
  <span style={{ font: `700 ${size}px/1 ${DISPLAY}`, color: '#fff', unicodeBidi: 'isolate', direction: 'ltr', display: 'inline-block' }}>HOP<span style={{ color: C.orange }}>!</span></span>
);
const Title: React.FC<{ fr: React.ReactNode; heT: React.ReactNode; top?: number }> = ({ fr, heT, top = 110 }) => (
  <div style={{ position: 'absolute', top, left: 70, right: 70, textAlign: 'center' }}>
    <div style={{ font: `700 92px/1.04 ${DISPLAY}`, color: '#fff' }}>{fr}</div>
    <div style={{ ...he, font: `500 44px/1.2 Rubik, sans-serif`, color: '#A9B3CA', marginTop: 18 }}>{heT}</div>
  </div>
);
// Le trajet orange qui relie les 3 publications, en bas (comme la 1re rangée)
const Route: React.FC<{ tile: number }> = ({ tile }) => (
  <svg width={3240} height={1350} style={{ position: 'absolute', left: -tile * 1080, top: 0 }}>
    <defs><filter id="gl2"><feGaussianBlur stdDeviation="12" /></filter></defs>
    {[0, 1].map(k => <path key={k} d="M -40 1250 C 400 1190, 700 1300, 1080 1255 S 1800 1190, 2160 1250 S 2800 1300, 3280 1240"
      stroke={k ? '#FFB27F' : C.orange} strokeWidth={k ? 9 : 30} fill="none" strokeLinecap="round" filter={k ? undefined : 'url(#gl2)'} opacity={k ? 1 : 0.55} strokeDasharray={k ? '2 24' : undefined} />)}
    {Array.from({ length: 50 }).map((_, k) => <circle key={k} cx={(k * 557) % 3240} cy={60 + ((k * 331) % 120)} r={2 + (k % 3)} fill="#fff" opacity={0.1 + (k % 4) * 0.04} />)}
  </svg>
);

// ----- 1. Tout Netanya, livré : les catégories ---------------------------------------------------------
const CATS = [['🍕', 'Restaurants', 'מסעדות'], ['🛒', 'Courses', 'קניות'], ['👔', 'Pressing', 'ניקוי יבש'], ['📦', 'Colis', 'חבילות'], ['💊', 'Pharmacie', 'בית מרקחת'],
  ['💐', 'Fleurs', 'פרחים'], ['🥖', 'Boulangerie', 'מאפייה'], ['✉️', 'Poste', 'דואר'], ['📄', 'Documents', 'מסמכים']];
const Tile1: React.FC = () => (
  <>
    <Title fr={<>Tout Netanya,<br /><span style={{ color: C.orange }}>livré.</span></>} heT="כל נתניה, עד הבית." />
    <div style={{ position: 'absolute', top: 460, left: 90, right: 90, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
      {CATS.map(([e, fr, h], k) => (
        <div key={k} style={{ height: 210, borderRadius: 34, background: k === 0 ? C.orange : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: '0 18px 40px rgba(0,0,0,.28)' }}>
          <div style={{ fontSize: 76, lineHeight: 1 }}>{e}</div>
          <div style={{ font: `700 34px/1.05 ${DISPLAY}`, color: k === 0 ? '#fff' : C.navy }}>{fr}</div>
          <div style={{ ...he, font: `500 24px/1 Rubik, sans-serif`, color: k === 0 ? 'rgba(255,255,255,.85)' : C.muted }}>{h}</div>
        </div>
      ))}
    </div>
  </>
);

// ----- 2. Comment ça marche : 3 étapes -----------------------------------------------------------------
const STEPS = [['📱', 'Vous commandez', "sur l'appli, en 1 minute", 'מזמינים באפליקציה, בדקה'],
  ['📍', 'Vous suivez', 'votre livreur en direct', 'עוקבים אחרי השליח בזמן אמת'],
  ['💳', 'Vous payez à la livraison', 'Bit · PayBox · espèces', 'משלמים במסירה: ביט · פייבוקס · מזומן']];
const Tile2: React.FC = () => (
  <>
    <Title fr={<>Comment ça<br /><span style={{ color: C.orange }}>marche ?</span></>} heT="איך זה עובד?" />
    <div style={{ position: 'absolute', top: 470, left: 90, right: 90 }}>
      <div style={{ position: 'absolute', left: 62, top: 70, bottom: 70, borderLeft: `6px dashed rgba(255,138,61,.6)` }} />
      {STEPS.map(([e, a, b, h], k) => (
        <div key={k} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 30, marginBottom: 34 }}>
          <div style={{ flex: 'none', width: 130, height: 130, borderRadius: '50%', background: C.orange, display: 'grid', placeItems: 'center', font: `700 70px/1 ${DISPLAY}`, color: '#fff',
            boxShadow: `0 0 0 10px ${C.navy}, 0 0 50px rgba(255,106,19,.5)` }}>{k + 1}</div>
          <div style={{ flex: 1, padding: '26px 30px', borderRadius: 34, background: '#fff', boxShadow: '0 18px 40px rgba(0,0,0,.28)' }}>
            <div style={{ font: `700 46px/1.05 ${DISPLAY}`, color: C.navy }}>{e} {a}</div>
            <div style={{ font: `500 32px/1.25 ${UI}`, color: C.muted, marginTop: 6 }}>{b}</div>
            <div style={{ ...he, font: `500 26px/1.25 Rubik, sans-serif`, color: '#98A2B3', marginTop: 4 }}>{h}</div>
          </div>
        </div>
      ))}
    </div>
  </>
);

// ----- 3. Pourquoi HOP! ----------------------------------------------------------------------------------
const WHY = [['Le prix du resto', 'מחיר המסעדה'], ['Livraison prix fixe, dès 25 ₪', 'משלוח במחיר קבוע'], ['0 ₪ de frais de service', '0 ₪ דמי שירות'], ['Des livreurs de Netanya', 'שליחים מנתניה']];
const Tile3: React.FC = () => (
  <>
    <Title fr={<>Pourquoi <Hop size={92} /> ?</>} heT={<>למה <bdi dir="ltr">HOP!</bdi>?</>} />
    <div style={{ position: 'absolute', top: 400, left: 90, right: 90, display: 'grid', gap: 20 }}>
      {WHY.map(([fr, h], k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '24px 30px', borderRadius: 34, background: '#fff', boxShadow: '0 18px 40px rgba(0,0,0,.28)' }}>
          <span style={{ flex: 'none', width: 74, height: 74, borderRadius: '50%', background: C.green, color: '#fff', display: 'grid', placeItems: 'center', font: `800 42px/1 ${UI}` }}>✓</span>
          <div>
            <div style={{ font: `700 42px/1.1 ${DISPLAY}`, color: C.navy }}>{fr}</div>
            <div style={{ ...he, font: `500 26px/1.2 Rubik, sans-serif`, color: C.muted, marginTop: 4, textAlign: 'left' }}>{h}</div>
          </div>
        </div>
      ))}
    </div>
    <div style={{ position: 'absolute', top: 1010, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ padding: '22px 44px', borderRadius: 999, background: C.orange, color: '#fff', font: `700 50px/1 ${DISPLAY}`, boxShadow: '0 20px 40px rgba(255,106,19,.4)' }}>🔗 Lien dans la bio</div>
      <div style={{ font: `700 32px/1 ${UI}`, color: '#A9B3CA' }}>hop-livraison.vercel.app</div>
    </div>
  </>
);

export const Grid2: React.FC<{ tile: number }> = ({ tile }) => (
  <AbsoluteFill style={{ background: C.navy, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: -tile * 1080, top: 0, width: 3240, height: 1350, background: NAVY_BG }} />
    <Route tile={tile} />
    {tile === 0 ? <Tile1 /> : tile === 1 ? <Tile2 /> : <Tile3 />}
  </AbsoluteFill>
);
