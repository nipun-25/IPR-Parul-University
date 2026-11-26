import { NextRequest } from 'next/server';
import { BffForwarder } from '@/server/bff-client/bff-forwarder';
import { MockTestSessionProvider } from '@/server/session/mock-session-provider';

// Server-side environment configuration (never bundled into browser client code)
const backendOrigin = process.env.BACKEND_INTERNAL_URL || 'http://localhost:4000';
const sharedSecretHex = process.env.BFF_SHARED_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const csrfSecret = process.env.CSRF_SECRET || 'parul_university_ipr_bff_csrf_secret_production_seed_12345';

const sessionProvider = new MockTestSessionProvider();
const forwarder = new BffForwarder({
  backendOrigin,
  sharedSecretHex,
  csrfSecret,
  sessionProvider
});

async function handleRequest(request: NextRequest, params: { path: string[] }): Promise<Response> {
  const subpath = '/' + (params.path || []).join('/');
  return forwarder.forwardRequest(request, subpath);
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, params);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, params);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, params);
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, params);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, params);
}
