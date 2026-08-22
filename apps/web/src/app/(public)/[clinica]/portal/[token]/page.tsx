import { PortalPaciente } from "./portal";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ clinica: string; token: string }>;
}) {
  const { token } = await params;
  return <PortalPaciente token={token} />;
}
