import { MongoClient, Db, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}
const globalWithMongo = globalThis as GlobalWithMongo;

function createClient(): MongoClient {
  return new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    // Tighter timeouts to fail fast in serverless
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
}

export async function getDb(): Promise<Db> {
  try {
    if (!globalWithMongo._mongoClientPromise) {
      const client = createClient();
      globalWithMongo._mongoClientPromise = client.connect();
    }
    const client = await globalWithMongo._mongoClientPromise;
    return client.db();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw new Error(`MongoDB connection failed: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  }
}