import { useMemo, useState, type FormEvent } from 'react';
import { Hoja, Vacio } from '../../components/Piezas';
import { ErrorDatos, guardarMeta, txt, type Reg } from '../../lib/datos';
import { limpiarTexto, nuevoId } from '../../lib/formato';
import {
  FILTROS_INICIALES, TIPO_PLANTILLA, WAM_BDAY, WAM_DIAS, WAM_MUESTRAS, WAM_TIPOS, generarWam, opcionesWam, plantillaWA,
  type WamFiltros, type WamItem, type WamTipo,
} from '../../lib/wamasivo';
import type { Ctx } from '../Modulos';

/* Replica de "📣 WhatsApp Masivo" (pg-wam) del CRM web */

type Linea = WamItem & { sel: boolean; enviado: boolean };
const conSel = (l: WamItem[]): Linea[] => l.map((x) => ({ ...x, sel: true, enviado: false }));

function abrirWA(url: string) {
  const w = window.open(url, '_blank');
  if (w) w.opener = null;
}

export function WaMasivo({ ctx }: { ctx: Ctx }) {
  const { clientes, polizas, meta } = ctx.cartera;
  const [f, setF] = useState<WamFiltros>(FILTROS_INICIALES);
  // Como en el web: la lista se arma al entrar y cada vez que se pulsa "Generar".
  const [lista, setLista] = useState<Linea[]>(() => conSel(generarWam(clientes, polizas, FILTROS_INICIALES)));
  const [abierto, setAbierto] = useState<string | null>(null);
  const [plantillas, setPlantillas] = useState(false);
  const { ramos, asegs } = useMemo(() => opcionesWam(polizas), [polizas]);
  const tplWA = meta.plantillas.filter(plantillaWA);

  const sel = lista.filter((x) => x.sel).length;
  const pendientes = lista.filter((x) => x.sel && !x.enviado);
  const generar = () => { setLista(conSel(generarWam(clientes, polizas, f))); setAbierto(null); };
  const marcar = (id: string, cambio: Partial<Linea>) => setLista((l) => l.map((x) => (x.id === id ? { ...x, ...cambio } : x)));
  const todos = (v: boolean) => setLista((l) => l.map((x) => ({ ...x, sel: v })));
  function enviar(x: Linea) { marcar(x.id, { enviado: true }); }
  function siguiente() {
    const x = pendientes[0];
    if (!x) return;
    abrirWA(x.url);
    enviar(x);
  }
  async function copiar(x: Linea) {
    try {
      await navigator.clipboard.writeText(x.msg);
      ctx.avisar('📋 Mensaje copiado');
    } catch {
      ctx.avisar('No se pudo copiar');
    }
  }
  const usarPlantilla = (id: string) => {
    const t = meta.plantillas.find((p) => p.id === id);
    if (t) setF({ ...f, custom: txt(t, 'texto') });
  };

  return (
    <>
      <div className="tarjeta wam-cab">
        <div>
          <b>📣 WhatsApp Masivo</b>
          <small>{lista.length} destinatarios · {sel} seleccionados</small>
        </div>
        <button className="boton" type="button" onClick={generar}>⚡ Generar Mensajes</button>
      </div>

      <div className="tarjeta">
        <div className="wam-titulo">🎯 Filtros</div>
        <label className="campo"><span>TIPO DE ALERTA</span>
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as WamTipo })}>
            {WAM_TIPOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select></label>
        {(f.tipo === 'ren' || f.tipo === 'cobro') && (
          <>
            <label className="campo"><span>DÍAS AL VENCIMIENTO</span>
              <select value={f.dias} onChange={(e) => setF({ ...f, dias: Number(e.target.value) })}>
                {WAM_DIAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select></label>
            <div className="dos">
              <label className="campo"><span>RAMO (opcional)</span>
                <select value={f.ramo} onChange={(e) => setF({ ...f, ramo: e.target.value })}>
                  <option value="">Todos los ramos</option>
                  {ramos.map((r) => <option key={r} value={r}>{r}</option>)}
                </select></label>
              <label className="campo"><span>ASEGURADORA (opcional)</span>
                <select value={f.aseg} onChange={(e) => setF({ ...f, aseg: e.target.value })}>
                  <option value="">Todas</option>
                  {asegs.map((a) => <option key={a} value={a}>{a}</option>)}
                </select></label>
            </div>
          </>
        )}
        {f.tipo === 'bday' && (
          <label className="campo"><span>PERÍODO</span>
            <select value={f.bdayDias} onChange={(e) => setF({ ...f, bdayDias: Number(e.target.value) })}>
              {WAM_BDAY.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select></label>
        )}
        {f.tipo === 'custom' && (
          <>
            <label className="campo"><span>💾 Mis plantillas guardadas</span>
              <select value="" onChange={(e) => usarPlantilla(e.target.value)}>
                <option value="">{tplWA.length ? 'Usar una plantilla…' : 'Sin plantillas de WhatsApp'}</option>
                {tplWA.map((p) => <option key={p.id} value={p.id}>{txt(p, 'nombre')}</option>)}
              </select></label>
            <label className="campo"><span>MENSAJE PERSONALIZADO</span>
              <textarea rows={4} value={f.custom} placeholder="Escribe tu mensaje. Usa {nombre} para el nombre del cliente."
                onChange={(e) => setF({ ...f, custom: e.target.value })} /></label>
          </>
        )}
        <button type="button" className="mini" onClick={() => setPlantillas(true)}>💬 Plantillas de Mensajes</button>
      </div>

      <div className="tarjeta">
        <div className="wam-titulo">👁 Vista Previa del Mensaje</div>
        <div className="wam-preview">{WAM_MUESTRAS[f.tipo]}</div>
      </div>

      <div className="seccion-fila wam-dest">
        <div className="seccion">📋 Destinatarios</div>
        <div className="wam-acciones">
          <span className="wam-total">{sel} seleccionados de {lista.length}</span>
          <button type="button" className="mini" onClick={() => todos(true)}>Todos</button>
          <button type="button" className="mini" onClick={() => todos(false)}>Ninguno</button>
        </div>
      </div>
      {pendientes.length > 0 && (
        <button type="button" className="boton wam-siguiente" onClick={siguiente}>
          💬 Enviar siguiente · {pendientes[0].nombre} ({pendientes.length} pendientes)
        </button>
      )}
      {!lista.length ? <Vacio>Sin destinatarios con los filtros seleccionados</Vacio> : (
        <div className="lista">
          {lista.map((x) => (
            <div key={x.id} className={`wam-fila${x.sel ? '' : ' wam-off'}`}>
              <div className="wam-linea">
                <input type="checkbox" checked={x.sel} aria-label={`Seleccionar a ${x.nombre}`}
                  onChange={(e) => marcar(x.id, { sel: e.target.checked })} />
                <button type="button" className="wam-cuerpo" onClick={() => setAbierto(abierto === x.id ? null : x.id)}>
                  <span className="fila-titulo">{x.enviado && <span className="verde-t">✓ </span>}{x.nombre}</span>
                  <span className="fila-sub">{x.info} · 📞 {x.tel}</span>
                </button>
                <a className="mini verde" href={x.url} target="_blank" rel="noopener noreferrer" onClick={() => enviar(x)}>💬 Enviar</a>
              </div>
              {abierto === x.id && (
                <div className="wam-detalle">
                  <div className="wam-preview">{x.msg}</div>
                  <div className="wam-acciones">
                    <button type="button" className="mini" onClick={() => void copiar(x)}>📋 Copiar</button>
                    {x.enviado && <button type="button" className="mini" onClick={() => marcar(x.id, { enviado: false })}>↺ Marcar como no enviado</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {plantillas && <Plantillas ctx={ctx} onCerrar={() => setPlantillas(false)} />}
    </>
  );
}

/* Plantillas de Mensajes (Configuración del web): crear, editar y eliminar */
function Plantillas({ ctx, onCerrar }: { ctx: Ctx; onCerrar: () => void }) {
  const lista = ctx.cartera.meta.plantillas;
  const vacio = { id: '', nombre: '', tipo: 'wa', texto: '' };
  const [v, setV] = useState(vacio);
  const [borrar, setBorrar] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function escribir(cambiar: (l: Reg[]) => Reg[], aviso: string) {
    setOcupado(true);
    try {
      ctx.ponerMeta('plantillas', await guardarMeta<Reg[]>('plantillas', [], (l) => cambiar(Array.isArray(l) ? l : [])));
      ctx.avisar(aviso);
      return true;
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setOcupado(false);
    }
  }
  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    const nombre = limpiarTexto(v.nombre, 120);
    const texto = limpiarTexto(v.texto, 4000);
    if (!nombre || !texto) return ctx.avisar('Nombre y texto son requeridos');
    const ok = v.id
      ? await escribir((l) => l.map((p) => (p.id === v.id ? { ...p, nombre, tipo: v.tipo, texto } : p)), '✓ Plantilla guardada')
      : await escribir((l) => [...l, { id: nuevoId('TPL'), nombre, tipo: v.tipo, texto }], '✓ Plantilla guardada');
    if (ok) setV(vacio);
  }

  return (
    <Hoja titulo="💬 Plantillas de Mensajes" onCerrar={onCerrar}>
      {!lista.length && <p className="sincro">Sin plantillas guardadas.</p>}
      {lista.length > 0 && (
        <div className="lista wam-plantillas">
          {lista.map((p) => (
            <div key={p.id} className="fila">
              <div className="fila-cuerpo">
                <div className="fila-titulo">{txt(p, 'nombre') || '—'}</div>
                <div className="fila-sub">{TIPO_PLANTILLA[txt(p, 'tipo')] ?? txt(p, 'tipo')} · {txt(p, 'texto').slice(0, 80)}</div>
              </div>
              <div className="fila-acciones">
                <button type="button" className="icono-accion" aria-label="Editar plantilla"
                  onClick={() => setV({ id: p.id, nombre: txt(p, 'nombre'), tipo: txt(p, 'tipo') || 'wa', texto: txt(p, 'texto') })}>✏️</button>
                {borrar === p.id
                  ? <button type="button" className="mini rojo" disabled={ocupado}
                    onClick={async () => { if (await escribir((l) => l.filter((x) => x.id !== p.id), 'Eliminada')) { setBorrar(null); if (v.id === p.id) setV(vacio); } }}>Confirmar</button>
                  : <button type="button" className="icono-accion rojo" aria-label="Eliminar plantilla" onClick={() => setBorrar(p.id)}>🗑</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={guardar}>
        <div className="seccion">{v.id ? '✏️ Editar plantilla' : '+ Nueva plantilla'}</div>
        <label className="campo"><span>Nombre</span>
          <input value={v.nombre} placeholder="Nombre de la plantilla..." onChange={(e) => setV({ ...v, nombre: e.target.value })} /></label>
        <label className="campo"><span>Tipo</span>
          <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
            <option value="wa">WhatsApp</option><option value="email">Email</option><option value="ambos">Ambos</option>
            {!['wa', 'email', 'ambos'].includes(v.tipo) && <option value={v.tipo}>{TIPO_PLANTILLA[v.tipo] ?? v.tipo}</option>}
          </select></label>
        <label className="campo"><span>Texto</span>
          <textarea rows={5} value={v.texto} placeholder="Texto... Usa {nombre}, {poliza}, {fecha} como variables"
            onChange={(e) => setV({ ...v, texto: e.target.value })} /></label>
        <div className="botonera">
          <button className="boton" type="submit" disabled={ocupado}>{v.id ? '💾 Guardar cambios' : '+ Guardar plantilla'}</button>
          {v.id && <button className="boton secundario" type="button" onClick={() => setV(vacio)}>Cancelar edición</button>}
        </div>
      </form>
    </Hoja>
  );
}
