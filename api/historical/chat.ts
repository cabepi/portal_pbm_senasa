import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { secondaryDb } from '../lib/secondary-db';
import { allowCors } from '../lib/cors';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Schema Definition for the LLM
const TABLE_SCHEMA = `
Table "dhm" (Data Histórica de Medicamentos):
- codautorizacion (varchar): Código único de la autorización
- codigofarmacia (varchar): Código de la farmacia
- nombrefarmacia (varchar): Nombre de la farmacia
- numeroafiliado (varchar): Número de afiliado
- nombreafiliado (varchar): Nombre del paciente/afiliado
- cedula (varchar): Cédula del afiliado
- doctor (varchar): Nombre del doctor
- descripcion (varchar): Nombre del medicamento o producto
- cantidad (varchar): Cantidad solicitada
- precio (varchar): Precio unitario
- totalcobertura (varchar): Monto cubierto por la ARS
- fechareceta (varchar): Fecha de la receta
- fechadesolicitud (varchar): Fecha de la autorización
- copago (varchar): Monto que paga el afiliado
- reversado (varchar): 'S' si fue anulada/reversada, 'N' o null si está activa
`;

async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method Not Allowed' });

    const { message, previousMessages } = request.body;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const systemInstruction = `
            Eres un experto analista de datos SQL (PostgreSQL).
            Tu trabajo es CONVERTIR preguntas de lenguaje natural a consultas SQL para la tabla 'dhm'.
            
            ESQUEMA DE BASE DE DATOS:
            ${TABLE_SCHEMA}

            REGLAS CRÍTICAS DE SEGURIDAD:
            1. Solo puedes generar sentencias SELECT.
            2. NUNCA generes INSERT, UPDATE, DELETE, DROP, ALTER, o TRUNCATE.
            3. SIEMPRE limita los resultados a máximo 20 filas (LIMIT 20) a menos que sea una agregación (COUNT, SUM).
            4. Si la pregunta es ambigua, genera la consulta más lógica basada en nombres o fechas recientes.
            5. Para búsquedas de texto, usa ILIKE y comodines %.

            IMPORTANTE SOBRE FECHAS:
            - Las columnas 'fechareceta' y 'fechadesolicitud' son VARCHAR (formato 'YYYY-MM-DD HH:MM:SS').
            - Para optimizar (usar índices), NO uses casting (::DATE).
            - Usa búsqueda de texto con LIKE 'YYYY-MM-DD%'.
            - Ejemplo CORRECTO: "WHERE fechareceta LIKE '2025-10-27%'" (Para buscar un día)
            - Ejemplo CORRECTO: "WHERE fechareceta >= '2025-10-01' AND fechareceta < '2025-11-01'" (Para rango)
            - Ejemplo CORRECTO: "WHERE fechareceta LIKE CURRENT_DATE::TEXT || '%'" (Para hoy)

            FORMATO DE RESPUESTA JSON:
            Debes responder ÉNICAMENTE con un objeto JSON (sin markdown code blocks):
            {
                "sql": "SELECT ...",
                "explanation": "Breve explicación de qué hace la consulta"
            }
        `;

        const chat = model.startChat({
            history: [
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
            // Fallback for markdown cleanup if model disregards JSON mode
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

        // Security Check
        const sqlRaw = (parsedParams.sql || "").trim();
        const sqlUpper = sqlRaw.toUpperCase();

        // Remove trailing semicolon if present for safety check consistency
        const sqlClean = sqlUpper.endsWith(';') ? sqlUpper.slice(0, -1) : sqlUpper;

        if (!sqlClean.startsWith("SELECT")) {
            console.error("Blocked SQL (Not SELECT):", sqlRaw);
            return response.status(400).json({ error: "Consulta no permitida (Solo SELECT)." });
        }
        if (sqlClean.includes("DROP ") || sqlClean.includes("DELETE ") || sqlClean.includes("UPDATE ") || sqlClean.includes("INSERT ") || sqlClean.includes("ALTER ") || sqlClean.includes("TRUNCATE ")) {
            console.error("Blocked SQL (Unsafe):", sqlRaw);
            return response.status(400).json({ error: "Consulta detectada como insegura." });
        }

        // Execute SQL
        const dbResult = await secondaryDb.query(sqlRaw);

        // Summarize Result with AI
        // We do a second quick pass to convert rows to natural language summary
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

export default allowCors(handler);
