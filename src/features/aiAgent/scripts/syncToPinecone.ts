import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { AI_CONFIG } from '../config/ai.config';
import { callPineconeQuery, callPineconeUpsert, shouldUseBackend } from '../api/aiBackend.client';

// ✅ Backend imports SABSE PEHLE - order matter karta hai!
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

// 🔒 Pinecone secret keys live ONLY in the Cloud Function. The browser never
// holds PINECONE_API_KEY/PINECONE_HOST; the callable function performs the
// authenticated upsert/query. Embeddings are computed locally (TF USE) and
// only the vector is sent to the server-side function.
let model: use.UniversalSentenceEncoder | null = null;

// ✅ Backend initialize karna
async function initTF() {
  try {
    // WebGL try karo pehle (fast)
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('✅ TF Backend (WebGL):', tf.getBackend());
  } catch (e) {
    // Fallback to CPU
    console.warn('⚠️ WebGL failed, CPU use kar raha hai...');
    await tf.setBackend('cpu');
    await tf.ready();
    console.log('✅ TF Backend (CPU):', tf.getBackend());
  }
}

// ✅ Model load karna
async function getEmbedding(text: string): Promise<number[]> {
  if (!model) {
    await initTF(); // ✅ Backend pehle ready karo
    console.log('📦 USE Model load ho raha hai...');
    model = await use.load();
    console.log('✅ USE Model ready!');
  }
  const embeddings = await model.embed([text]);
  const vector = await embeddings.array();
  
  // ✅ Memory leak rokne ke liye dispose karo
  embeddings.dispose();
  
  return vector[0];
}

export async function syncFirebaseToPinecone(collectionsToSync: string[]) {
  // Pinecone is enabled via the deployed backend functions (secret server-side).
  if (!AI_CONFIG.enablePinecone || !shouldUseBackend()) {
    console.warn("Pinecone disabled: backend functions not available (RAG requires deployed functions with PINECONE_API_KEY/PINECONE_HOST).");
    return;
  }

  try {
    console.log("🔄 Sync start...");
    
    for (const colName of collectionsToSync) {
      const querySnapshot = await getDocs(collection(db, colName));
      console.log(`📂 ${colName}: ${querySnapshot.docs.length} documents mile`);

      // ✅ Batch mein upsert karo (ek saath sab nahi)
      const vectors: Array<{
        id: string;
        values: number[];
        metadata: { text: string; collection: string }
      }> = [];

      for (const doc of querySnapshot.docs) {
        const textData = `Collection: ${colName} | ID: ${doc.id} | Data: ${JSON.stringify(doc.data())}`;
        
        try {
          const embedding = await getEmbedding(textData);
          vectors.push({
            id: `${colName}_${doc.id}`, // ✅ Unique ID
            values: embedding,
            metadata: { 
              text: textData,
              collection: colName
            }
          });
        } catch (embErr) {
          console.error(`❌ Embedding error for ${doc.id}:`, embErr);
        }
      }

      // ✅ Ek batch mein upsert karo — via server-side callable (secret stays on server).
      if (vectors.length > 0) {
        try {
          await callPineconeUpsert({ vectors });
          console.log(`✅ ${colName} sync ho gaya! (${vectors.length} docs)`);
        } catch (err: any) {
          console.error(`❌ Upsert error for ${colName}:`, err?.message ?? err);
        }
      }
    }
    
    console.log("🎉 Data Sync Complete!");
    
  } catch (error) {
    console.error("❌ Sync Error:", error);
  }
}

export async function searchPinecone(queryText: string): Promise<string> {
  try {
    if (!AI_CONFIG.enablePinecone || !shouldUseBackend()) return "";
    const queryEmbedding = await getEmbedding(queryText);

    // 🔒 Query via server-side callable — browser never sends the Pinecone key.
    const result = await callPineconeQuery({ vector: queryEmbedding, topK: 5 });

    if (!result.matches || result.matches.length === 0) {
      return "";
    }

    return result.matches
      .map((m) => m.metadata?.text)
      .filter(Boolean)
      .join("\n---\n");

  } catch (error) {
    console.error("❌ Search error:", error);
    return "";
  }
}