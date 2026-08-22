import Link from "next/link";
import {
  CalendarDays,
  Inbox,
  Wallet,
  Users,
  ClipboardList,
  ArrowRight,
  Sparkles,
  LogIn,
} from "lucide-react";

const modulos = [
  { icon: CalendarDays, titulo: "Agenda del día", desc: "Citas agrupadas por doctor con colores, reprogramación, bloqueos de horario y nuevas citas." },
  { icon: ClipboardList, titulo: "Solicitudes en línea", desc: "Los pacientes piden hora desde la web; tú confirmas o rechazas y ellos reciben el correo con su enlace." },
  { icon: Inbox, titulo: "Sala de espera", desc: "Tablero interno: llegó → en atención → atendida, sin gritos en recepción." },
  { icon: Wallet, titulo: "Caja", desc: "Pagos por Yape, Plin, efectivo y POS con totales del día y cierre de caja." },
  { icon: Users, titulo: "Pacientes", desc: "Fichas con historial clínico, adjuntos y consentimientos firmados." },
  { icon: Sparkles, titulo: "Recordatorios", desc: "Confirmaciones por email y recordatorios 24 h con log de cada envío." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
              <Sparkles className="size-4" />
            </span>
            <span className="text-[15px] font-bold tracking-tight">clinicflow</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogIn className="size-4" />
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Crear mi consultorio
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="mx-auto max-w-2xl py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Tu propia clínica en minutos
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            La gestión de tu consultorio,
            <br />
            <span className="text-primary">sin hojas de cálculo</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
            Agenda, solicitudes en línea, sala de espera, caja y pacientes en un
            solo lugar. Los pacientes reservan desde su celular; tú confirmas
            desde la consola y cada cita queda confirmada por email.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
            >
              Crear mi consultorio gratis
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((m) => (
            <div
              key={m.titulo}
              className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <m.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{m.titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {m.desc}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>© 2026 Clinicflow · SaaS para clínicas en Perú</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">Iniciar sesión</Link>
            <Link href="/signup" className="hover:text-foreground">Registrarse</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
