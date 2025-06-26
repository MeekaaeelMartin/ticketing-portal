import { MongoClient, Db } from 'mongodb';

// --- TEMPORARY DEBUGGING STEP ---
// Replace YOUR_REAL_PASSWORD_HERE with your actual password
const uri = "mongodb+srv://meekaaeel:tnSb4wR4Qoy0Pa4z@ticketsystem.vsozmtl.mongodb.net/?retryWrites=true&w=majority&appName=TicketSystem";
// const uri = process.env.MONGODB_URI as string;
if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

let client: MongoClient;
let db: Db;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In dev, use a global variable so hot reloads don't create new clients
  if (!(global as any)._mongoClientPromise) {
    client = new MongoClient(uri);
    (global as any)._mongoClientPromise = client.connect();
  }
  clientPromise = (global as any)._mongoClientPromise;
} else {
  // In prod, create a new client per invocation
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(); // Use default DB from URI
} 