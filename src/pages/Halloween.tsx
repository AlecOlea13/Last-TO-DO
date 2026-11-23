// ══════════════════════════════════════════════════════════════
//  Halloween.tsx — AHORA CARGA EL TEMA NAVIDEÑO (Navidad.tsx)
//
//  Dashboard.tsx y Login.tsx siguen importando de "./Halloween";
//  este archivo solo re-exporta el tema de Navidad con los nombres
//  de antes, así no hay que modificar esas pantallas.
//
//  Para DESACTIVAR el tema:  CHRISTMAS_ENABLED = false en Navidad.tsx
// ══════════════════════════════════════════════════════════════
export {
  CHRISTMAS_ENABLED as HALLOWEEN_ENABLED,
  CornerGarland       as SpiderWeb,
  HangingOrnament     as Spider,
  ChristmasTree       as MoonSvg,
  Sleigh              as BatSvg,
  SantaFlight         as Ghost,
  ChristmasGlobalLayer as HalloweenGlobalLayer,
  SnowGround          as FogLayer,
} from "./Navidad";