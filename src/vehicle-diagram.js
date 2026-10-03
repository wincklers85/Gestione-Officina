// Original vector line drawing, shared by touch intake and the printed vehicle sheet.
const side = `<path fill="white" d="M22 141 L34 95 Q47 78 177 64 L230 29 Q271 7 332 8 L436 11 Q471 14 542 62 L636 71 Q653 74 655 98 L667 111 L669 145 L582 149 Q581 100 539 99 Q491 96 485 148 L195 148 Q188 98 143 98 Q98 98 91 148 Z"/>
<path d="M32 125 L91 126 M195 126 L485 126 M581 125 L668 125 M45 90 L182 77 M545 76 L641 83 M236 31 Q275 15 327 16 L328 64 L201 67 Z M338 17 L435 20 Q466 22 513 64 L339 64 Z M199 72 L184 105 M331 70 L331 142 M520 70 L539 97 M234 34 L221 63"/>
<path d="M30 97 L75 95 Q92 96 84 109 L29 113 M614 88 L651 90 L653 108 L617 104 Q607 100 614 88 M241 66 Q230 43 215 44 Q204 45 205 62 Z"/>
<rect x="286" y="82" width="24" height="6" rx="3"/><rect x="405" y="82" width="24" height="6" rx="3"/>
<circle fill="white" cx="143" cy="145" r="39"/><circle cx="143" cy="145" r="29"/><circle cx="143" cy="145" r="7"/><circle fill="white" cx="539" cy="145" r="39"/><circle cx="539" cy="145" r="29"/><circle cx="539" cy="145" r="7"/>
<path d="M94 147 Q100 102 143 103 Q184 104 190 147 M490 147 Q496 103 539 103 Q579 104 582 147 M195 153 L485 153"/>`;
const top = `<path fill="white" d="M64 13 Q28 25 19 67 L13 161 Q11 209 51 224 L662 228 Q711 219 720 180 L725 75 Q723 26 679 17 Z"/>
<path d="M67 23 Q37 32 31 68 L24 158 Q22 199 59 214 L664 217 Q703 211 708 176 L714 76 Q709 41 678 29 Z M50 64 Q128 29 204 46 M44 173 Q122 208 202 195 M203 43 Q263 24 368 29 L496 32 Q560 40 617 62 M199 199 Q264 219 369 214 L496 210 Q560 202 617 184"/>
<path d="M211 45 Q186 116 209 194 L293 190 Q271 117 293 48 Z M308 49 L487 47 Q517 114 489 190 L309 188 Q286 119 308 49 Z M506 45 L604 64 Q628 118 605 181 L507 194 Q536 117 506 45 Z M38 71 L45 61 M33 171 L40 184 M685 37 L698 48 M687 205 L699 196"/>
<path d="M239 25 L257 6 Q271 -3 273 9 L265 28 M241 215 L258 237 Q272 246 274 232 L266 214 M294 32 L297 45 M486 32 L489 47 M294 204 L297 190 M485 206 L489 189 M68 33 L72 61 M68 207 L72 179 M675 35 L676 63 M675 207 L677 177"/>`;
const front = `<path fill="white" d="M20 70 Q30 55 43 51 L62 15 Q104 0 147 15 L166 51 Q180 55 190 70 L195 135 Q105 148 15 135 Z"/><path d="M47 52 L65 23 Q105 12 144 23 L162 52 Z M22 77 Q105 59 188 77 M17 117 L193 117 M54 100 L155 100 L149 116 L60 116 Z M34 81 L61 83 L57 96 L30 96 Z M151 83 L176 81 L181 96 L154 96 Z"/><rect x="77" y="105" width="56" height="15" rx="2"/><path d="M26 131 L26 153 L49 153 L49 138 M160 138 L160 153 L185 153 L185 130 M43 51 L26 42 L19 46 L19 58 L39 60 M166 51 L184 42 L192 46 L192 58 L169 60"/>`;
const rear = `<path fill="white" d="M20 72 Q30 54 46 50 L65 16 Q104 4 144 16 L163 50 Q181 55 190 72 L194 137 Q105 150 16 137 Z"/><path d="M52 53 L67 25 Q105 15 141 25 L157 53 Z M25 76 Q105 67 184 76 M19 121 L191 121 M29 87 L62 86 L62 106 L27 104 Z M150 86 L179 87 L183 104 L149 106 Z"/><rect x="77" y="91" width="55" height="21" rx="3"/><path d="M27 133 L27 154 L51 154 L51 142 M159 142 L159 154 L184 154 L184 133 M45 51 L28 43 L20 47 L20 58 L40 61 M163 51 L181 43 L190 47 L190 58 L168 61"/>`;
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function normalizedDamage(mark) {
  if (!Number.isFinite(mark?.x) || !Number.isFinite(mark?.y) || mark.x < 0 || mark.x > 1 || mark.y < 0 || mark.y > 1) return null;
  return mark.map_version === 2 ? { ...mark } : { x: (240 + mark.y * 720) / 1200, y: (585 - mark.x * 245) / 820, view: 'top', map_version: 2 };
}
function renderVehicleDiagram({ interactive = false, captured = [], marks = [] } = {}) {
  const surfaces = [
    ['right','Fiancata destra','translate(260 25) scale(1.03)',side],
    ['left','Fiancata sinistra','translate(950 600) scale(-1.03 1.03)',side],
    ['top','Vista dall’alto','translate(225 290)',top],
    ['front','Anteriore','translate(195 340) rotate(90)',front],
    ['rear','Posteriore','translate(1005 545) rotate(-90)',rear]
  ];
  const stationLabels={front:'Anteriore',front_right:'Anteriore destro',right:'Fianco destro',rear_right:'Posteriore destro',rear:'Posteriore',rear_left:'Posteriore sinistro',left:'Fianco sinistro',front_left:'Anteriore sinistro'};
  const spots = [['front',190,270],['front_right',365,257],['right',600,257],['rear_right',835,257],['rear',1010,270],['rear_left',835,557],['left',600,557],['front_left',365,557]];
  return `<svg ${interactive?'id="vehicle-map"':''} viewBox="0 0 1200 820" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Veicolo a cinque viste: fiancate, vista dall’alto, anteriore e posteriore" ${interactive?'data-map-version="2"':''}>
  <g fill="none" stroke="#25313b" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${surfaces.map(([key,label,transform,paths])=>`<g class="damage-surface" data-damage-view="${key}" transform="${transform}"><title>${label}</title>${paths}</g>`).join('')}</g>
  <g font-family="Arial,sans-serif" font-size="15" fill="#536274" text-anchor="middle"><text x="600" y="17">FIANCATA DESTRA</text><text x="600" y="814">FIANCATA SINISTRA</text><text x="106" y="315">ANTERIORE</text><text x="1090" y="315">POSTERIORE</text></g>
  <g id="saved-damage-layer">${marks.map(normalizedDamage).filter(Boolean).map(mark=>`<circle ${mark.photo_id?`data-saved-photo="${esc(mark.photo_id)}"`:''} cx="${mark.x*1200}" cy="${mark.y*820}" r="9" fill="#c12620" stroke="white" stroke-width="2"><title>Danno registrato · ${esc(mark.view||'top')}</title></circle>`).join('')}</g><g id="damage-layer"></g>
  ${interactive?spots.map(([key,x,y])=>`<g class="photo-station ${captured.includes(key)?'captured':''}" data-station="${key}" tabindex="0" role="button" aria-label="Fotografa ${stationLabels[key]}"><circle cx="${x}" cy="${y}" r="20"/><text x="${x}" y="${y+5}">${captured.includes(key)?'✓':'+'}</text></g>`).join(''):''}</svg>`;
}
module.exports = { renderVehicleDiagram, normalizedDamage };
