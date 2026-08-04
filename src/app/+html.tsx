import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Web-only root HTML document for every statically exported page. Runs in
// Node.js during export; no DOM/browser APIs available here.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es-CL">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#047857" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
