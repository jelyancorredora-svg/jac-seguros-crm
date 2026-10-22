import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Hoja, Vacio } from '../../components/Piezas';
import { ErrorDatos, guardarRegistro, registrarAccion, txt, type Reg } from '../../lib/datos';
import {
  CAMPO_VALOR, COTP_AUTOS_PRECIOS, RAMO_CRM, COTP_RAMOS, FORMAS_PAGO, FP_CORTO, FP_INFORME, FP_TABLA, SUBS,
  asegDisponibles, asegPorId, calcular, conComision, correoComparativo, depreciacion, edadDesde, enlaceWA, fM,
  mensajeWACompartir, mensajeWAComparativo, mensajeWAOpciones, mensajeWAResultado, notaVida, ordenar, ramoPorId, subInicial,
  type FormaPago, type Orden, type ResultadoCot,
} from '../../lib/cotizador';
import { esCorreo, hoyISO, nuevoId, normalizar } from '../../lib/formato';
import { ESTADOS_POLIZA } from '../../lib/esquema';
import type { Ctx } from '../Modulos';

/* Replica del "🧮 Cotizador Pro" del CRM web (pg-cotp): asistente de 4 pasos */

type Paso = 1 | 2 | 3 | 4;
type Vinculo = { id: string; tipo: 'cliente' | 'prospecto'; nombre: string };

const PASOS: Array<[Paso, string, string]> = [
  [1, 'Ramo', 'Tipo de seguro'], [2, 'Datos', 'Cliente + asegurado'], [3, 'Aseguradoras', 'Seleccionar'], [4, 'Resultados', 'Comparativo'],
];
const COLOR_POS = ['#15803D', '#2563EB', '#7C3AED'];
const MEDALLAS = [
  { m: '🥇', badge: 'MEJOR PRECIO', borde: '#EAB308', texto: '#854D0E' },
  { m: '🥈', badge: '2° OPCIÓN', borde: '#94A3B8', texto: '#334155' },
  { m: '🥉', badge: '3° OPCIÓN', borde: '#D97706', texto: '#92400E' },
];
const colorRating = (r: string) => (r === 'A++' ? '#15803D' : r === 'A+' ? '#2563EB' : r.startsWith('A') ? '#7C3AED' : '#D97706');
const enteroO = (s: string, d: number) => parseInt(s, 10) || d;
const SUB_MSG: Record<Orden, string> = { prima: 'precio', rating: 'calificación', com: 'comisión' };

