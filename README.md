# Minuto

**Sistema de control de asistencia para PyMEs y empresas pequeñas.**

Minuto es una aplicación móvil y web que permite a las organizaciones gestionar el registro de asistencia de sus empleados de forma simple, con geolocalización y soporte multi-organización.

---

## 🎯 Propuesta de valor

- **Control de asistencia simplificado**: Clock-in/clock-out con timestamp y geolocalización.
- **Multi-organización**: Soporta múltiples organizaciones por usuario (ideal para consultores, freelancers o empleados con múltiples trabajos).
- **Historial y reportes**: Visualización de registros diarios, semanales y totales de horas trabajadas.
- **Multiplataforma**: Funciona en iOS, Android y Web desde una única base de código.
- **Autenticación segura**: Login y registro con validación de email y teléfono.

---

## 📦 Estado actual del proyecto

Este proyecto está en **desarrollo activo**. Las siguientes funcionalidades están implementadas:

### ✅ Funcionalidades completadas

- **Autenticación**: Login y registro con validación de email/teléfono y restricciones de longitud.
- **Multi-organización**: Creación de organizaciones, switcher, validación con Zod, protección contra nombres duplicados.
- **Control de asistencia**: Registro de clock-in y clock-out con geolocalización (latitude, longitude, accuracy).
- **Historial de asistencia**: Vista de eventos recientes, registros por rango de fechas, totales semanales.
- **Gestión de equipos**: Vista de empleados por organización.
- **Invitaciones**: Invitaciones por código con pantalla de invitaciones y gestión de miembros/invitados en el equipo.
- **Perfil de usuario**: Edición de datos personales.
- **Políticas de acceso**: Row Level Security (RLS) en Supabase para membresías organizacionales.

### 🚧 Limitaciones conocidas

- No hay sistema de notificaciones push.
- No hay reportes exportables (PDF, Excel).
- No hay gestión de permisos/vacaciones.
- No hay integración con sistemas de nómina.

---

## 🛠️ Stack tecnológico

### Frontend

- **Expo ~55.0.28**: Framework para desarrollo universal (iOS, Android, Web).
- **React Native 0.83.10** + **React 19.2.0**: UI y lógica de aplicación.
- **Expo Router**: Navegación basada en archivos (file-based routing).
- **Estilos**: StyleSheet con tokens de tema en `src/theme` (colores, tipografía, spacing, elevación); NativeWind/Tailwind solo para estilos web globales (`src/global.css` y componentes web puntuales).
- **TypeScript**: Tipado estático en todo el proyecto.

### Backend

- **Supabase**: Autenticación, base de datos PostgreSQL, Row Level Security (RLS).
- **Expo Location**: Geolocalización para registros de asistencia.
- **Expo SQLite**: Soporte de SQLite local (no usado actualmente, pero disponible).

### Herramientas

- **Biome**: Linting y formateo (reemplaza ESLint + Prettier).
- **pnpm**: Gestor de paquetes y runner de scripts (la versión exacta vive en el campo `packageManager` de `package.json`).
- **Lefthook**: Git hooks para calidad de código (se instala con `pnpm install`).
- **Zod**: Validación de esquemas en tiempo de ejecución.

---

## 🚀 Instalación y setup

### Prerrequisitos

- Node.js 24 (ver `.nvmrc`) compatible con Expo tooling
- pnpm 11.1.1 (ver `packageManager` en `package.json`)
- Expo CLI (se instala automáticamente con las dependencias)
- Cuenta de Supabase (para backend)

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd minuto
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar variables de entorno

Copiar `.env.example` a `.env` y completar los valores:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_clave_publica
EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN=tu_token_publico_de_mapbox
```

> **Nota sobre claves**: `.env` no se sube a git y no debe commitearse. La app falla al arrancar si faltan las variables de Supabase. El token de Mapbox debe ser público (solo Search Box), nunca una clave secreta; recomendá crear un token por entorno con restricciones de URL/aplicación (ver comentarios en `.env.example`).

### 4. Ejecutar la aplicación

```bash
# Iniciar en modo desarrollo (elige plataforma en el menú)
pnpm run start

