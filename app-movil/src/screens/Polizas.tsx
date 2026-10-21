import { useMemo, useState } from 'react';
import { Accion, Datos, EtiquetaEstado, EtiquetaPoliza, Fila, Vacio } from '../components/Piezas';
import { polizaVigente, type Cartera, type Poliza } from '../lib/datos';
import { diasHasta, dinero, enlaceCorreo, enlaceLlamada, enlaceWhatsApp, fecha, normalizar } from '../lib/formato';
import type { Abrir } from '../App';

type Filtro = 'vencen' | 'vigentes' | 'vencidas' | 'todas';
const FILTROS: Array<[Filtro, string]> = [
  ['vencen', 'Vencen en 30 días'], ['vigentes', 'Vigentes'], ['vencidas', 'Vencidas'], ['todas', 'Todas'],
];
const MAX_LISTA = 150;

export function Polizas({ cartera, abrir }: { cartera: Cartera; abrir: Abrir }) {
  const [filtro, setFiltro] = useState<Filtro>('vencen');
  const [q, setQ] = useState('');

  const lista = useMemo(() => {
    const t = normalizar(q);
    let ps = cartera.polizas.filter((p) => {
      const d = diasHasta(p.fecha_fin);
      if (filtro === 'vencen') return polizaVigente(p) && d !== null && d >= 0 && d <= 30;
      if (filtro === 'vigentes') return polizaVigente(p);
      if (filtro === 'vencidas') return /vencida/i.test(p.estado ?? '') || (polizaVigente(p) && d !== null && d < 0);
      return true;
    });
    if (t) {
      ps = ps.filter((p) =>
        [p.nombre_cliente, p.num, p.aseg, p.ramo, p.riesgo].some((x) => normalizar(x).includes(t)));
    }
    return ps.sort((a, b) =>
      filtro === 'vencen' || filtro === 'vigentes'
        ? (a.fecha_fin ?? '9999').localeCompare(b.fecha_fin ?? '9999')
        : (b.fecha_fin ?? '').localeCompare(a.fecha_fin ?? ''));
  }, [cartera.polizas, filtro, q]);

  return (
    <>
      <input className="buscador" type="search" placeholder="Cliente, número, aseguradora o ramo"
        value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="none" spellCheck={false} maxLength={80} />
      <div className="filtros">
        {FILTROS.map(([k, t]) => (
          <button key={k} type="button" className={filtro === k ? 'activa' : ''} onClick={() => setFiltro(k)}>{t}</button>
        ))}
      </div>
      {lista.length ? (
        <div className="lista">
          {lista.slice(0, MAX_LISTA).map((p) => (
            <Fila key={p.id} titulo={p.nombre_cliente || 'Sin nombre'}
              sub={`${p.ramo ?? ''} · ${p.aseg ?? ''} · ${fecha(p.fecha_fin)}`}
              derecha={<EtiquetaPoliza estado={p.estado} fin={p.fecha_fin} />}
              onClick={() => abrir({ tipo: 'poliza', id: p.id })} />
          ))}
        </div>
      ) : (
        <Vacio>No hay pólizas en esta vista.</Vacio>
      )}
      {lista.length > MAX_LISTA && <p className="sincro">Mostrando {MAX_LISTA} de {lista.length}.</p>}
    </>
  );
}

export function PolizaDetalle({ poliza, cartera, abrir }: { poliza: Poliza; cartera: Cartera; abrir: Abrir }) {
  const cliente = cartera.clientes.find((c) => c.id === poliza.cliente_id);
  const cel = cliente?.cel || poliza.cel_cliente;
  const email = cliente?.email || poliza.email_cliente;
  const pagos = cartera.pagos
    .filter((p) => p.poliza_id === poliza.id)
    .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));

  return (
    <>
      <div className="acciones">
        <Accion icono="llamar" texto="Llamar" href={enlaceLlamada(cel || cliente?.tel)} />
        <Accion icono="chat" texto="WhatsApp" href={enlaceWhatsApp(cel)} />
        <Accion icono="correo" texto="Correo" href={enlaceCorreo(email)} />
      </div>
      <div className="tarjeta">
        <Datos filas={[
          ['Estado', <EtiquetaPoliza key="e" estado={poliza.estado} fin={poliza.fecha_fin} />],
          ['Número', poliza.num],
          ['Aseguradora', poliza.aseg],
          ['Ramo', [poliza.ramo, poliza.subramo].filter(Boolean).join(' · ')],
          ['Riesgo', poliza.riesgo],
          ['Cobertura', poliza.cobertura],
          ['Inicio', fecha(poliza.fecha_inicio)],
          ['Vence', fecha(poliza.fecha_fin)],
          ['Prima', dinero(poliza.prima)],
          ['Total', dinero(poliza.total)],
          ['Forma de pago', poliza.forma_pago],
          ['Comisión', dinero(poliza.comision)],
          ['Vendedor', poliza.vendedor],
        ]} />
      </div>
      {cliente && (
        <div className="lista">
          <Fila titulo={cliente.nombre || 'Cliente'} sub="Ver ficha del cliente"
            onClick={() => abrir({ tipo: 'cliente', id: cliente.id })} />
        </div>
      )}
      {poliza.obs && (
        <>
          <h3 className="seccion">Observaciones</h3>
          <div className="tarjeta"><p className="texto-largo">{poliza.obs}</p></div>
        </>
      )}
      <h3 className="seccion">Pagos</h3>
      {pagos.length ? (
        <div className="lista">
          {pagos.map((p) => (
            <Fila key={p.id} titulo={dinero(p.monto)} sub={[fecha(p.fecha), p.metodo, p.referencia].filter(Boolean).join(' · ')}
              derecha={<EtiquetaEstado estado={p.estado} />} />
          ))}
        </div>
      ) : <Vacio>Sin pagos registrados.</Vacio>}
    </>
  );
}