/** Enlace externo (wa.me / mailto) o, si falta el dato, un boton que avisa */
function Enlace({ href, falta, avisar, className, children }: {
  href: string | null; falta: string; avisar: (t: string) => void; className: string; children: ReactNode;
}) {
  if (!href) return <button type="button" className={className} onClick={() => avisar(falta)}>{children}</button>;
  return <a className={className} href={href} target={href.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer">{children}</a>;
}

export function Cotizador({ ctx }: { ctx: Ctx }) {
  const { cartera, avisar } = ctx;
  const [paso, setPaso] = useState<Paso>(1);
  const [ramo, setRamo] = useState<string | null>(null);
  const [sub, setSub] = useState('');
  // Paso 1: cliente
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [buscar, setBuscar] = useState('');
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  // Paso 2: datos del ramo
  const [valor, setValor] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [modoValor, setModoValor] = useState<'actual' | 'depreciado'>('actual');
  const [edadVida, setEdadVida] = useState('');
  const [deps, setDeps] = useState('');
  const [viajeros, setViajeros] = useState('');
  const [placa, setPlaca] = useState('');
  const [esHijo, setEsHijo] = useState(false);
  const [hijoNom, setHijoNom] = useState('');
  const [hijoGen, setHijoGen] = useState('');
  const [hijoDob, setHijoDob] = useState('');
  const [fpago, setFpago] = useState<FormaPago>('anual');
  // Paso 3
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ninguna, setNinguna] = useState(false);
  // Paso 4
  const [resultados, setResultados] = useState<ResultadoCot[]>([]);
  const [orden, setOrden] = useState<Orden>('prima');
  const [reordenado, setReordenado] = useState(false);
  const [vista, setVista] = useState<'cards' | 'table'>('cards');
  const [comPct, setComPct] = useState('15');
  const [saveNom, setSaveNom] = useState('');
  const [saveAseg, setSaveAseg] = useState('');
  const [guardado, setGuardado] = useState<{ id: string; nombre: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [poliza, setPoliza] = useState<{ base: Record<string, string>; clienteId: string } | null>(null);
  const [pdf, setPdf] = useState<{ filtro: string | null; n: number } | null>(null);

  const R = ramoPorId(ramo);
  const edadCli = dob ? edadDesde(dob) : null;
  const edadHijo = hijoDob ? edadDesde(hijoDob) : null;
  const disponibles = useMemo(() => (ramo ? asegDisponibles(ramo, sub || null) : []), [ramo, sub]);
  const deprec = ramo === 'autos' ? depreciacion(parseInt(anio, 10) || 0, parseFloat(valor) || 0) : null;

  // Cada paso empieza arriba
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    raiz.current?.closest('.contenido')?.scrollTo({ top: 0 });
  }, [paso]);

  // Imprimir el informe (todo o una aseguradora) despues de que se pinte
  useEffect(() => {
    if (pdf) window.print();
  }, [pdf]);

  /* ---------- navegacion (cotpGoStep) ---------- */
  function irA(n: Paso) {
    if (n > 1 && !ramo) return avisar('Selecciona un ramo primero');
    if (n === 3 && sel.size === 0 && !ninguna) setSel(new Set(disponibles));
    setPaso(n);
  }

  function elegirRamo(id: string) {
    if (id !== ramo) {
      setRamo(id);
      setSub(subInicial(id));
      setValor(''); setMarca(''); setModelo(''); setAnio(''); setModoValor('actual');
      setEdadVida(''); setDeps(''); setViajeros(''); setPlaca('');
      setSel(new Set()); setNinguna(false);
      // La edad calculada por fecha de nacimiento se propone en Salud / Vida
      const e = esHijo && edadHijo !== null ? edadHijo : edadCli;
      if (e !== null && e >= 0) {
        if (id === 'salud') setValor(String(e));
        if (id === 'vida') setEdadVida(String(e));
      }
    }
    setPaso(2);
  }

  function proponerEdad(e: number | null) {
    if (e === null || e < 0) return;
    if (ramo === 'salud' && !valor) setValor(String(e));
    if (ramo === 'vida' && !edadVida) setEdadVida(String(e));
  }

  function reiniciar() {
    setPaso(1); setRamo(null); setSub(''); setNombre(''); setCedula(''); setTel(''); setEmail(''); setDob(''); setBuscar('');
    setVinculo(null); setValor(''); setMarca(''); setModelo(''); setAnio(''); setModoValor('actual'); setEdadVida(''); setDeps('');
    setViajeros(''); setPlaca(''); setEsHijo(false); setHijoNom(''); setHijoGen(''); setHijoDob(''); setFpago('anual');
    setSel(new Set()); setNinguna(false); setResultados([]); setOrden('prima'); setVista('cards'); setSaveNom(''); setSaveAseg('');
    setGuardado(null);
    avisar('Nueva cotización iniciada');
  }

  /* ---------- buscar en CRM (cotpBuscar / cotpLoadClient) ---------- */
  const encontrados = useMemo(() => {
    if (buscar.trim().length < 2) return [];
    const q = normalizar(buscar);
    const cli = cartera.clientes.filter((c) => normalizar(txt(c, 'nombre')).includes(q) || txt(c, 'cedula').includes(buscar.trim()) || normalizar(txt(c, 'email')).includes(q))
      .map((c) => ({ r: c, tipo: 'cliente' as const }));
    const pro = cartera.prospectos.filter((p) => normalizar(txt(p, 'nombre')).includes(q) || txt(p, 'cedula').includes(buscar.trim()))
      .map((p) => ({ r: p, tipo: 'prospecto' as const }));
    return [...cli, ...pro].slice(0, 8);
  }, [buscar, cartera.clientes, cartera.prospectos]);

  function cargar(c: Reg, tipo: 'cliente' | 'prospecto') {
    setNombre(txt(c, 'nombre')); setCedula(txt(c, 'cedula')); setTel(txt(c, 'cel') || txt(c, 'tel')); setEmail(txt(c, 'email'));
    const nac = txt(c, 'fNac') || txt(c, 'fechaNac');
    if (/^\d{4}-\d{2}-\d{2}/.test(nac)) setDob(nac.slice(0, 10));
    setVinculo({ id: c.id, tipo, nombre: txt(c, 'nombre') });
    if (!saveNom) setSaveNom(txt(c, 'nombre'));
    setBuscar('');
    avisar('Cliente cargado ✓');
  }

  /* ---------- paso 3 ---------- */
  function todas(si: boolean) {
    setSel(si ? new Set(disponibles) : new Set());
    setNinguna(!si);
  }
  function alternar(id: string) {
    setNinguna(false);
    const s = new Set(sel);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSel(s);
  }

  /* ---------- calcular (cotpCalcAll) ---------- */
  function calcularTodo() {
    if (!ramo) return;
    if (sel.size === 0) return avisar('Selecciona al menos una aseguradora');
    const pct = parseFloat(comPct || '15');
    const rs = calcular({
      ramo, sub: sub || null, valor: parseFloat(valor) || 0, modoValor, anio: parseInt(anio, 10) || 0,
      edadVida: parseInt(edadVida, 10) || 0, deps: parseInt(deps, 10) || 0, viajeros: enteroO(viajeros, 1), fpago,
      aseguradoras: disponibles.filter((id) => sel.has(id)), comPct: isFinite(pct) ? pct : 15,
    });
    if (!rs.length) return avisar('Sin resultados. Verifica los datos ingresados');
    setResultados(rs);
    setOrden('prima');
    setReordenado(false);
    if (nombre) setSaveNom(nombre);
    setSaveAseg(rs[0].asegId);
    setGuardado(null);
    setPaso(4);
  }

  function cambiarPct(v: string) {
    setComPct(v);
    const p = parseFloat(v || '15');
    setResultados((rs) => conComision(rs, isFinite(p) ? p : 15));
  }

  function ordenarPor(o: Orden) {
    setOrden(o);
    setReordenado(true);
    setResultados((rs) => ordenar(rs, o));
  }

  /* ---------- guardar en CRM (cotpSaveProspe) ---------- */
  async function guardarProspecto() {
    const nom = saveNom.trim() || nombre.trim();
    if (!nom) return avisar('Completa el nombre del prospecto');
    const r = resultados.find((x) => x.asegId === saveAseg) ?? resultados[0];
    const ramoLbl = R?.label ?? ramo ?? '';
    const accion = r ? `💼 Cotización ${ramoLbl} — ${r.aseg.nombre} ${fM(r.primaTotal)}/año` : `💼 Cotización ${ramoLbl} generada desde Cotizador Pro`;
    const hoy = hoyISO();
    setOcupado(true);
    try {
      const np = await guardarRegistro('prospectos', null, {
        nombre: nom, cedula, cel: tel, email, estado: 'prospecto_nuevo', fuente: 'Cotizador Pro',
        aseguradora_cotizada: r?.aseg.nombre ?? '', ramo_cotizado: ramoLbl, prima_cotizada: r ? r.primaTotal : null,
        cre: new Date().toISOString(),
        historial: [{ id: nuevoId('H'), fecha: hoy, accion, tipo: 'cotizacion', resultado: 'Pendiente respuesta' }],
      });
      ctx.poner('prospectos', np);
      // Tambien se anota en el cliente vinculado
      if (vinculo?.tipo === 'cliente') {
        try {
          ctx.poner('clientes', await registrarAccion('clientes', vinculo.id, { accion, tipo: 'cotizacion', resultado: 'Cotización generada desde Cotizador Pro' }));
        } catch { /* el prospecto ya quedo guardado */ }
      }
      setVinculo({ id: np.id, tipo: 'prospecto', nombre: nom });
      // Tarea de seguimiento a 3 dias
      const f = new Date();
      f.setDate(f.getDate() + 3);
      const fISO = hoyISO(f);
      try {
        const t = await guardarRegistro('tareas', null, {
          titulo: `📞 Seguimiento cotización — ${nom}`, tipo: 'llamada', etapaTarea: 'Pendiente', prioridad: 'Alta',
          descripcion: `Dar seguimiento a la cotización de ${ramoLbl} enviada a ${nom}.`, desc: `Dar seguimiento a la cotización de ${ramoLbl} enviada a ${nom}.`,
          clienteId: np.id, clienteNom: nom, fecha: fISO, fechaLimite: fISO, cre: new Date().toISOString(),
        });
        ctx.poner('tareas', t);
        avisar(`📋 Tarea de seguimiento creada para el ${f.toLocaleDateString('es-PA', { day: '2-digit', month: 'short' })} ✓`);
      } catch { /* sin tarea, pero el prospecto quedo guardado */ }
      setGuardado({ id: np.id, nombre: nom });
      avisar(`✅ ${nom} guardado como prospecto`);
    } catch (e) {
      avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  /* ---------- crear poliza (cotpCrearPolizaDesdeResult) ---------- */
  async function crearPoliza(asegId: string) {
    const r = resultados.find((x) => x.asegId === asegId) ?? resultados[0];
    if (!r) return avisar('Sin resultados para crear póliza');
    const ramoLbl = R?.label ?? ramo ?? '';
    if (vinculo) {
      try {
        const mod = vinculo.tipo === 'cliente' ? 'clientes' : 'prospectos';
        ctx.poner(mod, await registrarAccion(mod, vinculo.id, {
          accion: `📋 Cotización ${ramoLbl} — ${r.aseg.nombre} ${fM(r.primaTotal)}/año`, tipo: 'cotizacion', resultado: 'Pendiente — se creará póliza',
        }));
      } catch { /* no impide crear la poliza */ }
    }
    const clave = ramoLbl.toUpperCase().split(' ')[0].substring(0, 5);
    const ramos = [...new Set(cartera.polizas.map((p) => txt(p, 'ramo')).filter(Boolean))];
    const hoy = new Date();
    const fin = new Date(hoy);
    fin.setFullYear(fin.getFullYear() + 1);
    setPoliza({
      clienteId: vinculo?.tipo === 'cliente' ? vinculo.id : '',
      base: {
        num: '', aseg: r.aseg.nombre, ramo: ramos.find((x) => x.toUpperCase().includes(clave)) ?? RAMO_CRM[ramo ?? ''] ?? ramoLbl.toUpperCase(),
        prima: r.primaNeta.toFixed(2), itbmsPct: '6', itbms: r.itbmsAmt.toFixed(2), total: r.primaTotal.toFixed(2),
        comPct: r.rates.com ? String(Math.round(r.rates.com * 100)) : '', comision: r.com.toFixed(2),
        nombreAsegurado: nombre, docAsegurado: cedula, fechaInicio: hoyISO(hoy), fechaFin: hoyISO(fin), estado: 'Vigente',
      },
    });
  }

  const rCorreo = correoComparativo(resultados, ramo ?? '', nombre);
  const hrefCorreo = email && esCorreo(email)
    ? `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(rCorreo.asunto)}&body=${encodeURIComponent(rCorreo.cuerpo)}`
    : null;
  const hrefWA = tel.replace(/\D/g, '') ? enlaceWA(tel, mensajeWAComparativo(resultados, ramo ?? '', nombre)) : null;
  const imprimir = (filtro: string | null) => setPdf({ filtro, n: (pdf?.n ?? 0) + 1 });

  const totalCom = resultados.reduce((s, r) => s + r.com, 0);

  return (
    <div className="cot" ref={raiz}>
      <div className="no-imprimir">
        {/* Cabecera + pasos */}
        <div className="cot-cab">
          <div className="cot-cab-fila">
            <div>
              <div className="cot-cab-titulo">🧮 Cotizador Pro <span className="cot-pill">PRIVADO · ADMIN</span></div>
              <div className="cot-cab-sub">17 aseguradoras · 12 ramos · Panamá · Comparativo completo con informe</div>
            </div>
          </div>
          <button type="button" className="cot-nueva" onClick={reiniciar}>🔄 Nueva cotización</button>
          <div className="cot-pasos">
            {PASOS.map(([n, t, s]) => (
              <button key={n} type="button" className="cot-paso" onClick={() => irA(n)}>
                <span className={`cot-punto ${n < paso ? 'hecho' : n === paso ? 'activo' : ''}`}>{n}</span>
                <span className={`cot-paso-txt${n <= paso ? ' activo' : ''}`}><b>{t}</b><small>{s}</small></span>
              </button>
            ))}
          </div>
        </div>

        {/* PASO 1: RAMO + CLIENTE */}
        {paso === 1 && (
          <>
            <div className="tarjeta">
              <div className="cot-h">¿Qué tipo de seguro deseas cotizar?</div>
              <p className="cot-ayuda">Selecciona el ramo para comparar todas las aseguradoras disponibles en Panamá</p>
              <div className="cot-ramos">
                {COTP_RAMOS.map((r) => (
                  <button key={r.id} type="button" className={`cot-ramo${ramo === r.id ? ' activo' : ''}`} onClick={() => elegirRamo(r.id)}>
                    <span className="cot-ramo-icono">{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="tarjeta">
              <div className="cot-titulo-sec">👤 Datos del cliente (opcional)</div>
              <label className="campo"><span>Buscar en CRM</span>
                <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar cliente..." /></label>
              {buscar.trim().length >= 2 && (
                <div className="cot-busca">
                  {encontrados.length ? encontrados.map(({ r, tipo }) => (
                    <button key={tipo + r.id} type="button" className="cot-busca-item" onClick={() => cargar(r, tipo)}>
                      <b>{txt(r, 'nombre')}</b>
                      <small>{tipo === 'cliente' ? '👥 Cliente' : '🎯 Prospecto'} · {txt(r, 'cedula') || txt(r, 'email')}</small>
                    </button>
                  )) : <p className="contador">Sin resultados</p>}
                </div>
              )}
              <label className="campo"><span>Nombre completo</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" /></label>
              <label className="campo"><span>Cédula / Pasaporte</span>
                <input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="8-123-456" /></label>
              <label className="campo"><span>Teléfono</span>
                <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+507 6XXX-XXXX" inputMode="tel" /></label>
              <label className="campo"><span>Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@cliente.com" /></label>
              <label className="campo"><span>F. nacimiento (auto-calcula edad)</span>
                <input type="date" value={dob} onChange={(e) => { setDob(e.target.value); proponerEdad(e.target.value ? edadDesde(e.target.value) : null); }} /></label>
              {edadCli !== null && edadCli >= 0 && <div className="cot-edad">Edad calculada: {edadCli} años</div>}
              {vinculo && <div className="cot-vinculo">✅ Vinculado: {vinculo.nombre}</div>}
            </div>
          </>
        )}

        {/* PASO 2: DATOS DEL RAMO */}
        {paso === 2 && R && (
          <div className="tarjeta">
            <div className="cot-badge" style={{ background: R.bg, color: R.color }}>{R.icon} {R.label}</div>
            {ramo === 'autos' && (
              <>
                <Sub ramo={ramo} sub={sub} setSub={setSub} />
                <label className="campo"><span>Marca</span>
                  <select value={marca} onChange={(e) => { setMarca(e.target.value); setModelo(''); setValor(''); }}>
                    <option value="">— Seleccionar marca —</option>
                    {Object.keys(COTP_AUTOS_PRECIOS).map((m) => <option key={m} value={m}>{m}</option>)}
                  </select></label>
                <label className="campo"><span>Modelo</span>
                  <select value={modelo} onChange={(e) => { setModelo(e.target.value); const p = COTP_AUTOS_PRECIOS[marca]?.[e.target.value]; if (p) setValor(String(p)); }}>
                    <option value="">— Seleccionar modelo —</option>
                    {Object.entries(COTP_AUTOS_PRECIOS[marca] ?? {}).map(([m, p]) => <option key={m} value={m}>{m} (~${p.toLocaleString('en-US')})</option>)}
                  </select></label>
                <div className="cot-2">
                  <label className="campo"><span>Año del vehículo</span>
                    <input type="number" inputMode="numeric" value={anio} onChange={(e) => setAnio(e.target.value)} placeholder={String(new Date().getFullYear())} min={1990} max={new Date().getFullYear()} /></label>
                  <label className="campo"><span>{CAMPO_VALOR.autos[0]}</span>
                    <input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={CAMPO_VALOR.autos[1]} /></label>
                </div>
                <div className="cot-deprec">
                  <small>VALOR DEPRECIADO CALCULADO</small>
                  <b>{deprec ? '$' + deprec.valor.toLocaleString('es-PA') + ' USD' : '— ingresa año y valor —'}</b>
                  {deprec && <span>Antigüedad: {deprec.edad} año{deprec.edad !== 1 ? 's' : ''} · Depreciación: {Math.round(deprec.pct * 100)}% · Tabla SSRP Panamá</span>}
                  <label className="campo"><span>Calcular prima sobre</span>
                    <select value={modoValor} onChange={(e) => setModoValor(e.target.value as 'actual' | 'depreciado')}>
                      <option value="actual">Valor actual (nuevo/precio)</option>
                      <option value="depreciado">Valor depreciado (SSRP)</option>
                    </select></label>
                </div>
              </>
            )}
            {ramo === 'salud' && (
              <>
                <Sub ramo={ramo} sub={sub} setSub={setSub} />
                <div className="cot-2">
                  <label className="campo"><span>Edad del asegurado</span>
                    <input type="number" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="35" min={0} max={80} /></label>
                  <label className="campo"><span>Dependientes (si familiar)</span>
                    <input type="number" inputMode="numeric" value={deps} onChange={(e) => setDeps(e.target.value)} placeholder="0" min={0} /></label>
                </div>
              </>
            )}
            {ramo === 'vida' && (
              <>
                <label className="campo"><span>{CAMPO_VALOR.vida[0]}</span>
                  <input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={CAMPO_VALOR.vida[1]} /></label>
                <div className="cot-2">
                  <label className="campo"><span>Edad del asegurado</span>
                    <input type="number" inputMode="numeric" value={edadVida} onChange={(e) => setEdadVida(e.target.value)} placeholder="35" min={18} max={70} /></label>
                  <Sub ramo={ramo} sub={sub} setSub={setSub} />
                </div>
                {edadVida && <div className="cot-tip">{notaVida(parseInt(edadVida, 10) || 0)}</div>}
              </>
            )}
            {ramo === 'soat' && (
              <div className="cot-2">
                <Sub ramo={ramo} sub={sub} setSub={setSub} />
                <label className="campo"><span>Placa</span><input value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="AB1234" /></label>
              </div>
            )}
            {ramo === 'viaje' && (
              <>
                <div className="cot-2">
                  <label className="campo"><span>{CAMPO_VALOR.viaje[0]}</span>
                    <input type="number" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="14" min={1} /></label>
                  <label className="campo"><span>Viajeros</span>
                    <input type="number" inputMode="numeric" value={viajeros} onChange={(e) => setViajeros(e.target.value)} placeholder="1" min={1} /></label>
                </div>
                <Sub ramo={ramo} sub={sub} setSub={setSub} />
                <div className="cot-tip">💡 Tarifa por persona/día según destino. Ingresa los días totales del viaje.</div>
              </>
            )}
            {['hogar', 'ap', 'rc', 'robo', 'transporte', 'fianzas', 'cyb'].includes(ramo ?? '') && (
              <>
                <label className="campo"><span>{CAMPO_VALOR[ramo!][0]}</span>
                  <input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={CAMPO_VALOR[ramo!][1]} /></label>
                {SUBS[ramo!] && <Sub ramo={ramo!} sub={sub} setSub={setSub} />}
                {ramo === 'fianzas' && <div className="cot-tip">💡 Prima = % del monto de la fianza. Las tasas aplican a contratos de construcción, servicios y gobierno.</div>}
              </>
            )}

            <div className="cot-hijo">
              <label className="cot-check">
                <input type="checkbox" checked={esHijo} onChange={(e) => setEsHijo(e.target.checked)} />
                👶 ¿La cotización es SOLO para hijo/hija (menor de edad)?
              </label>
              {esHijo && (
                <>
                  <label className="campo"><span>Nombre del menor</span><input value={hijoNom} onChange={(e) => setHijoNom(e.target.value)} placeholder="Nombre" /></label>
                  <label className="campo"><span>Género</span>
                    <select value={hijoGen} onChange={(e) => setHijoGen(e.target.value)}>
                      <option value="">— Seleccionar —</option>
                      <option value="masculino">👦 Masculino</option>
                      <option value="femenino">👧 Femenino</option>
                    </select></label>
                  <label className="campo"><span>Fecha de nacimiento</span>
                    <input type="date" value={hijoDob} onChange={(e) => { setHijoDob(e.target.value); proponerEdad(e.target.value ? edadDesde(e.target.value) : null); }} /></label>
                  {edadHijo !== null && edadHijo >= 0 && (
                    <div className="cot-vinculo">{edadHijo < 18 ? `✅ Menor: ${edadHijo} años — apto para cotización infantil` : '⚠️ Mayor de edad — cotizar como adulto'}</div>
                  )}
                </>
              )}
            </div>

            <div className="cot-2">
              <label className="campo"><span>Forma de pago</span>
                <select value={fpago} onChange={(e) => setFpago(e.target.value as FormaPago)}>
                  {FORMAS_PAGO.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select></label>
              <label className="campo"><span>Moneda</span><select disabled><option>USD — Dólares americanos</option></select></label>
            </div>
            <div className="cot-nav">
              <button type="button" className="boton secundario" onClick={() => setPaso(1)}>← Atrás</button>
              <button type="button" className="boton cot-primario" onClick={() => irA(3)}>Continuar → Seleccionar aseguradoras</button>
            </div>
          </div>
        )}

        {/* PASO 3: ASEGURADORAS */}
        {paso === 3 && (
          <div className="tarjeta">
            <div className="cot-h">Selecciona las aseguradoras a comparar</div>
            <p className="cot-ayuda">{sel.size} aseguradoras seleccionadas</p>
            <div className="ag-anot-botones cot-todas">
              <button type="button" className="mini" onClick={() => todas(false)}>✗ Ninguna</button>
              <button type="button" className="mini cot-mini-morado" onClick={() => todas(true)}>✓ Todas</button>
            </div>
            <div className="cot-asegs">
              {disponibles.map((id) => {
                const a = asegPorId(id)!;
                const on = sel.has(id);
                return (
                  <button key={id} type="button" className={`cot-aseg${on ? ' sel' : ''}`} onClick={() => alternar(id)} aria-pressed={on}>
                    <span className="cot-aseg-logo">{a.logo}</span>
                    <span className="cot-aseg-cuerpo">
                      <b>{a.nombre}</b>
                      <small>{a.sfp} · {a.activos} activos · {a.anios}+ años</small>
                    </span>
                    <span className="cot-rating" style={{ color: colorRating(a.rating), background: colorRating(a.rating) + '22' }}>{a.rating}</span>
                    <span className={`cot-marca${on ? ' on' : ''}`}>{on ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>
            <div className="cot-nav">
              <button type="button" className="boton secundario" onClick={() => setPaso(2)}>← Atrás</button>
              <button type="button" className="boton cot-primario" onClick={calcularTodo}>⚡ Calcular comparativo completo</button>
            </div>
          </div>
        )}

        {/* PASO 4: RESULTADOS */}
        {paso === 4 && !resultados.length && <Vacio>Genera una cotización primero.</Vacio>}
        {paso === 4 && resultados.length > 0 && (
          <>
            <div className="tarjeta">
              <div className="cot-h">{R ? R.icon + ' ' : ''} Comparativo {R ? R.label : ramo}</div>
              <p className="cot-ayuda">
                {!reordenado
                  ? `${nombre ? nombre + ' · ' : ''}${resultados.length} opciones • Ordenado por precio • Estimado calibrado con tu cartera real (34 pólizas de auto, error mediano 12%) — no es una cotización en firme`
                  : `Ordenado por ${SUB_MSG[orden]} · ${resultados.length} resultados`}
              </p>
              <div className="ag-anot-botones">
                <button type="button" className="mini" onClick={() => setPaso(3)}>← Modificar</button>
                <button type="button" className="mini" onClick={() => setVista(vista === 'cards' ? 'table' : 'cards')}>{vista === 'cards' ? '📋 Vista tabla' : '🃏 Vista tarjetas'}</button>
                <button type="button" className="mini cot-mini-oscuro" onClick={() => imprimir(null)}>📄 Informe PDF</button>
                <Enlace className="mini verde" href={hrefWA} falta="El cliente no tiene teléfono registrado" avisar={avisar}>💬 WhatsApp</Enlace>
                <Enlace className="mini" href={hrefCorreo} falta="El cliente no tiene email registrado" avisar={avisar}>📧 Email</Enlace>
              </div>
            </div>

            <div className="cot-lista">
              <div className="cot-lista-txt">
                <small>JAC Seguros — Cotización Lista</small>
                <div>Seguro de <b>{R?.label ?? ramo}</b> • {resultados.length} opci{resultados.length !== 1 ? 'ones' : 'on'}</div>
              </div>
              <div className="ag-anot-botones">
                <button type="button" className="mini rojo" onClick={() => imprimir(null)}>Generar PDF</button>
                <a className="mini verde" href={enlaceWA('', mensajeWAOpciones(resultados.slice(0, 3), ramo ?? '', nombre))} target="_blank" rel="noopener noreferrer">Enviar por WA</a>
              </div>
              <p>💡 La comisión mostrada es <b>bruta</b>. En co-corretaje recibes: <b>Capital Care &amp; Co 65%</b> · <b>FF Seguros 50%</b>.</p>
            </div>

            <div className="cot-podio">
              {resultados.slice(0, 3).map((r, i) => (
                <div key={r.asegId} className="cot-podio-item" style={{ borderColor: MEDALLAS[i].borde }}>
                  <span className="cot-podio-badge" style={{ background: MEDALLAS[i].borde }}>{MEDALLAS[i].badge}</span>
                  <div className="cot-podio-m">{MEDALLAS[i].m}</div>
                  <b>{r.aseg.nombre}</b>
                  <small>{r.aseg.sfp} · Rating {r.aseg.rating}</small>
                  <div className="cot-podio-precio" style={{ color: MEDALLAS[i].texto }}>{fM(r.primaTotal)}<small>/año</small></div>
                  <small>{fM(r.cuota)} / {FP_CORTO[r.fpago]}</small>
                  <p className="cot-cob">{r.cobertura.slice(0, 80)}{r.cobertura.length > 80 ? '...' : ''}</p>
                </div>
              ))}
            </div>

            <div className="filtros">
              {([['prima', '💰 Precio ↑'], ['rating', '⭐ Rating'], ['com', '💼 Comisión']] as Array<[Orden, string]>).map(([k, t]) => (
                <button key={k} type="button" className={orden === k ? 'activa' : ''} onClick={() => ordenarPor(k)}>{t}</button>
              ))}
            </div>
            <p className="contador">{resultados.length} resultados</p>

            {vista === 'cards' ? (
              <>
                <div className="cot-com">
                  <label>💰 % Comisión JAC:
                    <input type="number" inputMode="decimal" step={0.5} min={0} max={50} value={comPct} onChange={(e) => cambiarPct(e.target.value)} aria-label="% de comisión" />
                  </label>
                  <small>sobre prima neta — editable por cotización</small>
                  <b>Total com.: ${totalCom.toFixed(2)}</b>
                </div>
                {resultados.map((r, i) => (
                  <div key={r.asegId} className={`cot-res${i === 0 ? ' mejor' : ''}`}>
                    <div className="cot-res-cab" style={{ background: i < 3 ? COLOR_POS[i] : '#475569' }}>
                      <span className="cot-aseg-logo">{r.aseg.logo}</span>
                      <span className="cot-aseg-cuerpo"><b>{r.aseg.nombre}</b><small>{r.aseg.sfp} · {r.aseg.anios}+ años</small></span>
                      <span className="cot-res-der">
                        {i === 0 && <small>⭐ #1 PRECIO</small>}
                        <span>{r.aseg.rating}</span>
                      </span>
                    </div>
                    <div className="cot-res-cuerpo">
                      <div className="cot-res-precios">
                        <div>
                          <small>PRIMA TOTAL / AÑO</small>
                          <div className="cot-res-total">{fM(r.primaTotal)}</div>
                          <div className="cot-res-cuota">{fM(r.cuota)} / {FP_CORTO[r.fpago]}</div>
                        </div>
                        <div className="cot-res-neta">
                          <small>Prima neta</small><b>{fM(r.primaNeta)}</b>
                          <small>ITBMS</small><span>{fM(r.itbmsAmt)}</span>
                        </div>
                      </div>
                      <p className="cot-cob" style={{ borderLeftColor: i < 3 ? COLOR_POS[i] : '#7C3AED' }}>{r.cobertura}</p>
                      <div className="cot-res-det">
                        <span>Deducible: <b>{r.deducible}</b></span>
                        <span>Comisión JAC: <b className="verde-t">{fM(r.com)}</b> ({((r.com / r.primaNeta) * 100 || 0).toFixed(1)}%)</span>
                      </div>
                      <div className="ag-anot-botones">
                        <button type="button" className="mini" onClick={() => { setSaveAseg(r.asegId); avisar(`✅ ${r.aseg.nombre} seleccionada`); }}>Seleccionar</button>
                        <a className="mini verde" href={enlaceWA(tel, mensajeWAResultado(r, nombre))} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">💬</a>
                        <button type="button" className="mini rojo" onClick={() => imprimir(r.asegId)}>PDF</button>
                        <a className="mini verde" href={enlaceWA('', mensajeWAOpciones([r], ramo ?? '', nombre))} target="_blank" rel="noopener noreferrer">WA</a>
                        <button type="button" className="mini" onClick={() => void crearPoliza(r.asegId)} aria-label="Crear póliza desde esta cotización">📋</button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr>
                    <th>#</th><th>Aseguradora</th><th>Prima neta</th><th>ITBMS</th><th>Total/año</th><th>Cuota {FP_TABLA[fpago]}</th><th>Rating</th><th>Com. JAC</th><th>Deducible</th>
                  </tr></thead>
                  <tbody>
                    {resultados.map((r, i) => (
                      <tr key={r.asegId} className={i === 0 ? 'cot-fila-mejor' : ''}>
                        <td>{['🥇', '🥈', '🥉'][i] ?? i + 1}</td>
                        <td><b>{r.aseg.logo} {r.aseg.nombre}</b><br /><small>{r.aseg.sfp} · {r.aseg.anios}+ años en mercado</small></td>
                        <td className="cot-num">{fM(r.primaNeta)}</td>
                        <td className="cot-num">{fM(r.itbmsAmt)}</td>
                        <td className="cot-num"><b>{fM(r.primaTotal)}</b></td>
                        <td className="cot-num">{fM(r.cuota)}</td>
                        <td><span className="cot-rating" style={{ color: colorRating(r.aseg.rating), background: colorRating(r.aseg.rating) + '22' }}>{r.aseg.rating}</span></td>
                        <td className="cot-num verde-t">{fM(r.com)}</td>
                        <td>{r.deducible}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="seccion">💾 Guardar cotización en CRM</h3>
            <div className="tarjeta">
              <label className="campo"><span>Nombre prospecto</span><input value={saveNom} onChange={(e) => setSaveNom(e.target.value)} /></label>
              <label className="campo"><span>Aseguradora elegida</span>
                <select value={saveAseg} onChange={(e) => setSaveAseg(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {resultados.map((r) => <option key={r.asegId} value={r.asegId}>{r.aseg.nombre} — {fM(r.primaTotal)}/año</option>)}
                </select></label>
              <div className="botonera">
                <button type="button" className="boton cot-primario" disabled={ocupado} onClick={() => void guardarProspecto()}>{ocupado ? 'Guardando…' : '💾 Guardar en CRM'}</button>
                <button type="button" className="boton" onClick={() => void crearPoliza(saveAseg)}>📋 Crear Póliza</button>
                <a className="boton cot-wa" href={enlaceWA('', mensajeWACompartir(resultados, ramo ?? '', saveNom.trim() || nombre.trim()))} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
              </div>
              {guardado && (
                <div className="cot-ok">
                  <span>✅ {guardado.nombre} guardado en Prospectos</span>
                  <button type="button" className="mini verde" onClick={() => ctx.abrir('prospectos', guardado.id)}>Ver en Prospectos →</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Informe para imprimir / PDF (cotpGenReport) */}
      {paso === 4 && resultados.length > 0 && (
        <Informe resultados={pdf?.filtro ? resultados.filter((r) => r.asegId === pdf.filtro) : resultados}
          ramo={ramo ?? ''} nombre={nombre || 'Cliente'} cedula={cedula} tel={tel} email={email} fpago={fpago} n={pdf?.n ?? 0} />
      )}

      {poliza && <PolizaDesdeCotizacion ctx={ctx} base={poliza.base} clienteId={poliza.clienteId} onCerrar={() => setPoliza(null)} />}
    </div>
  );
}

function Sub({ ramo, sub, setSub }: { ramo: string; sub: string; setSub: (s: string) => void }) {
  const s = SUBS[ramo];
  if (!s) return null;
  return (
    <label className="campo"><span>{s.etiqueta}</span>
      <select value={sub} onChange={(e) => setSub(e.target.value)}>
        {s.opciones.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select></label>
  );
}

function Informe({ resultados, ramo, nombre, cedula, tel, email, fpago, n }: {
  resultados: ResultadoCot[]; ramo: string; nombre: string; cedula: string; tel: string; email: string; fpago: FormaPago; n: number;
}) {
  const R = ramoPorId(ramo);
  // Numero de cotizacion: cambia con cada impresion, como COT-xxxxxx del web
  const numero = useMemo(() => 'COT-' + Date.now().toString().slice(-6), [n]);
  const fecha = new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' });
  const best = resultados[0];
  if (!best) return null;
  return (
    <div className="solo-imprimir cot-informe">
      <div className="cot-inf-cab">
        <div>
          <div className="cot-inf-logo">JAC SEGUROS</div>
          <div>Jely An Castro, corredora de seguros · Panamá</div>
          <div>Regulado y supervisado por la Superintendencia de Seguros y Reaseguros de Panamá.</div>
          <div>📞 +507 6292-6010 · jcastro@jacsegurospa.com</div>
          <div>🌐 jacsegurospa.com</div>
        </div>
        <div className="cot-inf-num">
          <small>COTIZACIÓN N°</small>
          <b>{numero}</b>
          <div>{fecha}</div>
        </div>
      </div>
      <div className="cot-inf-caja">
        <small>DATOS DEL ASEGURADO</small>
        <div className="cot-inf-datos">
          <div><span>Nombre completo</span><b>{nombre}</b></div>
          <div><span>Cédula / Pasaporte</span><b>{cedula || '—'}</b></div>
          <div><span>Teléfono</span><b>{tel || '—'}</b></div>
          <div><span>Email</span><b>{email || '—'}</b></div>
          <div><span>Ramo cotizado</span><b>{R ? R.icon + ' ' + R.label : ramo}</b></div>
          <div><span>Forma de pago</span><b>{FP_INFORME[fpago]}</b></div>
        </div>
      </div>
      <div className="cot-inf-mejor">
        <small>⭐ RECOMENDACIÓN JAC SEGUROS — MEJOR OPCIÓN</small>
        <b>{best.aseg.logo} {best.aseg.nombre} — {fM(best.primaTotal)}/año · Cuota: {fM(best.cuota)}</b>
        <div>{best.cobertura}</div>
        <div>Deducible: {best.deducible} · Calificación: {best.aseg.rating}</div>
      </div>
      <h4>📊 Comparativo completo</h4>
      <table className="cot-inf-tabla">
        <thead><tr><th>#</th><th>Aseguradora</th><th>Prima neta</th><th>ITBMS</th><th>Total/año</th><th>Cuota</th><th>Rating</th><th>Deducible</th></tr></thead>
        <tbody>
          {resultados.map((r, i) => (
            <tr key={r.asegId}>
              <td>{['🥇', '🥈', '🥉'][i] ?? i + 1}</td><td>{r.aseg.logo} {r.aseg.nombre}</td><td>{fM(r.primaNeta)}</td><td>{fM(r.itbmsAmt)}</td>
              <td><b>{fM(r.primaTotal)}</b></td><td>{fM(r.cuota)}</td><td>{r.aseg.rating}</td><td>{r.deducible}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>🛡️ Detalle de coberturas</h4>
      {resultados.map((r) => <p key={r.asegId} className="cot-inf-cob"><b>{r.aseg.logo} {r.aseg.nombre}</b> {r.cobertura}</p>)}
      <p className="cot-inf-nota"><b>⚠️ Importante:</b> Las primas son estimadas y de referencia. La prima final está sujeta a la evaluación de riesgo por cada aseguradora. Cotización válida por 30 días a partir de {fecha}.</p>
      <p className="cot-inf-pie">JAC Seguros | Jely An Castro, corredora de seguros · Panamá · +507 6292-6010 · jcastro@jacsegurospa.com · Regulado y supervisado por la Superintendencia de Seguros y Reaseguros de Panamá. · jacsegurospa.com</p>
    </div>
  );
}

/* Formulario de poliza pre-llenado con la cotizacion (como OP() + sv(...) del web) */
const CAMPOS_POL: Array<[string, string, 'text' | 'date' | 'num', boolean?]> = [
  ['num', 'Nro. Póliza', 'text', true], ['aseg', 'Aseguradora', 'text', true], ['ramo', 'Ramo principal', 'text', true],
  ['fechaInicio', 'Fecha inicio', 'date'], ['fechaFin', 'Fecha fin / Vencimiento', 'date', true],
  ['prima', 'Prima neta ($)', 'num', true], ['itbmsPct', '% ITBMS', 'num'], ['itbms', 'ITBMS ($)', 'num'], ['total', 'Prima total c/ITBMS ($)', 'num'],
  ['comPct', '% Comisión aseguradora', 'num'], ['comision', 'Comisión JAC ($)', 'num'],
  ['nombreAsegurado', 'Nombre asegurado', 'text'], ['docAsegurado', 'Doc. asegurado', 'text'],
];

function PolizaDesdeCotizacion({ ctx, base, clienteId, onCerrar }: {
  ctx: Ctx; base: Record<string, string>; clienteId: string; onCerrar: () => void;
}) {
  const [v, setV] = useState<Record<string, string>>(base);
  const clientes = ctx.cartera.clientes;
  const [cliTxt, setCliTxt] = useState(() => txt(clientes.find((c) => c.id === clienteId), 'nombre'));
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cli = clientes.find((c) => c.id === clienteId && txt(c, 'nombre') === cliTxt.trim()) ?? clientes.find((c) => txt(c, 'nombre') === cliTxt.trim());
  const ramos = [...new Set(ctx.cartera.polizas.map((p) => txt(p, 'ramo')).filter(Boolean))].sort();
  const asegs = [...new Set([...ctx.cartera.meta.aseguradoras.map((a) => a.nombre ?? ''), ...ctx.cartera.polizas.map((p) => txt(p, 'aseg'))].filter(Boolean))].sort();

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!cli) return setError('Elige el cliente.');
    for (const [k, l, t, req] of CAMPOS_POL) {
      if (req && !v[k]?.trim()) return setError(`Falta: ${l}`);
      if (t === 'num' && v[k] && !isFinite(Number(v[k].replace(',', '.')))) return setError(`${l} debe ser un número.`);
    }
    const datos: Record<string, unknown> = {
      clienteId: cli.id, nombreCliente: txt(cli, 'nombre'), cedCliente: txt(cli, 'cedula'), celCliente: txt(cli, 'cel'), emailCliente: txt(cli, 'email'),
      estado: v.estado,
    };
    for (const [k, , t] of CAMPOS_POL) if (v[k]) datos[k] = t === 'num' ? Number(v[k].replace(',', '.')) : v[k];
    setOcupado(true);
    setError('');
    try {
      const r = await guardarRegistro('polizas', null, datos);
      ctx.poner('polizas', r);
      ctx.avisar('✓ Póliza creada desde cotización');
      onCerrar();
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  return (
    <Hoja titulo="📋 Nueva póliza (desde cotización)" onCerrar={onCerrar}>
      <form onSubmit={(e) => void guardar(e)}>
        <p className="nota">Póliza pre-llenada desde cotización. Completa el número de póliza y revisa los datos.</p>
        <label className="campo"><span>Cliente *</span>
          <input list="cot-dl-cli" value={cliTxt} onChange={(e) => setCliTxt(e.target.value)} placeholder="Escribe nombre del cliente" />
          <datalist id="cot-dl-cli">{clientes.map((c) => <option key={c.id} value={txt(c, 'nombre')} />)}</datalist>
        </label>
        {CAMPOS_POL.map(([k, l, t, req]) => (
          <label key={k} className="campo"><span>{l}{req ? ' *' : ''}</span>
            <input type={t === 'date' ? 'date' : 'text'} inputMode={t === 'num' ? 'decimal' : undefined} value={v[k] ?? ''}
              list={k === 'ramo' ? 'cot-dl-ramo' : k === 'aseg' ? 'cot-dl-aseg' : undefined}
              onChange={(e) => setV({ ...v, [k]: e.target.value })} />
          </label>
        ))}
        <datalist id="cot-dl-ramo">{ramos.map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="cot-dl-aseg">{asegs.map((x) => <option key={x} value={x} />)}</datalist>
        <label className="campo"><span>Estado</span>
          <select value={v.estado} onChange={(e) => setV({ ...v, estado: e.target.value })}>
            {ESTADOS_POLIZA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select></label>
        {error && <div className="error">{error}</div>}
        <div className="botonera">
          <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : '💾 Guardar póliza'}</button>
          <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
        </div>
      </form>
    </Hoja>
  );
}
