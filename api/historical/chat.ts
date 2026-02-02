import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// --- Shared Logic Inlined ---
const pool = new Pool(
    process.env.SECONDARY_POSTGRES_URL
        ? {
            connectionString: process.env.SECONDARY_POSTGRES_URL,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
        }
        : {
            host: process.env.KONTROLA_DB_HOST,
            user: process.env.KONTROLA_DB_USER,
            password: process.env.KONTROLA_DB_PASSWORD,
            database: process.env.KONTROLA_DB_NAME,
            port: 5432,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
        }
);

const secondaryDb = {
    query: (text: string, params?: any[]) => pool.query(text, params),
};

const TABLE_SCHEMA = `
Table "dhm" (Data Histórica de Medicamentos):
- codautorizacion (varchar)
- codigofarmacia (varchar)
- nombrefarmacia (varchar)
- tipofarmacia (varchar)
- numeroafiliado (varchar)
- nombreafiliado (varchar)
- fechanacimiento (varchar)
- edad (varchar)
- sexo (varchar)
- cedula (varchar)
- telefono (varchar)
- doctor (varchar)
- centro (varchar)
- simon (varchar): Código Simón
- descripcion (varchar): Medicamento
- cantidad (varchar): (IMPORTANTE: CAST TO NUMERIC)
- dias (varchar)
- precio (varchar): (IMPORTANTE: CAST TO NUMERIC)
- facturado (varchar): (IMPORTANTE: CAST TO NUMERIC)
- copago (varchar): (IMPORTANTE: CAST TO NUMERIC)
- totalcobertura (varchar): (IMPORTANTE: CAST TO NUMERIC)
- coberturaplancomplementario (varchar)
- coberturaplanvolunatario (varchar)
- coberturaplanpbs (varchar)
- coberturapyp (varchar)
- fechareceta (varchar)
- tiporeceta (varchar)
- fechadesolicitud (varchar)
- horasolicitud (varchar)
- fechadeprocesamiento (varchar)
- cedulasolicitante (varchar)
- pasaporte (varchar)
- licenciadeconducir (varchar)
- permisodetrabajo (varchar)
- fechareverso (varchar)
- motivodereverso (varchar)
- reversado (varchar): 'S' anula, 'N' activa
- usuariogenerador (varchar)
- numerorecetapyp (varchar)
- usuariopyp (varchar)
- esprogramapyp (varchar)
`;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T>(operation: () => Promise<T>, retries = 1, delay = 5000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        // Build a broad error string to check against
        const errStr = (error.message || '') + (error.toString() || '');

        if (retries > 0 && (
            errStr.includes('429') ||
            errStr.includes('Resource exhausted') ||
            errStr.includes('Too Many Requests')
        )) {
            console.warn(`⚠️ AI Rate Limit (429) detected. Pausing for ${delay / 1000}s before retry...`);
            await wait(delay);
            return callWithRetry(operation, retries - 1, delay);
        }
        throw error;
    }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
    // --- CORS Headers ---
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }
    // ---------------------

    if (request.method !== 'POST') return response.status(405).json({ error: 'Method Not Allowed' });

    const { message, previousMessages, table = 'dhm' } = request.body;

    // STRICT SECURITY CHECK
    const allowedTables = ['dhm', 'dhm2'];
    if (!allowedTables.includes(table)) {
        return response.status(400).json({ error: 'Invalid table parameter' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const systemInstruction =
            "Eres un experto analista de datos SQL (PostgreSQL).\n" +
            `Tu trabajo es CONVERTIR preguntas de lenguaje natural a consultas SQL para la tabla '${table}'.\n\n` +
            "ESQUEMA DE BASE DE DATOS:\n" +
            TABLE_SCHEMA.replace('Table "dhm"', `Table "${table}"`) + "\n\n" +
            "REGLAS CRÍTICAS DE SEGURIDAD Y TIPOS:\n" +
            "1. **CASTING OBLIGATORIO**: Las columnas 'precio', 'copago', 'totalcobertura', 'cantidad' son VARCHAR. Para SUM, AVG, o comparaciones numéricas, DEBES escribirlas como \"columna::NUMERIC\".\n" +
            "   - MAL: \"SUM(totalcobertura)\"\n" +
            "   - BIEN: \"SUM(totalcobertura::NUMERIC)\"\n\n" +
            "2. Solo puedes generar sentencias SELECT.\n" +
            "3. NUNCA generes INSERT, UPDATE, DELETE, DROP, ALTER, o TRUNCATE.\n" +
            "4. SIEMPRE limita los resultados a máximo 20 filas (LIMIT 20) a menos que sea una agregación.\n" +
            "5. Para búsquedas de texto, usa ILIKE y comodines %.\n\n" +
            "EJEMPLOS FEW-SHOT (Sigue estos patrones):\n" +
            "- Usuario: \"Total autorizado este mes\"\n" +
            `  SQL: SELECT SUM(totalcobertura::NUMERIC) FROM ${table} WHERE fechareceta LIKE '2025-02%'\n\n` +
            "- Usuario: \"Farmacia con mayor ventas\"\n" +
            `  SQL: SELECT nombrefarmacia, SUM(totalcobertura::NUMERIC) as total FROM ${table} GROUP BY nombrefarmacia ORDER BY total DESC LIMIT 1\n\n` +
            "- Usuario: \"Precio promedio de Acetaminofen\"\n" +
            `  SQL: SELECT AVG(precio::NUMERIC) FROM ${table} WHERE descripcion ILIKE '%Acetaminofen%'\n\n` +
            "- Usuario: \"Recetas con copago mayor a 1000\"\n" +
            `  SQL: SELECT * FROM ${table} WHERE copago::NUMERIC > 1000 LIMIT 20\n\n` +
            "IMPORTANTE SOBRE FECHAS:\n" +
            "- Las columnas 'fechareceta' y 'fechadesolicitud' son VARCHAR (no DATE).\n" +
            "- NO uses ':: DATE' directo porque rompe índices. Usa 'LIKE'.\n" +
            "- Ejemplo CORRECTO: \"WHERE fechareceta LIKE '2025-10-27%'\"\n\n" +
            "- Ejemplo CORRECTO: \"WHERE fechareceta >= '2025-10-01' AND fechareceta < '2025-11-01'\" (Para rango)\n" +
            "- Ejemplo CORRECTO: \"WHERE fechareceta LIKE CURRENT_DATE::TEXT || '%'\" (Para hoy)\n\n" +
            "IMPORTANTE SOBRE CAMPOS NUMÉRICOS (VARCHAR):\n" +
            "- Las columnas 'precio', 'cantidad', 'copago', 'totalcobertura', 'coberturaplan...' son VARCHAR.\n" +
            "- Para operaciones matemáticas (SUM, AVG, >, <) DEBES castearlos a NUMERIC.\n" +
            `  - Ejemplo CORRECTO: \"SELECT SUM(totalcobertura::NUMERIC) FROM ${table}\"\n` +
            "- Ejemplo CORRECTO: \"WHERE precio::NUMERIC > 1000\"\n" +
            "- Ejemplo CORRECTO: \"ORDER BY cantidad::NUMERIC DESC\"\n\n" +
            "FORMATO DE RESPUESTA JSON:\n" +
            "Debes responder ÚNICAMENTE con un objeto JSON (sin markdown code blocks):\n" +
            "{\n" +
            "    \"sql\": \"SELECT ...\",\n" +
            "    \"explanation\": \"Breve explicación de qué hace la consulta\"\n" +
            "}";

        // --- HISTORY PROCESSING ---
        // Convert Frontend messages to Gemini History
        // RULE: Semantic history MUST start with 'user'.
        // logic: Find the first 'user' message and slice from there.
        let validMessages = previousMessages || [];
        const firstUserIndex = validMessages.findIndex((m: any) => m.role === 'user');

        if (firstUserIndex === -1) {
            // No user messages found in history? Then history is effectively empty/unusable for context.
            validMessages = [];
        } else {
            // Keep everything from the first user message onwards
            validMessages = validMessages.slice(firstUserIndex);
        }

        const history = validMessages.map((msg: any) => {
            if (msg.role === 'user') {
                return { role: 'user', parts: [{ text: msg.text }] };
            } else {
                // Model: Must STRICTLY return JSON to keep the AI on track
                // If it was a SQL response, reconstruct the JSON
                const responseObj = msg.sql
                    ? { sql: msg.sql, explanation: msg.explanation || "Query generated" }
                    : { sql: null, explanation: msg.text };

                return { role: 'model', parts: [{ text: JSON.stringify(responseObj) }] };
            }
        });

        // Initialize chat with history or default welcome
        const chat = model.startChat({
            history: history.length > 0 ? history : [
                { role: 'user', parts: [{ text: "Hola" }] },
                { role: 'model', parts: [{ text: JSON.stringify({ sql: null, explanation: "Hola, estoy listo para consultar la base de datos." }) }] }
            ],
            generationConfig: { responseMimeType: "application/json" }
        });

        // --- SQL GENERATION WITH RETRY ---
        const result = await callWithRetry(() =>
            chat.sendMessage(`Genera SQL para: "${message}" \n ${systemInstruction}`)
        );

        const responseText = result.response.text();
        console.log("Gemini SQL Response:", responseText);

        let parsedParams;
        try {
            parsedParams = JSON.parse(responseText);
        } catch (e) {
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '');
            try {
                parsedParams = JSON.parse(cleanText);
            } catch (e2) {
                console.error("Failed to parse JSON:", cleanText);
                throw new Error("Invalid format from AI");
            }
        }

        if (!parsedParams.sql) {
            return response.status(200).json({
                text: parsedParams.explanation || "No entendí la pregunta como una consulta de datos.",
                data: []
            });
        }

        const sqlRaw = (parsedParams.sql || "").trim();
        const sqlUpper = sqlRaw.toUpperCase();
        const sqlClean = sqlUpper.endsWith(';') ? sqlUpper.slice(0, -1) : sqlUpper;

        if (!sqlClean.startsWith("SELECT")) {
            return response.status(400).json({ error: "Consulta no permitida (Solo SELECT)." });
        }

        // 1. Block DML/DDL with Regex (Word Boundaries)
        const forbiddenPattern = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE|REPLACE|v\$|pg_shadow|pg_user)\b/i;
        if (forbiddenPattern.test(sqlClean)) {
            console.error("Security Alert: Forbidden keyword detected.", sqlClean);
            return response.status(400).json({ error: "Consulta rechazada por políticas de seguridad." });
        }

        // 2. Enforce Table Scope (MUST query 'dhm' or 'dhm2')
        // Regex matches: FROM dhm, FROM "dhm", FROM public.dhm, JOIN dhm...
        // We dynamically build regex to match ONLY the selected table.
        const tableNameRegex = table;
        const tableScopePattern = new RegExp(`\\b(FROM|JOIN)\\s+("?public"?\\.)?"?${tableNameRegex}"?\\b`, 'i');

        if (!tableScopePattern.test(sqlClean)) {
            console.error("Security Alert: Query targeting unknown table.", sqlClean);
            return response.status(400).json({ error: `Solo permitidas consultas a la tabla '${table}'.` });
        }

        // --- MIDDLEWARE DE CORRECCIÓN DE TIPOS (Hard Fix) ---
        // Si el modelo olvidó el casting, lo forzamos con Regex para columnas conocidas.
        let finalSql = sqlClean;
        const numericColumns = ['totalcobertura', 'precio', 'copago', 'cantidad', 'facturado'];

        numericColumns.forEach(col => {
            // Reemplaza SUM(totalcobertura) por SUM(totalcobertura::NUMERIC)
            // Reemplaza AVG(precio) por AVG(precio::NUMERIC)
            const regex = new RegExp(`(SUM|AVG|MIN|MAX)\\(\\s*${col}\\s*\\)`, 'gi');
            finalSql = finalSql.replace(regex, `$1(${col}::NUMERIC)`);

            // Reemplaza comparaciones simples: totalcobertura > 100 
            // Cuidado: esto es más riesgoso con regex simple, nos enfocamos en agregaciones que son el error común.
        });

        // Corrección específica para el error reportado "function sum(character varying) does not exist"
        // Si queda algún SUM(varchar) suelto que no sea de las columnas de arriba pero falle.
        // (Opcional, pero las columnas de arriba cubren el 99% de casos)
        // --------------------------------------------------------

        console.log("SQL Original:", sqlClean);
        console.log("SQL Corregido:", finalSql);

        const dbResult = await secondaryDb.query(finalSql);

        const summaryModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const summaryPrompt = `
            Pregunta original: "${message}"
            SQL Ejecutado: "${parsedParams.sql}"
            Resultados (JSON): ${JSON.stringify(dbResult.rows).substring(0, 5000)} ${dbResult.rows.length > 20 ? '... (truncado)' : ''}

            Tarea: Responde la pregunta original usando los datos.
            
            REGLAS DE FORMATO:
            1. Sé conciso y directo.
            2. Si es una lista, menciona los primeros ítems.
            3. **IMPORTANTE**: Para cualquier monto de dinero, DEBES usar el signo de pesos dominicano ($) y separador de miles con coma.
               - Incorrecto: 2305634216.06
               - Correcto: $2,305,634,216.06
        `;

        // --- SUMMARY GENERATION WITH RETRY ---
        const summaryResult = await callWithRetry(() =>
            summaryModel.generateContent(summaryPrompt)
        );

        const finalAnswer = summaryResult.response.text();

        return response.status(200).json({
            text: finalAnswer,
            generatedSql: parsedParams.sql,
            data: dbResult.rows,
            explanation: parsedParams.explanation
        });

    } catch (error: any) {
        console.error('Text-to-SQL Error:', error);
        return response.status(500).json({ error: error.message });
    }
}
