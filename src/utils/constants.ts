export const I18NNAMESPACE = "care_scribe_fe";

export const MEDICATION_REQUEST_TIMING_OPTIONS: Record<
  string,
  {
    display: string;
    timing: any;
  }
> = {
  BID: {
    display: "BID (1-0-1)",
    timing: {
      repeat: {
        frequency: 2,
        period: 1,
        period_unit: "d",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "BID",
        display: "Two times a day",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  TID: {
    display: "TID (1-1-1)",
    timing: {
      repeat: {
        frequency: 3,
        period: 1,
        period_unit: "d",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "TID",
        display: "Three times a day",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  QID: {
    display: "QID (1-1-1-1)",
    timing: {
      repeat: {
        frequency: 4,
        period: 1,
        period_unit: "d",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "QID",
        display: "Four times a day",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  AM: {
    display: "AM (1-0-0)",
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        period_unit: "d",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "AM",
        display: "Every morning",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  PM: {
    display: "PM (0-0-1)",
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        period_unit: "d",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "PM",
        display: "Every afternoon",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  QD: {
    display: "QD (Once a day)",
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        period_unit: "d",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "QD",
        display: "Once a day",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  QOD: {
    display: "QOD (Alternate days)",
    timing: {
      repeat: {
        frequency: 1,
        period: 2,
        period_unit: "d",
        bounds_duration: {
          value: 2,
          unit: "d",
        },
      },
      code: {
        code: "QOD",
        display: "Alternate days",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  Q1H: {
    display: "Q1H (Every 1 hour)",
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        period_unit: "h",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "Q1H",
        display: "Every 1 hour",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  Q2H: {
    display: "Q2H (Every 2 hours)",
    timing: {
      repeat: {
        frequency: 1,
        period: 2,
        period_unit: "h",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "Q2H",
        display: "Every 2 hours",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  Q3H: {
    display: "Q3H (Every 3 hours)",
    timing: {
      repeat: {
        frequency: 1,
        period: 3,
        period_unit: "h",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "Q3H",
        display: "Every 3 hours",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  Q4H: {
    display: "Q4H (Every 4 hours)",
    timing: {
      repeat: {
        frequency: 1,
        period: 4,
        period_unit: "h",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "Q4H",
        display: "Every 4 hours",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  Q6H: {
    display: "Q6H (Every 6 hours)",
    timing: {
      repeat: {
        frequency: 1,
        period: 6,
        period_unit: "h",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "Q6H",
        display: "Every 6 hours",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  Q8H: {
    display: "Q8H (Every 8 hours)",
    timing: {
      repeat: {
        frequency: 1,
        period: 8,
        period_unit: "h",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "Q8H",
        display: "Every 8 hours",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  BED: {
    display: "BED (0-0-1)",
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        period_unit: "d",
        bounds_duration: {
          value: 1,
          unit: "d",
        },
      },
      code: {
        code: "BED",
        display: "Bedtime",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  WK: {
    display: "WK (Weekly)",
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        period_unit: "wk",
        bounds_duration: {
          value: 1,
          unit: "wk",
        },
      },
      code: {
        code: "WK",
        display: "Weekly",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
  MO: {
    display: "MO (Monthly)",
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        period_unit: "mo",
        bounds_duration: {
          value: 1,
          unit: "mo",
        },
      },
      code: {
        code: "MO",
        display: "Monthly",
        system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
      },
    },
  },
} as const;

export const BOUNDS_DURATION_UNITS = [
  // TODO: Are these smaller units required?
  // "ms",
  // "s,
  // "min",
  "h",
  "d",
  "wk",
  "mo",
  "a",
] as const;

export const MEDICATION_STATEMENT_STATUS = [
  "active",
  "on_hold",
  "completed",
  "stopped",
  "unknown",
  "entered_in_error",
  "not_taken",
  "intended",
] as const;

export const MEDICATION_REQUEST_INTENT = [
  "proposal",
  "plan",
  "order",
  "original_order",
  "reflex_order",
  "filler_order",
  "instance_order",
] as const;

export const MEDICATION_REQUEST_STATUS = [
  "active",
  "on-hold",
  "ended",
  "stopped",
  "completed",
  "cancelled",
  "entered_in_error",
  "draft",
  "unknown",
] as const;

export const ENCOUNTER_PRIORITY = [
  "ASAP",
  "callback_results",
  "callback_for_scheduling",
  "elective",
  "emergency",
  "preop",
  "as_needed",
  "routine",
  "rush_reporting",
  "stat",
  "timing_critical",
  "use_as_directed",
  "urgent",
] as const;

export const DOSAGE_UNITS_CODES: {
  code: string;
  display: string;
  system: string;
}[] = [
  {
    code: "mg",
    display: "Milligram",
    system: "http://unitsofmeasure.org",
  },
  {
    code: "g",
    display: "Gram",
    system: "http://unitsofmeasure.org",
  },
  {
    code: "mL",
    display: "Milliliter",
    system: "http://unitsofmeasure.org",
  },
  {
    code: "[drp]",
    display: "Drop",
    system: "http://unitsofmeasure.org",
  },
  {
    code: "{tbl}",
    display: "Tablets",
    system: "http://unitsofmeasure.org",
  },
];

export const AI_MODELS = {
  "openai/gpt-4.1": {
    cost: {
      input: 2,
      cached: 0.5,
      output: 8,
    },
  },
  "openai/gpt-4.1-mini": {
    cost: {
      input: 0.4,
      cached: 0.1,
      output: 1.6,
    },
  },
  "openai/gpt-4.1-nano": {
    cost: {
      input: 0.1,
      cached: 0.025,
      output: 0.4,
    },
  },
  "openai/gpt-4o": {
    cost: {
      input: 2.5,
      cached: 1.25,
      output: 10,
    },
  },
  "openai/gpt-4o-mini": {
    cost: {
      input: 0.15,
      cached: 0.075,
      output: 0.06,
    },
  },
  "google/gemini-2.0-flash": {
    cost: {
      input: 0.1,
      audio_input: 0.7,
      cached: 0.025,
      audio_cached: 0.175,
      output: 0.4,
    },
  },
  "google/gemini-2.0-flash-lite": {
    cost: {
      input: 0.075,
      cached: 0,
      output: 0.3,
    },
  },
  "google/gemini-2.5-flash-lite": {
    cost: {
      input: 0.1,
      audio_input: 0.3,
      cached: 0.025,
      audio_cached: 0.125,
      output: 0.4,
    },
  },
  "google/gemini-2.5-flash": {
    cost: {
      input: 0.3,
      audio_input: 1,
      cached: 0.075,
      audio_cached: 0.25,
      output: 2.5,
    },
  },
  "google/gemini-2.5-pro": {
    cost: {
      input: 1.25,
      audio_input: 1.25,
      cached: 0.31,
      cached_input: 0.31,
      output: 10,
    },
  },
} as const;
