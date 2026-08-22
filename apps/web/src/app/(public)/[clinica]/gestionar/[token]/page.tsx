import { GestionarCita } from "./gestionar";

export const dynamic = "force-dynamic";

export default async function GestionarPage({
  params,
}: {
  params: Promise<{ clinica: string; token: string }>;
}) {
  const { token } = await params;
  return <GestionarCita token={token} />;
}
