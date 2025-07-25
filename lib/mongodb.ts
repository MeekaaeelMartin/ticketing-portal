import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}
const globalWithMongo = globalThis as GlobalWithMongo;
if (process.env.NODE_ENV === 'development') {
  // In dev, use a global variable so hot reloads don't create new clients
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In prod, create a new client per invocation
  client = new MongoClient(uri);
  clientPromise = client.connect();
}
const clientPromiseConst = clientPromise;

export async function getDb(): Promise<Db> {
  try {
    const client = await clientPromiseConst;
    return client.db(); // Use default DB from URI
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Optionally, you can throw a more detailed error or return a custom error object
    throw new Error(`MongoDB connection failed: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  }
} 