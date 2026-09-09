import { privateResponseHeaders } from "@/lib/private-routes";
import { readPaymentResultPoll } from "@/server/payments/result-route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await params;
  const result = await readPaymentResultPoll(assignmentId);
  return Response.json(result.body, {
    status: result.status,
    headers: privateResponseHeaders,
  });
}
