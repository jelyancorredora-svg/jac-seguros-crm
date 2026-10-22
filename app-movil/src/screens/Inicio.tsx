import { useMemo } from 'react';
import { EtiquetaEstado, Fila, Vacio } from '../components/Piezas';
import { fec, num, txt } from '../lib/datos';
import { diasHasta, dinero, fecha } from '../lib/formato';
import { polizaVigente, prospectoAbierto, seguimientoProspecto, siniestroAbierto, tareaAbierta } from '../lib/reglas';
import type { Ctx } from './Modulos';
import type { PantallaWeb, Pestana } from '../App';

export function Inicio({ ctx, irA, irLista, irInformes, irWeb }: {
  ctx: Ctx; irA: (p: Pestana) => void; irLista: (m: 'siniestros' | 'prospectos' | 'pagos' | 'comisiones') => void; irInformes: () => void;
  irWeb: (p: PantallaWeb) => void;
}) {
  const { cartera } = ctx;
  const r = useMemo(() => {
    const vigentes = cartera.polizas.filter(polizaVigente);
    const porVencer = vigentes
      .map((p) => ({ p, d: diasHasta(fec(p, 'fechaFin')) }))
      .filter((x): x is { p: typeof x.p; d: number } => x.d !== null && x.d >= 0 && x.d <= 30)
      .sort((a, b) => a.d - b.d);
    const tareas = cartera.tareas.filter(tareaAbierta);
    const hoyAtras = tareas.filter((t) => { const d = diasHasta(fec(t, 'fechaLimite')); return d !== null && d <= 0; })
      .sort((a, b) => fec(a, 'fechaLimite').localeCompare(fec(b, 'fechaLimite')));
    const contactar = cartera.prospectos.filter((p) => { const d = diasHasta(seguimientoProspecto(p)); return prospectoAbierto(p) && d !== null && d <= 0; });
    const prima = vigentes.reduce((s, p) => s + (num(p, 'total') ?? num(p, 'prima') ?? 0), 0);
    // Igual que el Dashboard del CRM web
    const cp = cartera.comisiones.filter((c) => txt(c, 'estado') === 'pendiente');
    const totalConv = cartera.clientes.length + cartera.prospectos.length;
    const hoyMD = new Date().toISOString().slice(5, 10);
    const cumple = cartera.clientes.filter((c) => (fec(c, 'fNac') || fec(c, 'fechaNac')).slice(5, 10) === hoyMD).length;
    const hoy = new Date().toISOString().slice(0, 10);
    const notas = cartera.meta.notas.filter((n) => n.done !== true && txt(n, 'fecha') && txt(n, 'fecha') <= hoy).length;
    return {
      comPend: cp.reduce((s, c) => s + (num(c, 'monto') ?? 0), 0), comPendN: cp.length,
      prospectos: cartera.prospectos.filter(prospectoAbierto).length,
      conversion: totalConv ? Math.round((cartera.clientes.length / totalConv) * 100) : 0,
      cumple, notas,
      vigentes: vigentes.length, prima, porVencer, tareas: tareas.length, hoyAtras, contactar,
      siniestros: cartera.siniestros.filter(siniestroAbierto).length, clientes: cartera.clientes.length,
    };
  }, [cartera]);

  return (
    <>
      <div className="kpis">
        <button className="kpi" type="button" onClick={() => irA('clientes')}><b>{r.clientes}</b><span>Clientes</span></button>
        <button className="kpi" type="button" onClick={() => irA('polizas')}><b>{r.vigentes}</b><span>Pólizas vigentes</span></button>
        <button className={`kpi${r.porVencer.length ? ' alerta' : ''}`} type="button" onClick={() => irA('polizas')}>
          <b>{r.porVencer.length}</b><span>Vencen en 30 días</span></button>
        <button className={`kpi${r.hoyAtras.length ? ' alerta' : ''}`} type="button" onClick={() => irA('agenda')}>
          <b>{r.tareas}</b><span>Tareas pendientes</span></button>
        <button className="kpi" type="button" onClick={() => irLista('siniestros')}><b>{r.siniestros}</b><span>Siniestros abiertos</span></button>
        <button className="kpi" type="button" onClick={() => irA('polizas')}><b className="kpi-dinero">{dinero(r.prima)}</b><span>Primas vigentes</span></button>
        <button className="kpi" type="button" onClick={() => irLista('prospectos')}><b>{r.prospectos}</b><span>Prospectos en curso</span></button>
        <button className="kpi" type="button" onClick={() => irLista('comisiones')}><b className="kpi-dinero">{dinero(r.comPend)}</b><span>Comisión por cobrar · {r.comPendN}</span></button>
        <button className="kpi" type="button" onClick={() => irA('clientes')}><b>{r.conversion}%</b><span>Conversión</span></button>
        <button className={`kpi${r.cumple ? ' alerta' : ''}`} type="button" onClick={() => irWeb('cumpleanos')}><b>{r.cumple}</b><span>🎂 Cumpleaños hoy</span></button>
      </div>
      {r.notas > 0 && (
        <button className="nota boton-nota" type="button" onClick={() => irWeb('notas')}>📝 {r.notas} nota{r.notas === 1 ? '' : 's'} vencida{r.notas === 1 ? '' : 's'} o para hoy · Ver</button>
      )}
      <div className="botonera fila-botones">
        <button className="boton secundario" type="button" onClick={() => irA('crm')}>📈 Pipeline CRM</button>
        <button className="boton secundario" type="button" onClick={irInformes}>📊 Informes</button>
      </div>

      <h3 className="seccion">Próximos vencimientos</h3>
      {r.porVencer.length ? (
        <div className="lista">
          {r.porVencer.slice(0, 15).map(({ p, d }) => (
            <Fila key={p.id} titulo={txt(p, 'nombreCliente') || 'Sin nombre'}
              sub={`${txt(p, 'ramo')} · ${txt(p, 'aseg')} · ${fecha(fec(p, 'fechaFin'))}`}
              derecha={<span className={`etiqueta ${d === 0 ? 'e-peligro' : 'e-aviso'}`}>{d === 0 ? 'Hoy' : `${d} días`}</span>}
              onClick={() => ctx.abrir('polizas', p.id)} />
          ))}
        </div>
      ) : <Vacio>No hay pólizas por vencer en los próximos 30 días.</Vacio>}

      <h3 className="seccion">Tareas para hoy o atrasadas</h3>
      {r.hoyAtras.length ? (
        <div className="lista">
          {r.hoyAtras.slice(0, 15).map((t) => (
            <Fila key={t.id} titulo={txt(t, 'titulo') || 'Tarea'} sub={fecha(fec(t, 'fechaLimite'))}
              derecha={<EtiquetaEstado estado={txt(t, 'etapaTarea') || null} />} onClick={() => ctx.abrir('tareas', t.id)} />
          ))}
        </div>
      ) : <Vacio>Nada atrasado. ¡Buen trabajo!</Vacio>}

      {r.contactar.length > 0 && (
        <>
          <h3 className="seccion">Prospectos por contactar</h3>
          <div className="lista">
            {r.contactar.slice(0, 15).map((p) => (
              <Fila key={p.id} titulo={txt(p, 'nombre') || 'Prospecto'} sub={`${txt(p, 'etapaVenta')} · ${fecha(seguimientoProspecto(p))}`}
                onClick={() => ctx.abrir('prospectos', p.id)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
