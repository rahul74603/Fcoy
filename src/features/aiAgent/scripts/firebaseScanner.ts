import { collection, getDocs, Firestore } from 'firebase/firestore';

export interface FirebaseBlueprint {
  [collectionName: string]: any[];
}

/**
 * Firebase Firestore collections ko scan karke ek structured JSON blueprint string banata hai.
 * @param db Firestore ka initialized instance
 * @param collectionNames Jin collections ko scan karna hai unke naam ka array (e.g., ['users', 'products'])
 */
export async function scanFirebaseBlueprint(db: Firestore, collectionNames: string[]): Promise<string> {
  const blueprint: FirebaseBlueprint = {};

  for (const colName of collectionNames) {
    try {
      const colRef = collection(db, colName);
      const querySnapshot = await getDocs(colRef);
      
      blueprint[colName] = [];
      
      querySnapshot.forEach((doc) => {
        blueprint[colName].push({
          id: doc.id,
          ...doc.data()
        });
      });
    } catch (error) {
      console.error(`Error scanning collection ${colName}:`, error);
      blueprint[colName] = [`Error: ${error instanceof Error ? error.message : String(error)}`];
    }
  }

  return JSON.stringify(blueprint, null, 2);
}