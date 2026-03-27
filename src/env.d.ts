declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

interface ProcessEnv {
  EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN?: string;
}

interface Process {
  env: ProcessEnv;
}

declare const process: Process;

export {};
