import { MongoClient, Db, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

let client: MongoClient;

interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}
const globalWithMongo = globalThis as GlobalWithMongo;
// Reuse a single client across hot reloads and serverless invocations
if (!globalWithMongo._mongoClientPromise) {
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    // Tighter timeouts to fail fast in serverless
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    // Note: keepAlive options are managed by the driver; not set explicitly here
  });
  globalWithMongo._mongoClientPromise = client.connect();
}
const clientPromise = globalWithMongo._mongoClientPromise as Promise<MongoClient>;

export async function getDb(): Promise<Db> {
  try {
    const client = await clientPromise;
    return client.db(); // Use default DB from URI
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Optionally, you can throw a more detailed error or return a custom error object
    throw new Error(`MongoDB connection failed: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  }
} 