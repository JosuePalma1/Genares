import { DataSource } from 'typeorm';
import { registrarReemplazo } from './reemplazos';

const datos = { etapa: 'oral', puesto: 'puesto', docente: 'suplente', anterior: 'titular', motivo: 'Ausencia', continuarBorrador: false };
function preparar(estados: string[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FOR UPDATE')) return [{id:'proceso'}];
    if (sql.includes('AS puesto')) return [{puesto:'puesto',docente:'titular',sujeto:'sujeto'}];
    if (sql.includes('SELECT 1 FROM s3.miembros_tribunal')) return [{presente:1}];
    if (sql.includes('SELECT estado')) return estados.map(estado=>({estado}));
    return [];
  });
  const db = {transaction: (fn:(m:{query:typeof query})=>unknown)=>fn({query})} as unknown as DataSource;
  return {db,query};
}
describe('Reemplazo por etapa',()=>{
  it('registra actor y motivo una vez y conserva el puesto', async()=>{
    const {db,query}=preparar();
    await expect(registrarReemplazo(db,'trabajo',datos,'admin')).resolves.toEqual({registrado:true});
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO s4.reemplazos_etapa'),
      ['proceso','oral','puesto','titular','suplente','Ausencia','admin']);
  });
  it('rechaza una sustitución basada en una asignación obsoleta', async()=>{
    await expect(registrarReemplazo(preparar().db,'trabajo',{...datos,anterior:'otro'},'admin')).rejects.toThrow(/cambió/);
  });
  it('la nota cerrada conserva su autor aunque se solicite transferir el borrador', async()=>{
    await expect(registrarReemplazo(preparar(['CERRADA']).db,'trabajo',{...datos,continuarBorrador:true},'admin')).rejects.toThrow(/cerrada/);
  });
  it('exige confirmación para continuar un borrador', async()=>{
    await expect(registrarReemplazo(preparar(['BORRADOR']).db,'trabajo',datos,'admin')).rejects.toThrow(/borrador/);
  });
});
