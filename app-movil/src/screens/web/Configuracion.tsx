import { useState } from 'react';
import './configuracion.css';
import { Hoja, Vacio } from '../../components/Piezas';
import { ErrorDatos, guardarMeta, txt, type Meta, type Reg } from '../../lib/datos';
import { dinero, nuevoId } from '../../lib/formato';
import type { Ctx } from '../Modulos';
import { Integraciones } from './Integraciones';

/*
 * ⚙️ Configuración del CRM web (pg-cfg): etiquetas, metas de comisiones y
 * copia de seguridad, e integraciones (EmailJS y Google Calendar).
 * La contraseña y la seguridad estan en Ajustes.
 */

const COLORES = ['#1D4ED8', '#16A34A', '#DC2626', '#D97706', '#7C3AED', '#0EA5E9', '#DB2777', '#475569'];

export function Configuracion({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <Etiquetas ctx={ctx} />
      <Metas ctx={ctx} />
      <Integraciones ctx={ctx} />
      <Respaldo ctx={ctx} />
    </>
  );
}

function Etiquetas({ ctx }: { ctx: Ctx }) {
  const c = ctx.cartera;
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(COLORES[0]);
  const [borrar, setBorrar] = useState<Reg | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const usos = (id: string) => [...c.polizas, ...c.prospectos].filter((p) => Array.isArray(p.etiquetas) && (p.etiquetas as string[]).includes(id)).length;

  async function escribir(cambiar: (l: Reg[]) => Reg[], aviso: string) {
    setOcupado(true);
    try {
      const v = await guardarMeta<Reg[]>('etiquetas', [], cambiar);
      ctx.ponerMeta('etiquetas', v);
      ctx.avisar(aviso);
      return true;
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h3 className="seccion">🏷️ Gestión de etiquetas</h3>
      <div className="lista">
        {c.meta.etiquetas.length ? c.meta.etiquetas.map((e) => {
          const u = usos(e.id);
          return (
            <div key={e.id} className="fila">
              <span className="cfg-color" style={{ background: txt(e, 'color') || '#475569' }} />
              <div className="fila-cuerpo">
                <div className="fila-titulo">{txt(e, 'nombre')}</div>
                <div className="fila-sub">{u} uso{u === 1 ? '' : 's'}</div>
              </div>
              <button className="icono-accion rojo" type="button" aria-label={`Eliminar etiqueta ${txt(e, 'nombre')}`} onClick={() => setBorrar(e)}>🗑️</button>
            </div>
          );
        }) : <Vacio>Sin etiquetas. Agrega la primera abajo.</Vacio>}
      </div>
      <form className="tarjeta cfg-form" onSubmit={async (ev) => {
        ev.preventDefault();
        const n = nombre.trim();
        if (!n) return ctx.avisar('Escribe un nombre');
        if (await escribir((l) => [...l, { id: nuevoId('ET'), nombre: n, color }], '✓ Etiqueta agregada')) setNombre('');
      }}>
        <label>Nueva etiqueta<input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} placeholder="Ej.: VIP, Referido…" /></label>
        <div className="cfg-colores" role="radiogroup" aria-label="Color">
          {COLORES.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={k === color} aria-label={k} className={`cfg-color grande${k === color ? ' activa' : ''}`}
              style={{ background: k }} onClick={() => setColor(k)} />
          ))}
        </div>
        <button className="boton" type="submit" disabled={ocupado}>+ Agregar</button>
      </form>
      {borrar && (
        <Hoja titulo="¿Eliminar etiqueta?" onCerrar={() => setBorrar(null)}>
          <p className="texto-largo"><b>{txt(borrar, 'nombre')}</b></p>
          <div className="botonera">
            <button className="boton peligro" type="button" disabled={ocupado} onClick={async () => {
              if (await escribir((l) => l.filter((x) => x.id !== borrar.id), 'Eliminada')) setBorrar(null);
            }}>🗑️ Sí, eliminar</button>
            <button className="boton secundario" type="button" onClick={() => setBorrar(null)}>Cancelar</button>
          </div>
        </Hoja>
      )}
    </>
  );
}

function Metas({ ctx }: { ctx: Ctx }) {
  const m = ctx.cartera.meta.metas;
  const [men, setMen] = useState(String(m.mensual ?? ''));
  const [anu, setAnu] = useState(String(m.anual ?? ''));
  const [ocupado, setOcupado] = useState(false);
  return (
    <>
      <h3 className="seccion">🎯 Metas de comisiones</h3>
      <form className="tarjeta cfg-form" onSubmit={async (ev) => {
        ev.preventDefault();
        setOcupado(true);
        try {
          // Se conservan las metas por ramo / aseguradora que el web guarda en el mismo objeto
          const v = await guardarMeta<Meta['metas']>('metas', {}, (a) => ({ ...a, mensual: parseFloat(men) || 0, anual: parseFloat(anu) || 0 }));
          ctx.ponerMeta('metas', v);
          ctx.avisar('✓ Metas guardadas');
        } catch (e) {
          ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
        } finally {
          setOcupado(false);
        }
      }}>
        <label>Meta mensual ($)<input type="number" inputMode="decimal" step="0.01" min="0" value={men} onChange={(e) => setMen(e.target.value)} /></label>
        <label>Meta anual ($)<input type="number" inputMode="decimal" step="0.01" min="0" value={anu} onChange={(e) => setAnu(e.target.value)} /></label>
        <p className="fila-sub">Actual: {dinero(m.mensual ?? 0)} al mes · {dinero(m.anual ?? 0)} al año</p>
        <button className="boton" type="submit" disabled={ocupado}>💾 Guardar metas</button>
      </form>
    </>
  );
}

/** 📥 Exportar backup (JSON), con la misma forma que el backup del CRM web */
function Respaldo({ ctx }: { ctx: Ctx }) {
  const c = ctx.cartera;
  function exportar() {
    const { meta, cargadoEn: _cargado, ...tablas } = c;
    void _cargado;
    const data = JSON.stringify({ ...tablas, ...meta }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `jac-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    ctx.avisar('✓ Backup exportado');
  }
  return (
    <>
      <h3 className="seccion">ℹ️ Sistema y backup</h3>
      <div className="tarjeta cfg-form">
        <p className="fila-sub">Clientes: {c.clientes.length} · Pólizas: {c.polizas.length} · Prospectos: {c.prospectos.length}</p>
        <button className="boton" type="button" onClick={exportar}>📥 Exportar backup (JSON)</button>
        <p className="fila-sub">Exporta periódicamente como respaldo de seguridad. Contiene datos personales: guárdalo en un lugar privado.</p>
      </div>
    </>
  );
}
