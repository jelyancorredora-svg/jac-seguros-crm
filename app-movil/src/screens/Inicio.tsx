import { useMemo } from 'react';
import { EtiquetaEstado, EtiquetaVence, Fila, Vacio } from '../components/Piezas';
import { polizaVigente, siniestroAbierto, tareaAbierta, type Cartera } from '../lib/datos';
import { diasHasta, fecha } from '../lib/formato';
import type { Abrir, Pestana } from '../App';

export function Inicio({ cartera, abrir, irA }: { cartera: Cartera; abrir: Abrir; irA: (p: Pestana) => void }) {
  const r = useMemo(() => {
    const vigentes = cartera.polizas.filter(polizaVigente);
    const porVencer = vigentes
      .map((p) => ({ p, d: diasHasta(p.fecha_fin) }))
      .filter((x): x is { p: typeof x.p; d: number } => x.d !== null && x.d >= 0 && x.d <= 30)
      .sort((a, b) => a.d - b.d);
    const tareas = cartera.tareas
      .filter(tareaAbierta)
      .sort((a, b) => (a.fecha_limite ?? '9999').localeCompare(b.fecha_limite ?? '9999'));
    const vencidasHoy = tareas.filter((t) => {
      const d = diasHasta(t.fecha_limite);
      return d !== null && d <= 0;
    });
    return {
      vigentes: vigentes.length,
      porVencer,
      siniestros: cartera.siniestros.filter(siniestroAbierto).length,
      tareas,
      vencidasHoy,
    };
  }, [cartera]);

  return (
    <>
      <div className="kpis">
        <button className="kpi" type="button" onClick={() => irA('polizas')}>
          <b>{r.vigentes}</b><span>Pólizas vigentes</span>
        </button>
        <button className={`kpi${r.porVencer.length ? ' alerta' : ''}`} type="button" onClick={() => irA('polizas')}>
          <b>{r.porVencer.length}</b><span>Vencen en 30 días</span>
        </button>
        <button className="kpi" type="button" onClick={() => irA('siniestros')}>
          <b>{r.siniestros}</b><span>Siniestros abiertos</span>
        </button>
        <button className={`kpi${r.vencidasHoy.length ? ' alerta' : ''}`} type="button" onClick={() => irA('tareas')}>
          <b>{r.tareas.length}</b><span>Tareas pendientes</span>
        </button>
      </div>

      <h3 className="seccion">Próximos vencimientos</h3>
      {r.porVencer.length ? (
        <div className="lista">
          {r.porVencer.slice(0, 15).map(({ p }) => (
            <Fila key={p.id} titulo={p.nombre_cliente || 'Sin nombre'}
              sub={`${p.ramo ?? ''} · ${p.aseg ?? ''} · ${fecha(p.fecha_fin)}`}
              derecha={<EtiquetaVence fin={p.fecha_fin} />} onClick={() => abrir({ tipo: 'poliza', id: p.id })} />
          ))}
        </div>
      ) : (
        <Vacio>No hay pólizas por vencer en los próximos 30 días.</Vacio>
      )}

      <h3 className="seccion">Tareas para hoy o atrasadas</h3>
      {r.vencidasHoy.length ? (
        <div className="lista">
          {r.vencidasHoy.slice(0, 15).map((t) => (
            <Fila key={t.id} titulo={t.titulo || 'Tarea'} sub={`${t.tipo ?? ''} · ${fecha(t.fecha_limite)}`}
              derecha={<EtiquetaEstado estado={t.etapa_tarea} />} onClick={() => irA('tareas')} />
          ))}
        </div>
      ) : (
        <Vacio>Nada atrasado. ¡Buen trabajo!</Vacio>
      )}
    </>
  );
}
