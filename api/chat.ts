
import { sql } from '@vercel/postgres';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// --- Retry Logic for 429s ---
async function sendMessageWithRetry(chat: any, message: string, retries = 3, delay = 2000): Promise<any> {
    try {
        return await chat.sendMessage(message);
    } catch (error: any) {
        if (retries > 0 && (error.message?.includes('429') || error.status === 429)) {
            console.warn(`Rate limit hit (429). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendMessageWithRetry(chat, message, retries - 1, delay * 2);
        }
        throw error;
    }
}

// --- Helpers for Table Searches ---
async function searchMedications(term: string) {
    // Queries medications by name/code - GLOBAL
    const result = await sql`
        SELECT code, name 
        FROM medications 
        WHERE name ILIKE ${'%' + term + '%'} OR code ILIKE ${'%' + term + '%'}
        LIMIT 5;
    `;
    return result.rows.map(r => ({ type: 'MEDICAMENTO', ...r }));
}

async function searchPharmacies(term: string) {
    // Queries pharmacies by name/code - GLOBAL
    const result = await sql`
        SELECT code, name 
        FROM pharmacies 
        WHERE name ILIKE ${'%' + term + '%'} OR code ILIKE ${'%' + term + '%'}
        LIMIT 5;
    `;
    return result.rows.map(r => ({ type: 'FARMACIA', ...r }));
}

async function searchHistory(term: string, pharmacyCode?: string) {
    // Queries history - SCOPED TO PHARMACY
    if (!pharmacyCode) {
        return []; // Safety: No history access without context
    }

    // Simplistic search: just get latest records for this pharmacy. 
    // Ideally we would search inside the JSONB `data` column if postgres text search was enabled, 
    // but for now, showing the latest context is usually what the user wants ("what did I do?").
    // If the term is specific, we could try to match generic date params or just ignore term.

    let result;

    // Bypass filter if "Ver Todos" (00000) is selected
    if (pharmacyCode === '00000') {
        result = await sql`
            SELECT h.created_at, h.pharmacy_code, p.name as pharmacy_name, h.data
            FROM auth_history h
            LEFT JOIN pharmacies p ON h.pharmacy_code = p.code
            ORDER BY h.created_at DESC
            LIMIT 5;
        `;
    } else {
        // Scoped to specific pharmacy
        result = await sql`
            SELECT h.created_at, h.pharmacy_code, p.name as pharmacy_name, h.data
            FROM auth_history h
            LEFT JOIN pharmacies p ON h.pharmacy_code = p.code
            WHERE h.pharmacy_code = ${pharmacyCode}
            ORDER BY h.created_at DESC
            LIMIT 5;
        `;
    }

    return result.rows.map(r => ({
        type: 'HISTORIAL',
        date: r.created_at,
        pharmacy: r.pharmacy_name || r.pharmacy_code,
        details: r.data
    }));
}

// --- Intent Router ---
function detectIntent(message: string): 'MEDICATIONS' | 'PHARMACIES' | 'HISTORY' | 'GREETING' | 'GENERAL' {
    const msg = message.toLowerCase();

    // Greetings - High priority to avoid DB searches for "hola"
    if (msg.match(/^(hola|buenos dias|buenas tardes|buenas noches|que tal|como estas|hey|saludos)/)) return 'GREETING';

    if (msg.includes('farmacia') || msg.includes('sucursal') || msg.includes('ubicacion')) return 'PHARMACIES';

    // Check for ID patterns (Cedula) or typical history keywords
    if (
        msg.match(/\d{3}-?\d{7}-?\d{1}/) || // Cedula pattern
        msg.match(/\d{4,}/) || // Any sequence of 4+ digits might be a code
        msg.includes('historial') || msg.includes('pasado') || msg.includes('ayer') || msg.includes('hoy') ||
        msg.includes('transaccion') || msg.includes('orden') || msg.includes('pedido') || msg.includes('autorizacion') ||
        msg.includes('hice') || msg.includes('estatus') || msg.includes('estado') || msg.includes('revisame') ||
        msg.includes('buscame') || msg.includes('consultame')
    ) return 'HISTORY';

    if (msg.includes('medicamento') || msg.includes('pastilla') || msg.includes('jarabe') || msg.includes('precio') || msg.includes('stock') || msg.includes('codigo')) return 'MEDICATIONS';

    return 'GENERAL';
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method Not Allowed' });
    if (!process.env.GOOGLE_API_KEY) return response.status(500).json({ error: 'GOOGLE_API_KEY is not configured' });

    const { message, history, pharmacyDetails } = request.body;

    try {
        const intent = detectIntent(message);

        // Efficient Search Term Extraction
        // 1. If there's a specific code (4+ digits), prioritize it.
        // 2. Otherwise, clean up the message.
        const codeMatch = message.match(/\b\d{4,}\b/);
        let searchTerm = message;

        if (codeMatch) {
            searchTerm = codeMatch[0]; // Use the specific code (e.g. "20414")
        } else {
            // Fallback: Remove short words but keep numbers
            const cleanMessage = message.split(' ').filter((w: string) => w.length > 3 || !isNaN(Number(w))).join(' ');
            searchTerm = cleanMessage || message;
        }

        let contextData: any[] = [];
        let sourceTable = "";

        // Route to specific table
        if (intent === 'PHARMACIES') {
            contextData = await searchPharmacies(searchTerm);
            sourceTable = "FARMACIAS (Directorio Global)";
        } else if (intent === 'HISTORY') {
            contextData = await searchHistory(searchTerm, pharmacyDetails?.code);
            sourceTable = "HISTORIAL_TRANSACCIONES (Filtrado por tu Farmacia)";
        } else if (intent === 'MEDICATIONS') {
            contextData = await searchMedications(searchTerm);
            sourceTable = "MEDICAMENTOS (Catálogo Global)";
        } else if (intent === 'GREETING') {
            // No search needed
            contextData = [];
            sourceTable = "SALUDO_INICIAL";
        } else {
            // General / Ambiguous: SEARCH EVERYWHERE (Unified Search)
            // This prevents "I found nothing" when the user just types a name or code without keywords.
            const [medResults, historyResults] = await Promise.all([
                searchMedications(searchTerm),
                searchHistory(searchTerm, pharmacyDetails?.code)
            ]);

            contextData = [...medResults, ...historyResults];
            sourceTable = "BÚSQUEDA_UNIFICADA (Medicamentos + Historial)";
        }

        // 2. Build System Prompt with Context
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const pharmacyContextStr = pharmacyDetails
            ? `ESTÁS ASISTIENDO A: ${pharmacyDetails.name} (Código: ${pharmacyDetails.code}).`
            : "No hay farmacia seleccionada actualmente.";

        const systemInstruction = `
            Actúa como **Asistente PBM**, un asistente virtual experto, amigable y empático para el Portal PBM SeNaSa.
            
            CONTEXTO DE SESIÓN:
            FECHA ACTUAL: ${new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            ${pharmacyContextStr}

            INTENCIÓN DETECTADA: ${intent}
            FUENTE DE DATOS CONSULTADA: ${sourceTable}

            CONTEXTO DE DATOS RECUPERADOS:
            ${JSON.stringify(contextData, null, 2)}

            DIRECTRICES DE PERSONALIDAD:
            1. **Tono**: Sé cálido, profesional y servicial. Usa un lenguaje natural y fluido, no robótico.
            2. **Cercanía**: Usa emojis ocasionalmente (👋, 💊, ✅, 🔍) para dar vida a la conversación, pero sin exagerar.
            3. **Empatía**: Si el usuario saluda ("Hola"), responde con un saludo cordial ("¡Hola! 👋 Es un placer saludarte. ¿En qué puedo apoyarte hoy con tus medicamentos o autorizaciones?"). NO digas "no tengo datos" si solo te están saludando.

            REGLAS DE NEGOCIO:
            1. **Prioridad a los Datos**: Para consultas de medicamentos o historiales, responde BASÁNDOTE en el JSON de arriba.
            2. **Aislamiento y Permisos**: 
               - REGLA GENERAL: Solo puedes ver el historial de LA FARMACIA ACTUAL.
               - **EXCEPCIÓN ADMIN**: Si la farmacia actual es '00000' (Ver Todos), TIENES ACCESO GLOBAL. Puedes buscar, discutir y revelar información de CUALQUIER farmacia o afiliado que aparezca en los datos. No apliques restricciones de aislamiento en este caso.
            3. **Medicamentos**: NO INVENTES PRECIOS ni disponibilidades si no están en la lista. Solo confirma código y nombre si aparecen.
            4. **Validación de Fechas**: Si preguntan por 'HOY', compara estrictamente la fecha con FECHA ACTUAL.
            5. **Manejo de Vacíos**: Si la búsqueda de datos está vacía:
               - Si es un SALUDO: Ignora los datos vacíos y saluda.
               - Si es una CONSULTA: Di amablemente que no encontraste registros con esos términos en esta farmacia. Ofrece buscar de otra forma. "No veo esa información por aquí, ¿quieres que intente buscar..."
        `;

        const chat = model.startChat({
            history: history || [],
            generationConfig: { maxOutputTokens: 800 },
        });

        const finalPrompt = systemInstruction + "\n\nPregunta del usuario: " + message;
        const result = await sendMessageWithRetry(chat, finalPrompt);

        return response.status(200).json({ text: result.response.text() });

    } catch (error: any) {
        console.error("Gemini/DB Error:", error);
        if (error.message?.includes('429')) return response.status(429).json({ error: 'Sistema ocupado, reintentando...' });
        return response.status(500).json({ error: error.message || 'Error processing request' });
    }
}
