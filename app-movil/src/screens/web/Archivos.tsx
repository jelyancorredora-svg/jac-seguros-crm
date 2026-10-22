import { useEffect, useMemo, useState } from 'react';
import { adjuntos, ErrorDatos, guardarMeta, moverADrive, type Adjunto, type Meta } from '../../lib/datos';
import type { Modulo } from '../../lib/esquema';
import { espacioDrive, prefDrive } from '../../lib/drive';
import { tokenGcal, urlConexion } from '../../lib/gcal';
import { comprimirActivo, setComprimir } from '../../lib/imagen';
import type { Ctx } from '../Modulos';

/*
 * 💾 Archivos y espacio: donde se guardan los documentos y cuanto queda.
 *  - Nube del CRM (Supabase): 1 GB gratis.
 *  - Tu Google Drive: el espacio de tu plan de Google (compartido con Gmail y Fotos).
 *  - Fotos comprimidas: rinden 5 a 10 veces mas en cualquiera de los dos.
 */

const GB = 1024 ** 3;
const mb = (b: number) => (b >= GB ? `${(b / GB).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(1)} MB`);

function Barra({ usado, total }: { usado: number; total: number }) {
  const pct = total ? Math.min(100, Math.round((usado / total) * 100)) : 0;
  return (
    <div className="barra" aria-label={`${pct}% usado`}>
      <div className="barra-relleno" style={{ width: `${Math.max(2, pct)}%`, background: pct > 85 ? '#DC2626' : pct > 65 ? '#D97706' : undefined }} />
    </div>
  );
}

export function Archivos({ ctx }: { ctx: Ctx }) {
  const c = ctx.cartera;
  const i = c.meta.integraciones;
  const destino = i.archivosEn === 'supabase' ? 'supabase' : 'drive';
  const [comprimir, setC] = useState(comprimirActivo());
  const [drive, setDrive] = useState<{ usado: number; limite: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const token = tokenGcal();

  const [mudanza, setMudanza] = useState('');
  const [mudando, setMudando] = useState(false);
  const pendientes = useMemo(() => {
    const l: Array<{ m: Modulo; id: string; f: Adjunto }> = [];
    for (const m of ['clientes', 'polizas', 'siniestros', 'vehiculos', 'prospectos', 'pagos', 'tareas'] as const) {
      for (const r of c[m]) for (const f of adjuntos(r)) if (f.path && !f.drive) l.push({ m, id: r.id, f });
    }
    return l;
  }, [c]);

  async function mudar() {
    setMudando(true);
    let ok = 0, mal = 0;
    for (const [k, p] of pendientes.entries()) {
      setMudanza(`📦 Mudando ${k + 1} de ${pendientes.length}: ${p.f.name ?? 'archivo'}…`);
      try {
        ctx.poner(p.m, await moverADrive(p.m, p.id, p.f));
        ok++;
      } catch (e) {
        mal++;
        if (e instanceof ErrorDatos && /Conecta Google|venció|permiso/i.test(e.message)) { setMudanza('❌ ' + e.message); break; }
      }
    }
    setMudanza(`✅ ${ok} archivo(s) mudados a tu Google Drive${mal ? ` · ${mal} no se pudieron (siguen en la nube del CRM, puedes reintentar)` : ''}.`);
    setMudando(false);
  }

  const uso = useMemo(() => {
    let nube = 0, nNube = 0, enDrive = 0, nDrive = 0;
    for (const m of ['clientes', 'polizas', 'siniestros', 'vehiculos', 'prospectos', 'pagos', 'tareas'] as const) {
      for (const r of c[m]) for (const f of adjuntos(r)) {
        if (f.drive) { enDrive += f.size ?? 0; nDrive++; } else if (f.path) { nube += f.size ?? 0; nNube++; }
      }
    }
    return { nube, nNube, enDrive, nDrive };
  }, [c]);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    void espacioDrive(token).then((e) => { if (vivo) setDrive(e); }).catch(() => {});
    return () => { vivo = false; };
  }, [token]);

  async function elegir(v: 'supabase' | 'drive') {
    setOcupado(true);
    try {
      const n = await guardarMeta<Meta['integraciones']>('integraciones', {}, (a) => ({ ...a, archivosEn: v }));
      ctx.ponerMeta('integraciones', n);
      prefDrive.archivosEn = v;
      ctx.avisar(v === 'drive' ? '📁 Los archivos nuevos irán a tu Google Drive' : '☁️ Los archivos nuevos irán a la nube del CRM');
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
    } finally { setOcupado(false); }
  }

  const cid = String(i.googleClientId ?? '');
  return (
    <>
      <h3 className="seccion">💾 Archivos y espacio</h3>
      <div className="tarjeta cfg-form">
        <p className="fila-sub"><b>¿Dónde guardar los archivos nuevos?</b> (los que ya están no se mueven y se siguen abriendo igual)</p>
        <div className="filtros">
          <button type="button" className={destino === 'supabase' ? 'activa' : ''} disabled={ocupado} onClick={() => elegir('supabase')}>☁️ Nube del CRM · 1 GB</button>
          <button type="button" className={destino === 'drive' ? 'activa' : ''} disabled={ocupado} onClick={() => elegir('drive')}>📁 Google Drive · tu plan</button>
        </div>

        <div>
          <p className="fila-sub">☁️ Nube del CRM: <b>{mb(uso.nube)}</b> de 1 GB gratis · {uso.nNube} archivos</p>
          <Barra usado={uso.nube} total={GB} />
        </div>
        <div>
          <p className="fila-sub">📁 Google Drive: <b>{mb(uso.enDrive)}</b> en {uso.nDrive} archivos del CRM
            {drive && drive.limite > 0 && <> · tu cuenta usa {mb(drive.usado)} de {mb(drive.limite)}</>}</p>
          {drive && drive.limite > 0 && <Barra usado={drive.usado} total={drive.limite} />}
        </div>

        {token && pendientes.length > 0 && (
          <div className="nota">
            Tienes <b>{pendientes.length}</b> archivo(s) en la nube del CRM. Puedes mudarlos a tu Google Drive para liberar ese espacio
            (se copian, se comprueban y recién entonces se borran de la nube).
            <button className="boton mas-abajo" type="button" disabled={mudando} onClick={mudar}>📦 Mudar todo a Google Drive</button>
          </div>
        )}
        {mudanza && <p className="fila-sub">{mudanza}</p>}

        {destino === 'drive' && !token && (
          <div className="nota">
            Para subir a Google Drive conecta tu cuenta de Google (dura 1 hora, como el calendario). Mientras no esté conectada, los archivos se guardan en la nube del CRM y luego los puedes mudar.
            {cid && <button className="boton mas-abajo" type="button" onClick={() => { window.location.href = urlConexion(cid); }}>🔗 Conectar con Google</button>}
            {!cid && <> Primero guarda tu Client ID en "Google Calendar", más abajo.</>}
          </div>
        )}

        <label className="cfg-check">
          <input type="checkbox" checked={comprimir} onChange={(e) => { setComprimir(e.target.checked); setC(e.target.checked); }} />
          📷 Comprimir fotos al subirlas (recomendado: ocupan 5 a 10 veces menos y se leen perfecto)
        </label>
        <p className="fila-sub">PDF, Word, Excel y videos nunca se modifican. Los archivos de Drive quedan en la carpeta "JAC Seguros CRM — Archivos", privados para tu cuenta.</p>
      </div>
    </>
  );
}
