# Arquitectura de Minuto

Este documento describe las decisiones arquitectónicas y técnicas del proyecto Minuto.

---

## Visión general

Minuto es una aplicación multiplataforma (iOS, Android, Web) construida con **Expo** y **React Native** para el control de asistencia de empleados en PyMEs. El sistema soporta múltiples organizaciones por usuario y registra eventos de clock-in/clock-out con geolocalización.

---

## Stack técnico

### Frontend

- **Expo SDK 55**: Framework universal para desarrollo móvil y web.
- **React Native 0.83.2** + **React 19.2.0**: UI framework con React Compiler habilitado.
- **Expo Router**: Navegación basada en archivos (file-based routing) con typed routes.
- **NativeWind 5**: Tailwind CSS para React Native (CSS-in-JS universal).
- **TypeScript 5.9**: Tipado estático en todo el proyecto.

### Backend

- **Supabase**: Backend as a Service (BaaS) con PostgreSQL, autenticación y Row Level Security (RLS).
- **Expo Location**: API de geolocalización para registros de asistencia.
- **AsyncStorage**: Almacenamiento local para preferencias de usuario.

### Herramientas

- **Biome 2.4**: Linter y formateador moderno (reemplaza ESLint + Prettier).
- **pnpm**: Gestor de paquetes eficiente con workspaces.
- **Husky**: Git hooks para validación pre-commit.
- **Zod 4.3**: Validación de esquemas en tiempo de ejecución.

---

## Decisiones arquitectónicas

### 1. Multi-organización

El sistema permite que un usuario pertenezca a múltiples organizaciones. Esto se implementa mediante:

- **Tabla `organizations`**: Almacena nombre, timezone, configuración.
- **Tabla `employees`**: Relaciona usuarios con organizaciones (many-to-many).
- **Context Provider (`useOrganization`)**: Gestiona la organización activa en el cliente.

**Ventajas**:
- Flexibilidad para freelancers o empleados con múltiples trabajos.
- Permite probar el sistema con múltiples cuentas sin conflictos.

**Limitaciones**:
- Requiere switcher de organización en la UI (puede ser confuso para usuarios no técnicos).

### 2. Geolocalización en registros de asistencia

Cada evento de clock-in y clock-out almacena:

```typescript
type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};
```

**Implementación**:
- **Web**: Requiere HTTPS o localhost (restricción del navegador).
- **Móvil**: Solicita permisos de ubicación al usuario.

**Validaciones**:
- Si el servicio de ubicación no está disponible, se muestra un error.
- La precisión (`accuracy`) se almacena para auditoría (valores altos indican baja confiabilidad).

### 3. Validación con Zod

Se usa Zod para validación de formularios en tiempo real (on-blur) y validación de servidor.

**Ejemplo**: Creación de organización
```typescript
const organizationSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string(),
});
```

**Beneficios**:
- Validación consistente en cliente y servidor.
- Mensajes de error tipados y customizables.
- Prevención de duplicados (ej: nombres de organización repetidos).

### 4. File-based routing (Expo Router)

La estructura de rutas se define por archivos en `src/app/`:

```
src/app/
├── (auth)/
│   ├── login.tsx        # /login
│   └── register.tsx     # /register
├── (tabs)/
│   ├── home.tsx         # /home
│   ├── control.tsx      # /control
│   ├── control-history.tsx  # /control-history
│   ├── team.tsx         # /team
│   └── profile.tsx      # /profile
├── _layout.tsx          # Layout raíz
└── index.tsx            # /
```

**Ventajas**:
- Navegación automática sin configurar rutas manualmente.
- Deep linking nativo en iOS/Android.
- TypeScript genera tipos de rutas automáticamente (`experiments.typedRoutes`).

### 5. Theming y estilos

Se usa un sistema de temas personalizado con soporte de light/dark mode:

```typescript
// src/hooks/use-theme.ts
export const lightTheme = {
  background: '#FFFFFF',
  text: '#000000',
  // ...
};

export const darkTheme = {
  background: '#1C1C1E',
  text: '#FFFFFF',
  // ...
};
```

