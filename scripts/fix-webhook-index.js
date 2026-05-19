"use strict";

/**
 * Script de emergencia para arreglar el índice único de webhook_events.
 *
 * Problema: la colección webhook_events tiene duplicados de payment_id,
 * lo que impide crear el índice único necesario para idempotencia atómica.
 *
 * Pasos:
 * 1. Conecta a MongoDB con la URI del .env
 * 2. Borra TODOS los documentos de webhook_events (colección temporal, no crítica)
 * 3. Crea el índice único payment_id
 * 4. Verifica que el índice existe
 */

require("dotenv").config();

const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB || "ton618_bot";

if (!MONGO_URI) {
  console.error("❌ MONGO_URI no está definido en .env");
  process.exit(1);
}

async function run() {
  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 15000,
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const coll = db.collection("webhook_events");

    console.log(`📡 Conectado a MongoDB: ${DB_NAME}`);

    // 1. Contar documentos actuales
    const count = await coll.countDocuments();
    console.log(`📊 webhook_events tiene ${count} documentos`);

    // 2. Verificar duplicados
    const dups = await coll
      .aggregate([
        { $group: { _id: "$payment_id", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (dups.length > 0) {
      console.log(`⚠️ Encontrados ${dups.length} payment_id duplicados:`);
      for (const d of dups) {
        console.log(`   - "${d._id}": ${d.count} veces`);
      }
    }

    // 3. Borrar toda la colección (los eventos ya procesados no se necesitan para operación)
    const delResult = await coll.deleteMany({});
    console.log(`🗑️ Borrados ${delResult.deletedCount} documentos de webhook_events`);

    // 4. Eliminar índices existentes (por si hay índices parciales/corruptos)
    try {
      await coll.dropIndexes();
      console.log("🗑️ Índices antiguos eliminados");
    } catch (e) {
      console.log("ℹ️ No había índices que eliminar (OK)");
    }

    // 5. Crear índice único
    const idxResult = await coll.createIndex(
      { payment_id: 1 },
      { unique: true, name: "payment_id_unique" }
    );
    console.log(`✅ Índice único creado: ${idxResult}`);

    // 6. Crear índice TTL
    const ttlResult = await coll.createIndex(
      { processed_at: 1 },
      { expireAfterSeconds: 7776000, name: "processed_at_ttl" }
    );
    console.log(`✅ Índice TTL creado: ${ttlResult}`);

    // 7. Verificar
    const indexes = await coll.indexes();
    const hasUnique = indexes.some(
      (i) => i.name === "payment_id_unique" && i.unique
    );
    if (hasUnique) {
      console.log("✅ Verificado: índice único payment_id existe y está activo");
    } else {
      console.error("❌ ERROR: índice único no encontrado después de crearlo");
      process.exit(1);
    }

    console.log("\n🎉 webhook_events está listo para idempotencia atómica");
    console.log("   Redeploya el bot para que lea el código actualizado.");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log("📴 Conexión cerrada");
  }
}

run();
