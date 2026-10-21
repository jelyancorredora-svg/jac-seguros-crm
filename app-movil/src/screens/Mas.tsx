import { Icono, type NombreIcono } from '../components/Icono';
import { txt } from '../lib/datos';
import type { Modulo } from '../lib/esquema';
import { prospectoAbierto, siniestroAbierto } from '../lib/reglas';
import type { Ctx } from './Modulos';

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function Mas({ ctx, irLista, irAjustes }: { ctx: Ctx; irLista: (m: Modulo) => void; irAjustes: () => void }) {
  const c = ctx.cartera;
  const pend = c.pagos.filter((p) => !/pagad|cobrad/i.test(txt(p, 'estado'))).length;
  const opciones: Array<[() => void, NombreIcono | string, string, string]> = [
    [() => irLista('siniestros'), 'siniestros', 'Siniestros', cuantos(c.siniestros.filter(siniestroAbierto).length, 'abierto', 'abiertos')],
    [() => irLista('prospectos'), 'embudo', 'Prospectos', `${c.prospectos.filter(prospectoAbierto).length} en curso`],
    [() => irLista('pagos'), '💳', 'Pagos', cuantos(pend, 'pendiente', 'pendientes')],
    [() => irLista('vehiculos'), '🚗', 'Autos / motos', cuantos(c.vehiculos.length, 'vehículo', 'vehículos')],
    [() => irLista('comisiones'), '💰', 'Comisiones', cuantos(c.comisiones.length, 'registro', 'registros')],
    [irAjustes, 'ajustes', 'Ajustes y seguridad', 'Dos pasos, contraseña, cerrar sesión'],
  ];
  return (
    <div className="lista menu">
      {opciones.map(([fn, i, t, sub]) => (
        <button key={t} className="fila" type="button" onClick={fn}>
          <div className="avatar">{i.length > 2 && /^[a-z]/.test(i) ? <Icono nombre={i as NombreIcono} /> : i}</div>
          <div className="fila-cuerpo">
            <div className="fila-titulo">{t}</div>
            <div className="fila-sub">{sub}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