**Implementación**:
- **Native**: Se usa `useColorScheme()` de React Native.
- **Web**: Se detecta `prefers-color-scheme` del navegador.

**NativeWind** se usa para estilos utilitarios (spacing, flex, etc.), pero los colores del tema se aplican dinámicamente con StyleSheet.

---

## Módulos clave

### `src/lib/attendance.ts`

Lógica de negocio para control de asistencia:

- **`registerClockIn()`**: Registra entrada con timestamp y ubicación.
- **`registerClockOut()`**: Registra salida y calcula duración.
- **`getAttendanceRecordsForRange()`**: Obtiene registros por rango de fechas.
- **`calculateWeeklyTotals()`**: Calcula horas trabajadas por semana.
- **`getOrganizationWeekRange()`**: Determina semana laboral (lunes a domingo) según timezone.

**Consideraciones**:
- Los timestamps se almacenan en UTC en Supabase.
- La fecha de trabajo (`work_date`) se calcula según el timezone de la organización.
- Un empleado puede tener múltiples registros en un mismo día (turnos partidos).

### `src/lib/supabase.ts`

Cliente de Supabase configurado para Expo:

```typescript
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Importante para Expo
    },
  }
);
```

### `src/hooks/use-organization.tsx`

Context Provider para gestión de organizaciones:

- **Estado global**: Lista de organizaciones del usuario, organización activa.
- **Operaciones**: Creación de organización, cambio de organización activa.
- **Setup modal**: Componente `OrganizationSetupView` para crear organizaciones.

---

## Políticas de seguridad (RLS)

Supabase usa Row Level Security (RLS) para controlar el acceso a datos.

### Ejemplo: Tabla `attendance_records`

```sql
-- Solo el propietario del registro puede verlo
CREATE POLICY "Users can view their own attendance"
  ON attendance_records
  FOR SELECT
  USING (auth.uid() = user_id);

-- Solo el propietario puede crear registros
CREATE POLICY "Users can create their own attendance"
  ON attendance_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Pendiente**: Documentar políticas RLS de membresías organizacionales y validación de pertenencia.

---

## Limitaciones técnicas conocidas

### 1. Geolocalización en Web

En navegadores, la API de Geolocation requiere **HTTPS** (excepto `localhost`). Esto significa que:

- En desarrollo, funciona en `http://localhost:8081`.
- En producción, requiere certificado SSL.

**Solución**: Usar Expo Web Hosting o cualquier proveedor con HTTPS (Vercel, Netlify, etc.).

### 2. React Compiler (experimental)

El proyecto usa `experiments.reactCompiler: true` en `app.json`. Esto optimiza automáticamente el código de React (menos re-renders).

**Advertencia**: Esta feature está en experimental. Si hay problemas de performance o bugs extraños, deshabilitar temporalmente.

### 3. Sin migraciones versionadas

Actualmente **NO hay carpeta `supabase/migrations/`**. El esquema de base de datos se gestionó manualmente en el panel de Supabase.

**Recomendación**: Agregar migraciones SQL versionadas para reproducibilidad y CI/CD.

---

## Próximos pasos técnicos

### Pendientes

- [ ] Agregar carpeta `supabase/migrations/` con esquema completo.
- [ ] Documentar políticas RLS en detalle.
- [ ] Implementar sistema de invitaciones por código (backend ya preparado).
- [ ] Agregar tests unitarios (Vitest o Jest).
- [ ] Configurar CI/CD con GitHub Actions.
- [ ] Agregar exportación de reportes (PDF con `react-native-pdf` o CSV).
- [ ] Implementar notificaciones push (Expo Notifications).

### Mejoras de arquitectura

- [ ] Separar lógica de backend en API Routes (Expo Router API Routes + Edge Functions de Supabase).
- [ ] Agregar cache local con SQLite para modo offline.
- [ ] Implementar sincronización offline-first con queue de eventos.

---

## Referencias

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [Zod Documentation](https://zod.dev/)
