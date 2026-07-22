import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';

// ✅ Backend imports SABSE PEHLE - order matter karta hai!
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY;
const PINECONE_HOST = "https://bsf-data-index-q67gsrt.svc.aped-4627-b74a.pinecone.io";

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
  if (!PINECONE_API_KEY || !PINECONE_HOST) {
    console.error("❌ API Keys missing!");
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

      // ✅ Ek batch mein upsert karo
      if (vectors.length > 0) {
        const response = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
          method: "POST",
          headers: {
            "Api-Key": PINECONE_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ vectors })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`❌ Upsert error for ${colName}:`, errText);
        } else {
          console.log(`✅ ${colName} sync ho gaya! (${vectors.length} docs)`);
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
    const queryEmbedding = await getEmbedding(queryText);
    
    const response = await fetch(`${PINECONE_HOST}/query`, {
      method: "POST",
      headers: {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        vector: queryEmbedding,
        topK: 5,           // ✅ 3 se 5 kiya
        includeMetadata: true
      })
    });

    if (!response.ok) {
      console.error('❌ Pinecone search error:', await response.text());
      return "";
    }

    const result = await response.json();
    
    if (!result.matches || result.matches.length === 0) {
      return "";
    }

    return result.matches
      .map((m: any) => m.metadata.text)
      .join("\n---\n");
      
  } catch (error) {
    console.error("❌ Search error:", error);
    return "";
  }
}