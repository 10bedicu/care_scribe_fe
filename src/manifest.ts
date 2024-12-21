import { lazy } from "react";

const manifest = {
  plugin: "care-scribe",
  routes: {},
  extends: [],
  components: {
    Scribe: lazy(
      () => import("./App"),
    )
  },
  navItems: [],
};

export default manifest;