# O directamente en una plataforma específica:
pnpm run android   # Android
pnpm run ios       # iOS (requiere macOS)
pnpm run web       # Web
```

### 5. Opciones de desarrollo

- **Expo Go**: Escanea el QR code para probar en tu dispositivo físico (limitaciones de funcionalidad nativa).
- **Emulador Android**: Requiere Android Studio instalado.
- **Simulador iOS**: Requiere Xcode (solo macOS).
- **Web**: Abre automáticamente en el navegador en `http://localhost:8081`.

---

## 📁 Estructura del proyecto

```
minuto/
├── src/
│   ├── app/                # Rutas de la aplicación (Expo Router)
│   │   ├── (auth)/        # Pantallas de autenticación (login, register)
│   │   ├── (tabs)/        # Pantallas principales (home, control, historial, equipo, perfil)
│   │   ├── invite/        # Invitaciones y alta de organizaciones
│   │   └── ...            # Rutas sueltas (edit-profile, org-settings, invitations)
│   ├── components/        # Componentes reutilizables
│   ├── constants/         # Constantes de configuración
│   ├── hooks/             # Custom hooks (useOrganization, useTheme, etc.)
│   ├── lib/               # Lógica de negocio (attendance, supabase, validación)
│   ├── theme/             # Tokens y primitivas de diseño (StyleSheet)
│   └── global.css         # Estilos web globales (Tailwind/NativeWind)
├── assets/                # Imágenes, iconos, splash screens
├── scripts/               # Scripts de desarrollo
├── supabase/              # Config, migraciones y funciones de Supabase
├── tests/e2e/             # Tests E2E web con Playwright
├── .env                   # Variables de entorno (no subir a git)
├── app.json               # Configuración de Expo
├── package.json           # Dependencias y scripts
├── tsconfig.json          # Configuración de TypeScript
├── biome.json             # Configuración de Biome (linting)
├── PRD.md                 # Decisiones de producto
├── ARCHITECTURE.md        # Decisiones de sistema/arquitectura
└── DESIGN.md              # Decisiones de UI y sistema de diseño
```

---

## 🧪 Scripts disponibles

```bash
pnpm run start             # Iniciar en modo desarrollo
pnpm run android           # Abrir en Android
pnpm run ios               # Abrir en iOS
pnpm run web               # Abrir en web
pnpm run lint              # Ejecutar Biome (linting)
pnpm run typecheck         # Validar tipos con TypeScript
pnpm run check             # Lint + typecheck
pnpm test                  # Ejecutar tests unitarios (Jest)
pnpm run test:coverage     # Tests unitarios con cobertura
pnpm run test:e2e:install  # Instalar navegador de Playwright
pnpm run test:e2e          # Ejecutar E2E web con Playwright
```

## 🔐 Configuración de Supabase

Para usar tu propia instancia de Supabase:

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Ejecutar las migraciones de `supabase/migrations/` en orden (fuente de verdad del esquema y de las RPCs).
3. No editar migraciones ya publicadas: los cambios correctivos se agregan como nuevas migraciones (`supabase migration new`).
4. Configurar Row Level Security (RLS) según las políticas del proyecto.
5. Actualizar las variables de entorno en `.env`.

Para levantar Supabase local: `supabase start` y `supabase migration list --local` (ver `CONTRIBUTING.md`).

---

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo [LICENSE](./LICENSE) para más detalles.

---

## 🤝 Contribuir

Este proyecto está en desarrollo activo. Para contribuir, seguí `CONTRIBUTING.md`. Las decisiones de producto, arquitectura y diseño viven en:

- `PRD.md`
- `ARCHITECTURE.md`
- `DESIGN.md`

---

## 📚 Recursos

- [Expo documentation](https://docs.expo.dev/)
- [React Native documentation](https://reactnative.dev/)
- [Supabase documentation](https://supabase.com/docs)
- [NativeWind documentation](https://www.nativewind.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
