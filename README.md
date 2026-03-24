# Minuto

**Sistema de control de asistencia para PyMEs y empresas pequeñas.**

Minuto es una aplicación móvil y web que permite a las organizaciones gestionar el registro de asistencia de sus empleados de forma simple, con geolocalización y soporte multi-organización.

---

## 🎯 Propuesta de valor

- **Control de asistencia simplificado**: Clock-in/clock-out con timestamp y geolocalización.
- **Multi-organización**: Soporta múltiples organizaciones por usuario (ideal para consultores, freelancers o empleados con múltiples trabajos).
- **Historial y reportes**: Visualización de registros diarios, semanales y totales de horas trabajadas.
- **Multiplataforma**: Funciona en iOS, Android y Web desde una única base de código.
- **Autenticación segura**: Login y registro con validación de email y RUT (Chile).

---

## 📦 Estado actual del proyecto

Este proyecto está en **desarrollo activo**. Las siguientes funcionalidades están implementadas:

### ✅ Funcionalidades completadas

- **Autenticación**: Login y registro con validación de email/RUT, disponibilidad de campos y restricciones de longitud.
- **Multi-organización**: Creación de organizaciones, switcher, validación con Zod, protección contra nombres duplicados.
- **Control de asistencia**: Registro de clock-in y clock-out con geolocalización (latitude, longitude, accuracy).
- **Historial de asistencia**: Vista de eventos recientes, registros por rango de fechas, totales semanales.
- **Gestión de equipos**: Vista de empleados por organización.
- **Perfil de usuario**: Edición de datos personales.
- **Políticas de acceso**: Row Level Security (RLS) en Supabase para membresías organizacionales.

### 🚧 Limitaciones conocidas

- No hay sistema de notificaciones push.
- No hay reportes exportables (PDF, Excel).
- No hay gestión de permisos/vacaciones.
- No hay integración con sistemas de nómina.
- El sistema de invitaciones por código está preparado en la base de datos pero no implementado en la UI.

---

## 🛠️ Stack tecnológico

### Frontend

- **Expo ~55**: Framework para desarrollo universal (iOS, Android, Web).
- **React Native 0.83.2** + **React 19.2.0**: UI y lógica de aplicación.
- **Expo Router**: Navegación basada en archivos (file-based routing).
- **NativeWind 5**: Tailwind CSS para React Native (styling universal).
- **TypeScript**: Tipado estático en todo el proyecto.

### Backend

- **Supabase**: Autenticación, base de datos PostgreSQL, Row Level Security (RLS).
- **Expo Location**: Geolocalización para registros de asistencia.
- **Expo SQLite**: Soporte de SQLite local (no usado actualmente, pero disponible).

### Herramientas

- **Biome**: Linting y formateo (reemplaza ESLint + Prettier).
- **pnpm**: Gestor de paquetes.
- **Husky**: Git hooks para calidad de código.
- **Zod**: Validación de esquemas en tiempo de ejecución.

---

## 🚀 Instalación y setup

### Prerrequisitos

- Node.js 18+ (recomendado: 20+)
- pnpm (instalar con `npm install -g pnpm`)
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

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_clave_publica
```

> **Nota**: Las claves actuales en el repositorio apuntan a una instancia de desarrollo. Para producción, crear tu propia instancia de Supabase.

### 4. Ejecutar la aplicación

```bash
# Iniciar en modo desarrollo (elige plataforma en el menú)
pnpm start

# O directamente en una plataforma específica:
pnpm android   # Android
pnpm ios       # iOS (requiere macOS)
pnpm web       # Web
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
│   │   ├── _layout.tsx    # Layout raíz
│   │   └── index.tsx      # Pantalla de entrada
│   ├── components/        # Componentes reutilizables
│   ├── hooks/             # Custom hooks (useOrganization, useTheme, etc.)
│   ├── lib/               # Lógica de negocio (attendance, supabase, validación)
│   ├── constants/         # Constantes de tema y configuración
│   └── global.css         # Estilos globales (Tailwind)
├── assets/                # Imágenes, iconos, splash screens
├── scripts/               # Scripts de desarrollo
├── .env                   # Variables de entorno (no subir a git)
├── app.json               # Configuración de Expo
├── package.json           # Dependencias y scripts
├── tsconfig.json          # Configuración de TypeScript
└── biome.json             # Configuración de Biome (linting)
```

---

## 🧪 Scripts disponibles

```bash
pnpm start          # Iniciar en modo desarrollo
pnpm android        # Abrir en Android
pnpm ios            # Abrir en iOS
pnpm web            # Abrir en web
pnpm lint           # Ejecutar Biome (linting y formateo)
pnpm typecheck      # Validar tipos con TypeScript
```

---

## 🔐 Configuración de Supabase

Para usar tu propia instancia de Supabase:

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Ejecutar las migraciones de base de datos (pendiente: agregar carpeta `supabase/migrations/`).
3. Configurar Row Level Security (RLS) según las políticas del proyecto.
4. Actualizar las variables de entorno en `.env`.

> **Pendiente**: Documentar esquema de base de datos y migraciones.

---

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo [LICENSE](./LICENSE) para más detalles.

---

## 🤝 Contribuir

Este proyecto está en desarrollo activo. Para contribuir:

1. Fork del repositorio.
2. Crear una rama con tu feature (`git checkout -b feature/nueva-funcionalidad`).
3. Hacer commit de tus cambios siguiendo conventional commits.
4. Push a tu rama (`git push origin feature/nueva-funcionalidad`).
5. Abrir un Pull Request.

---

## 📚 Recursos

- [Expo documentation](https://docs.expo.dev/)
- [React Native documentation](https://reactnative.dev/)
- [Supabase documentation](https://supabase.com/docs)
- [NativeWind documentation](https://www.nativewind.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
