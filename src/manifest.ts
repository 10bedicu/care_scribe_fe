import { PluginManifest } from "@/pluginTypes";
import { lazy } from "react";

const manifest: PluginManifest = {
  plugin: "care-scribe",
  routes: {},
  extends: [],
  components: {
    Scribe: lazy(
      () => import("./index"),
    )
  },
  navItems: [],
};

export default manifest;
