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

    const { message, previousMessages } = request.body;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const systemInstruction = `
            Eres un experto analista de datos SQL (PostgreSQL).
            Tu trabajo es CONVERTIR preguntas de lenguaje natural a consultas SQL para la tabla 'dhm'.
            
            ESQUEMA DE BASE DE DATOS:
            ${TABLE_SCHEMA}

            REGLAS CRÍTICAS DE SEGURIDAD Y TIPOS:
            1. **CASTING OBLIGATORIO**: Las columnas 'precio', 'copago', 'totalcobertura', 'cantidad' son VARCHAR. Para SUM, AVG, o comparaciones numéricas, DEBES escribirlas como "columna::NUMERIC".
               - MAL: "SUM(totalcobertura)"
               - BIEN: "SUM(totalcobertura::NUMERIC)"
            
            2. Solo puedes generar sentencias SELECT.
            3. NUNCA generes INSERT, UPDATE, DELETE, DROP, ALTER, o TRUNCATE.
            4. SIEMPRE limita los resultados a máximo 20 filas (LIMIT 20) a menos que sea una agregación.
            5. Para búsquedas de texto, usa ILIKE y comodines %.

            EJEMPLOS FEW-SHOT (Sigue estos patrones):
            - Usuario: "Total autorizado este mes"
              SQL: SELECT SUM(totalcobertura::NUMERIC) FROM dhm WHERE fechareceta LIKE '2025-02%'

            - Usuario: "Farmacia con mayor ventas"
              SQL: SELECT nombrefarmacia, SUM(totalcobertura::NUMERIC) as total FROM dhm GROUP BY nombrefarmacia ORDER BY total DESC LIMIT 1

            - Usuario: "Precio promedio de Acetaminofen"
              SQL: SELECT AVG(precio::NUMERIC) FROM dhm WHERE descripcion ILIKE '%Acetaminofen%'

            - Usuario: "Recetas con copago mayor a 1000"
              SQL: SELECT * FROM dhm WHERE copago::NUMERIC > 1000 LIMIT 20

            IMPORTANTE SOBRE FECHAS:
            - Las columnas 'fechareceta' y 'fechadesolicitud' son VARCHAR (no DATE).
            - NO uses ':: DATE' directo porque rompe índices. Usa 'LIKE'.
            - Ejemplo CORRECTO: "WHERE fechareceta LIKE '2025-10-27%'"

            - Ejemplo CORRECTO: "WHERE fechareceta >= '2025-10-01' AND fechareceta < '2025-11-01'" (Para rango)
            - Ejemplo CORRECTO: "WHERE fechareceta LIKE CURRENT_DATE::TEXT || '%'" (Para hoy)

            IMPORTANTE SOBRE CAMPOS NUMÉRICOS (VARCHAR):
            - Las columnas 'precio', 'cantidad', 'copago', 'totalcobertura', 'coberturaplan...' son VARCHAR.
            - Para operaciones matemáticas (SUM, AVG, >, <) DEBES castearlos a NUMERIC.
            - Ejemplo CORRECTO: "SELECT SUM(totalcobertura::NUMERIC) FROM dhm"
            - Ejemplo CORRECTO: "WHERE precio::NUMERIC > 1000"
            - Ejemplo CORRECTO: "ORDER BY cantidad::NUMERIC DESC"

            FORMATO DE RESPUESTA JSON:
            Debes responder ÉNICAMENTE con un objeto JSON (sin markdown code blocks):
            {
                "sql": "SELECT ...",
                "explanation": "Breve explicación de qué hace la consulta"
            }
        `;

        // --- HISTORY PROCESSING ---
        // Convert Frontend messages to Gemini History
        const history = (previousMessages || []).map((msg: any) => {
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

        const result = await chat.sendMessage(`Genera SQL para: "${message}" \n ${systemInstruction}`);
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
        if (sqlClean.includes("DROP ") || sqlClean.includes("DELETE ") || sqlClean.includes("UPDATE ") || sqlClean.includes("INSERT ") || sqlClean.includes("ALTER ") || sqlClean.includes("TRUNCATE ")) {
            return response.status(400).json({ error: "Consulta detectada como insegura." });
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

        const summaryResult = await summaryModel.generateContent(summaryPrompt);
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
