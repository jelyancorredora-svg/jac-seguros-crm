import { useMemo, useState } from 'react';
import { datosPoliza } from '../lib/contacto';
import { BotonesContacto } from '../components/Contactar';
import { Vacio } from '../components/Piezas';
import { ListaLarga } from '../components/Registro';
import { fec, num, txt } from '../lib/datos';
import { diasHasta, dinero, fecha } from '../lib/formato';
import { polizaCancelada } from '../lib/reglas';
import type { Ctx } from './Modulos';

/* Replica de "Portafolio por Ramo" del CRM web (pg-port) */
const RAMOS: Array<[string, string]> = [
  ['AUTOS/VEHÍCULOS', '🚗 Autos'], ['MOTOS', '🏍 Motos'], ['VIDA', '💛 Vida'], ['SALUD/MÉDICOS', '🏥 Salud/Méd.'],
  ['INCENDIO Y LÍNEAS ALIADAS', '🔥 Incendio'], ['HOGAR', '🏠 Hogar'], ['ACCIDENTES PERSONALES', '🩹 AP'],
  ['FIANZAS/ROBO/SUSTRACCIÓN', '🔒 Fianzas'], ['RESPONSABILIDAD CIVIL', '⚖️ RC'], ['SOAT', '📄 SOAT'], ['VIAJES/TURISMO', '✈️ Viajes'],
];

export function Portafolio({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [ramo, setRamo] = useState(RAMOS[0][0]);
  const otros = useMemo(() => {
    const conocidos = new Set(RAMOS.map(([r]) => r));
    return [...new Set(cartera.polizas.map((p) => txt(p, 'ramo')).filter((r) => r && !conocidos.has(r)))].sort();
  }, [cartera.polizas]);
  const fil = cartera.polizas.filter((p) => txt(p, 'ramo') === ramo)
    .sort((a, b) => fec(a, 'fechaFin').localeCompare(fec(b, 'fechaFin')));
  const tP = fil.reduce((s, p) => s + (num(p, 'total') ?? num(p, 'prima') ?? 0), 0);
  const tC = fil.reduce((s, p) => s + (num(p, 'comision') ?? 0), 0);
  const vig = fil.filter((p) => (diasHasta(fec(p, 'fechaFin')) ?? -1) >= 0 && !polizaCancelada(p)).length;
  const ven = fil.filter((p) => (diasHasta(fec(p, 'fechaFin')) ?? 0) < 0 && !polizaCancelada(p)).length;
  const cuenta = (r: string) => cartera.polizas.filter((p) => txt(p, 'ramo') === r).length;
  return (
    <>
      <div className="ag-tabs">
        {[...RAMOS, ...otros.map((r): [string, string] => [r, r])].map(([r, t]) => (
          <button key={r} type="button" className={ramo === r ? 'activa' : ''} onClick={() => setRamo(r)}>{t} {cuenta(r)}</button>
        ))}
      </div>
      <div className="kpis">
        <div className="kpi"><b>{fil.length}</b><span>{vig} vigentes · {ven} vencidas</span></div>
        <div className="kpi"><b className="kpi-dinero">{dinero(tP)}</b><span>Prima total</span></div>
        <div className="kpi"><b className="kpi-dinero verde-t">{dinero(tC)}</b><span>Mis comisiones</span></div>
      </div>
      {fil.length ? (
        <ListaLarga items={fil} vacio="" render={(p) => {
          const cl = cartera.clientes.find((c) => c.id === txt(p, 'clienteId'));
          const nom = txt(cl, 'nombre') || txt(p, 'nombreCliente') || '—';
          const d = diasHasta(fec(p, 'fechaFin'));
          return (
            <div key={p.id} className="fila">
              <button type="button" className="fila-boton" onClick={() => ctx.abrir('polizas', p.id)}>
                <div className="fila-cuerpo">
                  <div className="fila-titulo">{nom}</div>
                  <div className="fila-sub">{[txt(p, 'num'), txt(p, 'aseg'), txt(p, 'subramo'), txt(p, 'riesgo').slice(0, 40)].filter(Boolean).join(' · ')}</div>
                  <div className="fila-sub">{dinero(num(p, 'total') ?? num(p, 'prima'))} · Com. {dinero(num(p, 'comision'))} · vence {fecha(fec(p, 'fechaFin'))}</div>
                </div>
                <span className={`etiqueta ${polizaCancelada(p) ? 'e-neutra' : d !== null && d < 0 ? 'e-peligro' : d !== null && d <= 30 ? 'e-aviso' : 'e-ok'}`}>
                  {polizaCancelada(p) ? 'Cancelada' : d === null ? '—' : d < 0 ? 'Vencida' : d <= 30 ? `${d}d` : 'Vigente'}
                </span>
              </button>
              {cl && <button type="button" className="mini" onClick={() => ctx.abrir('clientes', cl.id)} aria-label={`Ver cliente ${nom}`}>👤</button>}
              <div className="fila-acciones"><BotonesContacto ctx={ctx} d={datosPoliza(p, cartera)} /></div>
            </div>
          );
        }} />
      ) : <Vacio>Sin pólizas en {ramo}.</Vacio>}
    </>
  );
}
