import './contactar.css';
import { useState } from 'react';
import { actualizarCon, type Reg } from '../lib/datos';
import { enlaceMail, enlaceWA, entradaComms, type Datos } from '../lib/contacto';
import { emailJSListo, enviarEmailJS, parametrosCorreo, plantillaEJS, type ConfigEmailJS } from '../lib/emailjs';
import { rellenar } from '../lib/wamasivo';
import type { Ctx } from '../screens/Modulos';
import { Icono } from './Icono';
import { Hoja } from './Piezas';

/*
 * 💬 WhatsApp y 📧 correo en cualquier fila o ficha, como en el CRM web:
 * se abre el mensaje listo para editar (igual que el modal "mwap" / "mcem"
 * del web), se puede usar una plantilla guardada, y al enviar se registra
 * en el historial de comunicaciones del cliente o prospecto (waClick /
 * logEmailSent del web), para verlo en la app y en el web.
 */

export type DatosContacto = Datos;

async function registrar(ctx: Ctx, d: DatosContacto, entrada: Record<string, unknown>) {
  if (!d.registro?.id) return;
  const { modulo, id, prefijo } = d.registro;
  const e = prefijo ? { ...entrada, accion: `${String(entrada.accion).replace(/^(💬 WhatsApp|📧 Email enviado)/, `$1 ${prefijo}`)}` } : entrada;
  const lista = (a: Reg, k: string) => (Array.isArray(a[k]) ? (a[k] as unknown[]) : []);
  try {
    const r = await actualizarCon(modulo, id, (a) => (modulo === 'prospectos'
      ? { historial: [...lista(a, 'historial'), e] }
      : {
        historialComms: [...lista(a, 'historialComms'), e],
        ...(e.tipo === 'whatsapp' ? { historialWA: [...lista(a, 'historialWA'), e] } : { historialEmail: [...lista(a, 'historialEmail'), e] }),
      }));
    ctx.poner(modulo, r);
  } catch {
    /* el mensaje ya salio; el registro se pierde solo si no hay red */
  }
}

/** estilo 'icono': redondos para filas · 'accion': botones grandes de la ficha (con Llamar) */
export function BotonesContacto({ ctx, d, estilo = 'icono' }: { ctx: Ctx; d: DatosContacto; estilo?: 'icono' | 'accion' }) {
  const [abierto, setAbierto] = useState<'wa' | 'mail' | null>(null);
  const tieneWA = !!(d.tel && enlaceWA(d.tel, '', d.codPais) && d.wa?.length);
  const tieneMail = !!(d.email && /@/.test(d.email) && d.correo);
  if (estilo === 'accion') {
    const tel = (d.tel ?? '').replace(/[^\d+]/g, '');
    return (
      <div className="acciones">
        <a className="accion" href={tel.length >= 7 ? `tel:${tel}` : undefined} aria-disabled={tel.length < 7}><Icono nombre="llamar" />Llamar</a>
        <button className="accion" type="button" disabled={!tieneWA} onClick={() => setAbierto('wa')}><Icono nombre="chat" />WhatsApp</button>
        <button className="accion" type="button" disabled={!tieneMail} onClick={() => setAbierto('mail')}><Icono nombre="correo" />Correo</button>
        {abierto === 'wa' && <ComponerWA ctx={ctx} d={d} onCerrar={() => setAbierto(null)} />}
        {abierto === 'mail' && <ComponerCorreo ctx={ctx} d={d} onCerrar={() => setAbierto(null)} />}
      </div>
    );
  }
  if (!tieneWA && !tieneMail) return null;
  return (
    <>
      {tieneWA && (
        <button className="icono-accion verde" type="button" aria-label={`WhatsApp a ${d.nombre}`}
          onClick={(e) => { e.stopPropagation(); setAbierto('wa'); }}>💬</button>
      )}
      {tieneMail && (
        <button className="icono-accion" type="button" aria-label={`Correo a ${d.nombre}`}
          onClick={(e) => { e.stopPropagation(); setAbierto('mail'); }}>📧</button>
      )}
      {abierto === 'wa' && <ComponerWA ctx={ctx} d={d} onCerrar={() => setAbierto(null)} />}
      {abierto === 'mail' && <ComponerCorreo ctx={ctx} d={d} onCerrar={() => setAbierto(null)} />}
    </>
  );
}

