
import 'dotenv/config';
import { secondaryDb } from '../api/lib/secondary-db';

async function applyIndexes() {
    console.log('🚀 Starting Database Optimization (Strategy 1: Indexes)...');

    const queries = [
        {
            name: 'idx_dhm_fecha_solicitud',
            sql: `CREATE INDEX IF NOT EXISTS idx_dhm_fecha_solicitud ON public.dhm (fechadesolicitud);`
        },
        {
            name: 'idx_dhm_fecha_receta',
            sql: `CREATE INDEX IF NOT EXISTS idx_dhm_fecha_receta ON public.dhm (fechareceta);`
        },
        {
            name: 'idx_dhm_nombrefarmacia',
            sql: `CREATE INDEX IF NOT EXISTS idx_dhm_nombrefarmacia ON public.dhm (nombrefarmacia);`
        },
        {
            name: 'idx_dhm_cedula',
            sql: `CREATE INDEX IF NOT EXISTS idx_dhm_cedula ON public.dhm (cedula);`
        }
    ];

    try {
        for (const q of queries) {
            console.log(`Populating index: ${q.name}... (This might take a while for 4M rows)`);
            const start = Date.now();
            await secondaryDb.query(q.sql);
            const duration = ((Date.now() - start) / 1000).toFixed(2);
            console.log(`✅ Success: ${q.name} created in ${duration}s`);
        }
        console.log('🎉 All indexes applied successfully!');
    } catch (error) {
        console.error('❌ Error applying indexes:', error);
    } finally {
        await secondaryDb.pool.end();
        process.exit();
    }
}

applyIndexes();
