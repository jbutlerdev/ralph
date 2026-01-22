import { NextRequest } from 'next/server';

// Registry mode - always use Ralph server's API
const RALPH_SERVER_URL = process.env.RALPH_SERVER_URL || 'http://localhost:3001';

/**
 * GET /api/events/stream
 *
 * SSE endpoint for streaming plan/session status events in real-time.
 * Query parameters:
 * - planId: Optional - Stream events for a specific plan
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get('planId');

  // Build query string for Ralph server
  const params = new URLSearchParams();
  if (planId) params.set('planId', planId);

  const ralphStreamUrl = `${RALPH_SERVER_URL}/events/stream?${params.toString()}`;

  // Create a ReadableStream that proxies from the Ralph server
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Connect to Ralph server's SSE endpoint
        const response = await fetch(ralphStreamUrl, {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          // Send error message and close
          const errorMsg = `data: ${JSON.stringify({ type: 'error', message: 'Failed to connect to Ralph server' })}\n\n`;
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          const errorMsg = `data: ${JSON.stringify({ type: 'error', message: 'No response body from Ralph server' })}\n\n`;
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
          return;
        }

        // Proxy the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Forward the SSE data
          controller.enqueue(value);
        }

        controller.close();
      } catch (error) {
        // Send error and close
        const errorMsg = `data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`;
        controller.enqueue(encoder.encode(errorMsg));
        controller.close();
      }
    },

    cancel() {
      // Client disconnected
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * OPTIONS /api/events/stream
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