function ComponerWA({ ctx, d, onCerrar }: { ctx: Ctx; d: DatosContacto; onCerrar: () => void }) {
  const opciones = d.wa ?? [];
  const [motivo, setMotivo] = useState(0);
  const [msg, setMsg] = useState(opciones[0]?.msg ?? '');
  const plantillas = ctx.cartera.meta.plantillas.filter((p) => ['wa', 'whatsapp', 'ambos'].includes(String(p.tipo ?? '')));
  function enviar() {
    const url = enlaceWA(d.tel ?? '', msg, d.codPais);
    if (!url) return ctx.avisar('Número inválido');
    window.open(url, '_blank', 'noopener,noreferrer');
    void registrar(ctx, d, entradaComms('whatsapp', opciones[motivo]?.motivo ?? 'Manual', msg, d.nombre));
    ctx.avisar('💬 WhatsApp abierto · queda en el historial');
    onCerrar();
  }
  return (
    <Hoja titulo={`💬 WhatsApp a ${d.nombre}`} onCerrar={onCerrar}>
      <p className="fila-sub">{d.tel}</p>
      {opciones.length > 1 && (
        <div className="chips">
          {opciones.map((o, i) => (
            <button key={o.motivo} type="button" className={`chip${i === motivo ? ' azul' : ''}`}
              onClick={() => { setMotivo(i); setMsg(o.msg); }}>{o.motivo}</button>
          ))}
        </div>
      )}
      {plantillas.length > 0 && (
        <label>Usar plantilla
          <select value="" onChange={(e) => {
            const p = plantillas.find((x) => x.id === e.target.value);
            if (p) setMsg(rellenar(String(p.texto ?? ''), { cli: d.plantilla?.cli as never, pol: d.plantilla?.pol ?? null }));
          }}>
            <option value="">— Elegir —</option>
            {plantillas.map((p) => <option key={p.id} value={p.id}>{String(p.nombre ?? 'Plantilla')}</option>)}
          </select>
        </label>
      )}
      <label>Mensaje<textarea rows={9} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={4000} /></label>
      <div className="botonera">
        <button className="boton verde-wa" type="button" disabled={!msg.trim()} onClick={enviar}>💬 Abrir en WhatsApp</button>
        <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
      </div>
    </Hoja>
  );
}

function ComponerCorreo({ ctx, d, onCerrar }: { ctx: Ctx; d: DatosContacto; onCerrar: () => void }) {
  const [para, setPara] = useState(d.email ?? '');
  const [asunto, setAsunto] = useState(d.correo?.asunto ?? '');
  const [cuerpo, setCuerpo] = useState(d.correo?.cuerpo ?? '');
  const [ocupado, setOcupado] = useState(false);
  const cfg = ctx.cartera.meta.emailjs as ConfigEmailJS;
  const directo = emailJSListo(cfg);
  async function enviarDirecto() {
    if (!para.trim() || !asunto.trim() || !cuerpo.trim()) return ctx.avisar('Completa todos los campos');
    setOcupado(true);
    try {
      await enviarEmailJS(cfg, plantillaEJS(cfg, d.correo?.tipo ?? 'general'), parametrosCorreo(para, asunto, cuerpo, { to_name: d.nombre }));
      void registrar(ctx, d, entradaComms('email', 'Email', cuerpo, para, asunto));
      ctx.avisar('✅ Correo enviado por EmailJS');
      onCerrar();
    } catch (e) {
      ctx.avisar(e instanceof Error ? e.message : 'Error enviando. Usa "Abrir en Correo"');
      setOcupado(false);
    }
  }
  function enviar() {
    if (!para.trim() || !asunto.trim()) return ctx.avisar('Para y Asunto son obligatorios');
    window.location.href = enlaceMail(para, { asunto, cuerpo });
    void registrar(ctx, d, entradaComms('email', 'Email', cuerpo, para, asunto));
    ctx.avisar('📧 Correo listo en tu app de correo · queda en el historial');
    onCerrar();
  }
  return (
    <Hoja titulo={`📧 Correo a ${d.nombre}`} onCerrar={onCerrar}>
      <label>Para<input type="email" value={para} onChange={(e) => setPara(e.target.value)} /></label>
      <label>Asunto<input value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={200} /></label>
      <label>Mensaje<textarea rows={10} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} maxLength={8000} /></label>
      <div className="botonera">
        {directo && <button className="boton" type="button" disabled={ocupado} onClick={enviarDirecto}>{ocupado ? 'Enviando…' : '📨 Enviar directo (EmailJS)'}</button>}
        <button className={directo ? 'boton secundario' : 'boton'} type="button" disabled={ocupado} onClick={enviar}>📧 Abrir en Correo</button>
        <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
      </div>
    </Hoja>
  );
}

import './contactar.css';

/** 📬 Historial de comunicaciones del cliente (historialComms + historialWA del CRM web) */
export function Comunicaciones({ r }: { r: Reg }) {
  const [ver, setVer] = useState(5);
  const vistos = new Set<string>();
  const items = [...(Array.isArray(r.historialComms) ? r.historialComms : []), ...(Array.isArray(r.historialWA) ? r.historialWA : []),
    ...(Array.isArray(r.historialEmail) ? r.historialEmail : [])]
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .filter((e) => { const k = String(e.id ?? JSON.stringify(e)); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));
  if (!items.length) return null;
  return (
    <>
      <h3 className="seccion">📬 Comunicaciones ({items.length})</h3>
      <div className="lista">
        {items.slice(0, ver).map((e, i) => {
          const wa = e.tipo === 'whatsapp';
          const texto = String(e.mensaje ?? e.body ?? e.preview ?? e.resultado ?? '');
          return (
            <div key={String(e.id ?? i)} className="fila com-fila">
              <div className="avatar">{wa ? '💬' : '📧'}</div>
              <div className="fila-cuerpo">
                <div className="fila-titulo">{String(e.accion ?? (wa ? 'WhatsApp' : 'Email'))}</div>
                <div className="fila-sub">{String(e.fecha ?? '').slice(0, 10)}</div>
                {texto && <div className="com-texto">{texto}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {items.length > ver && <button className="boton secundario mas-abajo" type="button" onClick={() => setVer(ver + 10)}>Ver más</button>}
    </>
  );
}
